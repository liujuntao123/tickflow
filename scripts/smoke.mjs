#!/usr/bin/env node
// TickFlow M1 后端冒烟测试（零第三方依赖，Node 原生 fetch）
// 用法: node scripts/smoke.mjs   （可选 SMOKE_BASE 覆盖 base url）

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:3000/api/v1';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`ok   - ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL - ${name}${extra !== undefined ? ` :: ${JSON.stringify(extra)?.slice(0, 300)}` : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const stamp = Date.now();
  const email = `smoke_${stamp}@example.com`;
  const password = 'Passw0rd!';
  const deviceA = `web-${stamp}`;

  // ---------- 1) 注册 ----------
  const reg = await req('POST', '/auth/register', {
    body: { email, password, displayName: '冒烟用户', deviceId: deviceA, platform: 'web' },
  });
  check('注册返回 2xx', reg.status === 200 || reg.status === 201, reg);
  check('注册返回 accessToken', typeof reg.json?.accessToken === 'string');
  check('注册返回 user.email', reg.json?.user?.email === email);
  check('注册响应不含 refreshToken(web)', reg.json?.refreshToken === undefined);

  let token = reg.json?.accessToken;

  // ---------- 2) 登录 ----------
  const login = await req('POST', '/auth/login', {
    body: { email, password, deviceId: deviceA, platform: 'android' },
  });
  check('登录成功', login.status === 200 || login.status === 201, login);
  check('登录返回 refreshToken(非 web)', typeof login.json?.refreshToken === 'string');
  token = login.json?.accessToken ?? token;

  const me = await req('GET', '/auth/me', { token });
  check('GET /auth/me 返回用户与设备', me.json?.user?.email === email && Array.isArray(me.json?.devices));

  // ---------- 3) 组织维度 ----------
  const folder = await req('POST', '/folders', { token, body: { name: '工作', color: 0x3366ff } });
  check('创建文件夹', folder.status === 201 && folder.json?.name === '工作', folder);
  check('folder.sortOrder 为字符串(BigInt→string)', typeof folder.json?.sortOrder === 'string', folder.json?.sortOrder);

  const folderId = folder.json.id;
  const list = await req('POST', '/lists', { token, body: { name: '项目清单', folderId } });
  check('创建清单', list.status === 201 && list.json?.name === '项目清单', list);
  const listId = list.json.id;

  const inbox = (await req('GET', '/lists', { token })).json.find((l) => l.isInbox);
  check('存在默认收件箱', !!inbox && inbox.name === '收件箱');

  const tag1 = (await req('POST', '/tags', { token, body: { name: '紧急' } })).json;
  const tag2 = (await req('POST', '/tags', { token, body: { name: '工作' } })).json;
  check('创建标签', !!tag1.id && !!tag2.id);

  const reorder = await req('POST', '/lists/reorder', { token, body: { orderedIds: [listId, inbox.id] } });
  check('清单重排', reorder.status === 201 || reorder.status === 200, reorder);

  // ---------- 4) 任务 ----------
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const taskA = (
    await req('POST', '/tasks', {
      token,
      body: {
        title: '任务A-重要紧急',
        listId,
        priority: 5,
        dueDate: now.toISOString(),
        tagIds: [tag1.id],
      },
    })
  ).json;
  check('创建任务A(优先级5/今日到期/带标签)', taskA?.id && taskA.priority === 5 && taskA.tagIds?.includes(tag1.id), taskA);
  check('task.seq 为字符串', typeof taskA?.seq === 'string');

  const taskB = (
    await req('POST', '/tasks', {
      token,
      body: {
        title: '任务B-重要不紧急',
        listId,
        priority: 3,
        dueDate: new Date(now.getTime() + 5 * day).toISOString(),
        tagIds: [tag2.id],
        subtasks: [{ title: '子任务B1' }],
      },
    })
  ).json;
  check('创建任务B(带子任务)', taskB?.id && Array.isArray(taskB.subtasks) && taskB.subtasks.length === 1, taskB);

  const taskC = (
    await req('POST', '/tasks', {
      token,
      body: { title: '任务C-紧急不重要', listId, priority: 1, dueDate: now.toISOString() },
    })
  ).json;
  check('创建任务C', !!taskC?.id);

  const done = await req('POST', `/tasks/${taskB.id}/complete`, { token });
  check('完成任务B', done.json?.status === 2 && !!done.json?.completedAt, done.json?.status);
  const uncompleteProbe = await req('POST', `/tasks/${taskC.id}/uncomplete`, { token });
  check('任务C uncomplete 幂等可用', uncompleteProbe.json?.status === 0);

  const taskList = await req('GET', `/tasks?listId=${listId}`, { token });
  check('GET /tasks 列表过滤', Array.isArray(taskList.json?.items) && taskList.json.items.length >= 3, taskList.json?.items?.length);

  // ---------- 5) 智能清单 / 日历 / 计数 / 搜索 ----------
  const counts = await req('GET', '/views/counts', { token });
  check('views/counts 返回四类计数', counts.json && typeof counts.json.inbox === 'number' && counts.json.today >= 2, counts.json);

  const today = await req('GET', '/views/today', { token });
  const todayTitles = (today.json?.groups ?? []).flatMap((g) => g.tasks.map((t) => t.title));
  check('views/today 含今日到期任务(不含已完成)', todayTitles.includes('任务A-重要紧急') && todayTitles.includes('任务C-紧急不重要'), todayTitles);
  check('views/today 任务含 tagIds', (today.json?.groups?.[0]?.tasks?.[0]?.tagIds ?? null) !== null);

  const matrix = await req('GET', '/views/matrix', { token });
  const q1 = (matrix.json?.groups ?? []).find((g) => g.key === 'q1');
  check('views/matrix 象限 q1 含任务A', !!q1 && q1.tasks.some((t) => t.title === '任务A-重要紧急'), matrix.json?.groups?.map((g) => g.key));

  const cal = await req('GET', `/views/calendar?from=${new Date(now.getTime() - day).toISOString()}&to=${new Date(now.getTime() + 10 * day).toISOString()}`, { token });
  check('views/calendar 按日聚合', Array.isArray(cal.json?.days) && cal.json.days.length >= 1, cal.json);

  const search = await req('GET', `/search?q=${encodeURIComponent('任务A')}&types=task,list,tag`, { token });
  check('search 命中任务', (search.json?.results ?? []).some((r) => r.type === 'task' && r.title === '任务A-重要紧急'), search.json);

  // ---------- 6) 同步 ----------
  const sync0 = await req('POST', '/sync', { token, body: { deviceId: deviceA, cursor: 0, entities: {}, tombstones: [] } });
  check('sync cursor=0 空推拉全量', sync0.status === 201 || sync0.status === 200, sync0.status);
  check('sync 返回实体集合', Array.isArray(sync0.json?.entities?.tasks) && sync0.json.entities.tasks.length >= 3, sync0.json?.entities?.tasks?.length);
  check('sync 返回收件箱与设置', sync0.json?.entities?.lists?.some((l) => l.isInbox) && !!sync0.json?.entities?.settings);
  const cursor1 = sync0.json.cursor;
  check('sync cursor 为数字且>0', typeof cursor1 === 'number' && cursor1 > 0, cursor1);

  // 增量：REST 改任务C → 带 cursor1 拉取应看到变更
  const patchC = await req('PATCH', `/tasks/${taskC.id}`, { token, body: { title: '任务C-已更新', priority: 3 } });
  check('PATCH 任务C', patchC.json?.title === '任务C-已更新', patchC);
  const syncIncr = await req('POST', '/sync', { token, body: { deviceId: deviceA, cursor: cursor1, entities: {}, tombstones: [] } });
  const pulledC = (syncIncr.json?.entities?.tasks ?? []).find((t) => t.id === taskC.id);
  check('sync 增量拉取到任务C变更', !!pulledC && pulledC.title === '任务C-已更新', pulledC?.title);
  check('sync 游标前进', syncIncr.json?.cursor > cursor1, [cursor1, syncIncr.json?.cursor]);

  // 两阶段：cursor=0 且服务端有数据 且 客户端带了数据 → needsFullResync，不应用
  const resync = await req('POST', '/sync', {
    token,
    body: {
      deviceId: 'device-C',
      cursor: 0,
      entities: { tasks: [{ id: '11111111-1111-1111-1111-111111111111', title: '不应写入', updatedAt: new Date().toISOString() }] },
      tombstones: [],
    },
  });
  check('首同步两阶段 needsFullResync=true', resync.json?.needsFullResync === true, resync.json?.needsFullResync);
  check('两阶段不应用客户端数据', (resync.json?.applied ?? []).length === 0);
  const probeC = await req('GET', '/tasks/11111111-1111-1111-1111-111111111111', { token });
  check('两阶段未写入幽灵任务', probeC.status === 404, probeC.status);

  const cursor2 = syncIncr.json.cursor;

  // ---------- 7) LWW 冲突（第二设备） ----------
  const beforeTitle = (await req('GET', `/tasks/${taskA.id}`, { token })).json.title;

  const oldPush = await req('POST', '/sync', {
    token,
    body: {
      deviceId: 'device-B',
      cursor: cursor2,
      entities: { tasks: [{ id: taskA.id, title: '旧时间戳覆盖', updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), deviceId: 'device-B' }] },
      tombstones: [],
    },
  });
  check('旧时间戳推送被 skippedOlder', (oldPush.json?.skippedOlder ?? []).some((s) => s.id === taskA.id), oldPush.json?.skippedOlder);
  check('旧时间戳未写入', (await req('GET', `/tasks/${taskA.id}`, { token })).json.title === beforeTitle);

  const newPush = await req('POST', '/sync', {
    token,
    body: {
      deviceId: 'device-B',
      cursor: cursor2,
      entities: { tasks: [{ id: taskA.id, title: '新时间戳胜出', updatedAt: new Date(Date.now() + 30 * 1000).toISOString(), deviceId: 'device-B' }] },
      tombstones: [],
    },
  });
  check('新时间戳推送 applied', (newPush.json?.applied ?? []).some((a) => a.id === taskA.id), newPush.json?.applied);
  check('新时间戳写入生效', (await req('GET', `/tasks/${taskA.id}`, { token })).json.title === '新时间戳胜出');

  // 墓碑
  const tomb = await req('POST', '/sync', {
    token,
    body: { deviceId: deviceA, cursor: newPush.json.cursor, entities: {}, tombstones: [{ type: 'task', id: taskC.id }] },
  });
  check('墓碑软删生效', (await req('GET', `/tasks/${taskC.id}`, { token })).status === 404, tomb.status);
  const trash = await req('GET', '/tasks/trash', { token });
  check('任务进入回收站', (trash.json?.items ?? []).some((t) => t.id === taskC.id));

  // ---------- 8) 习惯 ----------
  const templates = await req('GET', '/habit-templates', { token });
  check('习惯库模板已种子(12)', (templates.json ?? []).length === 12, templates.json?.length);

  const habit = await req('POST', '/habits', { token, body: { name: '阅读30分钟', targetValue: 30, unit: '分钟' } });
  check('创建习惯', !!habit.json?.id, habit);
  const todayStr = new Date().toISOString().slice(0, 10);
  const check1 = await req('POST', `/habits/${habit.json.id}/check`, { token, body: { date: todayStr, value: 1 } });
  check('习惯打卡', !!check1.json?.id, check1);
  const check2 = await req('POST', `/habits/${habit.json.id}/check`, { token, body: { date: todayStr, value: 1 } });
  check('习惯重复打卡幂等(seq 不变)', check2.json?.seq === check1.json?.seq, [check1.json?.seq, check2.json?.seq]);
  const hstats = await req('GET', '/habits/stats', { token });
  const hstat = (hstats.json ?? []).find((s) => s.habitId === habit.json.id);
  check('习惯统计 currentStreak=1', hstat?.currentStreak === 1, hstat);
  const fromTpl = await req('POST', '/habits/from-template', { token, body: { templateId: 'drink-water-8' } });
  check('从模板创建习惯', fromTpl.json?.name === '喝水8杯', fromTpl.json);

  // ---------- 9) 专注 ----------
  const session = await req('POST', '/focus/sessions', { token, body: { taskId: taskA.id, mode: 0, plannedSeconds: 1500 } });
  check('创建专注会话', session.json?.status === 0, session);
  const cur = await req('GET', '/focus/sessions/current', { token });
  check('查询当前会话', cur.json?.id === session.json.id);
  const completed = await req('PATCH', `/focus/sessions/${session.json.id}`, { token, body: { action: 'complete', actualSeconds: 1200, breakSeconds: 300 } });
  check('完成专注会话', completed.json?.status === 2 && completed.json?.actualSeconds === 1200, completed.json);
  const fstats = await req('GET', '/focus/stats', { token });
  check('专注统计 sessionCount=1', fstats.json?.sessionCount === 1 && fstats.json?.totalSeconds === 1200, fstats.json);

  // ---------- 10) 设置 ----------
  const settingsGet = await req('GET', '/settings', { token });
  check('GET /settings 返回默认', settingsGet.json?.theme === 'system' && typeof settingsGet.json?.seq === 'string', settingsGet.json);
  const settingsPut = await req('PUT', '/settings', { token, body: { theme: 'dark', dayStartHour: 4 } });
  check('PUT /settings 更新', settingsPut.json?.theme === 'dark' && settingsPut.json?.dayStartHour === 4, settingsPut.json);
  const settingsGet2 = await req('GET', '/settings', { token });
  check('设置持久化', settingsGet2.json?.theme === 'dark');

  // ---------- 10.5) 重复任务 / 日历展开 (M2) ----------
  const badRule = await req('POST', '/tasks', { token, body: { title: '非法重复', listId, recurrenceRule: 'FREQ=HOURLY' } });
  check('非法 RRULE → 400 invalid_recurrence', badRule.status === 400 && badRule.json?.error?.code === 'invalid_recurrence', badRule);

  const nextMonday = (() => {
    const d = new Date();
    d.setUTCHours(4, 0, 0, 0); // Asia/Shanghai 12:00
    const delta = (1 - d.getUTCDay() + 7) % 7; // 下一个周一
    d.setUTCDate(d.getUTCDate() + delta);
    return d;
  })();
  const localKey = (d) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  const recTask = (
    await req('POST', '/tasks', {
      token,
      body: { title: '每周一三五', listId, dueDate: nextMonday.toISOString(), recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' },
    })
  ).json;
  check('创建每周一三五重复任务', recTask?.recurrenceRule === 'FREQ=WEEKLY;BYDAY=MO,WE,FR', recTask);
  check('重复任务锚点=dueDate 且 tz 为用户时区', recTask?.recurrenceDtstart === nextMonday.toISOString() && recTask?.recurrenceTz === 'Asia/Shanghai', [recTask?.recurrenceDtstart, recTask?.recurrenceTz]);
  check('nextDueDate 镜像 dueDate', recTask?.nextDueDate === nextMonday.toISOString(), recTask?.nextDueDate);

  const calFrom = new Date(nextMonday.getTime() - 3600 * 1000);
  const calTo = new Date(nextMonday.getTime() + 90 * 24 * 3600 * 1000);
  const calQ = `/views/calendar?from=${calFrom.toISOString()}&to=${calTo.toISOString()}`;
  const expectedOcc = (() => {
    let n = 0;
    for (let i = 0; i < 90; i += 1) {
      const wd = new Date(nextMonday.getTime() + i * 86400000).getUTCDay();
      if (wd === 1 || wd === 3 || wd === 5) n += 1;
    }
    return n;
  })();
  const cal2 = await req('GET', calQ, { token });
  const occs = (cal2.json?.days ?? []).flatMap((d) => d.tasks).filter((t) => t.id === recTask.id);
  check('日历 90 天展开数目正确', occs.length === expectedOcc, [occs.length, expectedOcc]);
  check('日历 occurrenceDate 为本地日期且 completed=false', occs.length > 0 && occs.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.occurrenceDate) && t.completed === false), occs[0]?.occurrenceDate);
  check('日历窗口 >92 天 → 400', (await req('GET', `/views/calendar?from=${calFrom.toISOString()}&to=${new Date(calFrom.getTime() + 100 * 86400000).toISOString()}`, { token })).status === 400);

  const c1 = await req('POST', `/tasks/${recTask.id}/complete`, { token });
  check('重复任务 complete 滚动(不置完成)', c1.json?.rolled === true && c1.json?.status === 0, [c1.json?.rolled, c1.json?.status]);
  const next1 = c1.json?.nextDueDate ? new Date(c1.json.nextDueDate) : null;
  check('due 滚动到下一 occurrence(周三)', next1 && next1.getTime() > nextMonday.getTime() && next1.getUTCDay() === 3, c1.json?.nextDueDate);
  check('dueDate 与 nextDueDate 同步', c1.json?.dueDate === c1.json?.nextDueDate);
  const firstKey = localKey(nextMonday);
  const cal3 = await req('GET', calQ, { token });
  const firstOccEntry = (cal3.json?.days ?? []).find((d) => d.date === firstKey)?.tasks.find((t) => t.id === recTask.id);
  check('完成历史 occurrence 入库(completed:true)', firstOccEntry?.completed === true, firstOccEntry);
  const occs3 = (cal3.json?.days ?? []).flatMap((d) => d.tasks).filter((t) => t.id === recTask.id);
  check('滚动后展开数目不变(锚点不变)', occs3.length === expectedOcc, [occs3.length, expectedOcc]);

  const u1 = await req('POST', `/tasks/${recTask.id}/uncomplete`, { token });
  check('uncomplete 回退到原 occurrence', u1.json?.dueDate === nextMonday.toISOString() && u1.json?.status === 0, u1.json?.dueDate);
  const cal4 = await req('GET', calQ, { token });
  const firstAfterUn = (cal4.json?.days ?? []).find((d) => d.date === firstKey)?.tasks.find((t) => t.id === recTask.id);
  check('uncomplete 后 completed 复位', firstAfterUn?.completed === false, firstAfterUn?.completed);

  const onceTask = (
    await req('POST', '/tasks', { token, body: { title: '一次性重复', listId, dueDate: nextMonday.toISOString(), recurrenceRule: 'FREQ=DAILY;COUNT=1' } })
  ).json;
  const onceDone = await req('POST', `/tasks/${onceTask.id}/complete`, { token });
  check('规则结束按普通完成处理', onceDone.json?.rolled === false && onceDone.json?.status === 2, [onceDone.json?.rolled, onceDone.json?.status]);
  check('PATCH 非法 RRULE → 400', (await req('PATCH', `/tasks/${taskA.id}`, { token, body: { recurrenceRule: 'FREQ=SECONDLY' } })).status === 400);

  // ---------- 11) refresh 轮换 + 重放检测（独立用户，避免影响主会话） ----------
  const email2 = `smoke_rt_${stamp}@example.com`;
  const reg2 = await req('POST', '/auth/register', { body: { email: email2, password, deviceId: 'dev-rt', platform: 'android' } });
  const rt1 = reg2.json?.refreshToken;
  const r1 = await req('POST', '/auth/refresh', { body: { refreshToken: rt1, deviceId: 'dev-rt' } });
  check('refresh 轮换成功', (r1.status === 200 || r1.status === 201) && typeof r1.json?.refreshToken === 'string' && r1.json.refreshToken !== rt1, r1);
  const replay = await req('POST', '/auth/refresh', { body: { refreshToken: rt1, deviceId: 'dev-rt' } });
  check('重放旧 refreshToken → 401', replay.status === 401, replay);
  const afterReplay = await req('POST', '/auth/refresh', { body: { refreshToken: r1.json.refreshToken, deviceId: 'dev-rt' } });
  check('重放后新 token 也被撤销', afterReplay.status === 401, afterReplay.status);

  // ---------- 12) 限流（login 5/min） ----------
  let rateLimited = false;
  for (let i = 0; i < 8; i += 1) {
    const r = await req('POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'WrongPass1', deviceId: 'rl', platform: 'web' } });
    if (r.status === 429) {
      rateLimited = true;
      break;
    }
  }
  check('登录限流触发 429', rateLimited);

  // ---------- 13) 健康与元信息 ----------
  const health = await req('GET', '/healthz');
  check('healthz ok', health.json?.status === 'ok' && health.json?.db === 'up', health.json);
  const meta = await req('GET', '/meta');
  check('meta 返回模块开关', meta.json?.modules?.habits === true && typeof meta.json?.version === 'string', meta.json);

  await sleep(10);

  console.log('\n========================================');
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed > 0) {
    console.log('失败用例:');
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  }
  console.log('全部通过 ✅');
}

main().catch((e) => {
  console.error('冒烟测试异常终止:', e);
  process.exit(1);
});