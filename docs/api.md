# TickFlow 后端 API（M1）

Base URL：容器直连 `http://127.0.0.1:3000/api/v1`；Web 经 Next 代理 `/api/backend/*`。
除标注 `@public` 外，所有接口都需要请求头 `Authorization: Bearer <accessToken>`。

## 通用约定

- **错误结构**（全局异常过滤器，所有非 2xx 响应）：

  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败", "details": {} } }
  ```

  常见 `code`：`VALIDATION_ERROR` `AUTH_REQUIRED` `INVALID_TOKEN` `INVALID_CREDENTIALS` `EMAIL_TAKEN` `REFRESH_REPLAY` `NOT_FOUND` `CONFLICT` `RATE_LIMITED` `invalid_recurrence`（重复规则不合法）`INVALID_RANGE` / `RANGE_TOO_LARGE`（日历窗口非法或 >92 天）。

- **BigInt → 字符串**：所有响应 JSON 中的 `seq`、`sortOrder` 等 BigInt 字段统一序列化为**字符串**（服务端给 `BigInt.prototype.toJSON` 打了补丁），例如 `"seq": "12"`。客户端解析时按字符串处理，比较时转数字。
- **时间**：统一 UTC ISO-8601（如 `2026-10-13T03:07:46.324Z`）。日期型字段（习惯）用 `YYYY-MM-DD`。
- **限流**：`login` / `register` 按 IP 5 次/分钟（超出返回 `429 RATE_LIMITED`），其余接口全局 120 次/分钟。
- **分页**：列表接口返回 `{ "items": [...], "nextCursor": "uuid|null" }`，用 `?cursor=<id>&limit=<n>`（`limit` 默认 100，最大 500）。

---

## auth

### `POST /auth/register` @public

```json
{ "email": "a@b.com", "password": "Passw0rd!", "displayName": "小明",
  "timezone": "Asia/Shanghai", "deviceId": "web-1", "platform": "web" }
```

事务内创建：用户 + 默认收件箱清单（`isInbox=true, name='收件箱'`）+ 默认设置 + 同步状态 + 设备。
响应：

```json
{ "user": { "id": "...", "email": "a@b.com", "displayName": "小明", "timezone": "Asia/Shanghai" },
  "accessToken": "eyJ..." }
```

`platform === "web"` 时**不**在 body 返回 refreshToken，改为 `Set-Cookie: tf_rt=...`（httpOnly、SameSite=Lax、Path=`/api/backend/auth`、Max-Age=60 天、`Secure` 由环境变量 `COOKIE_SECURE` 控制）；其他平台在 body 返回 `refreshToken`。

### `POST /auth/login` @public（5 次/分钟）

```json
{ "email": "a@b.com", "password": "Passw0rd!", "deviceId": "web-1", "platform": "android" }
```

同 register 的返回规则，并写 `lastLoginAt`。

### `POST /auth/refresh` @public

`{ "refreshToken": "..." }`（或 cookie `tf_rt`，二选一）。**每次使用即轮换**：旧 token 标记 `revokedAt` + `replacedById`，返回新 access + 新 refresh（web 走 cookie）。
**重放检测**：使用已撤销的 token → 撤销该用户**全部** refresh token 并返回 `401 REFRESH_REPLAY`。

### `POST /auth/logout?all=true`

`all=true` 撤销该用户全部 refresh token，否则只撤销当前会话；同时清 cookie。

### `GET /auth/me`

```json
{ "user": { ... }, "sessionId": "<refreshTokenId>",
  "devices": [{ "deviceId": "web-1", "platform": "web", "appVersion": null, "lastSyncAt": null, "createdAt": "..." }] }
```

access JWT：HS256，payload `{ sub, sid, typ:'access' }`，TTL 由 `ACCESS_TOKEN_TTL` 控制（默认 30m），`sid` = refresh token id。refresh token：32 字节随机 hex，仅存 sha256，60 天。

---

## users / devices / meta / healthz

- `PATCH /users/me`：`{ "displayName"?, "timezone"? }` → `{ user }`。
- `POST /users/me/password`：`{ oldPassword, newPassword }`（新密码 ≥8）。成功后撤销**其他** refresh token（保留当前会话）。
- `GET /devices` → `{ devices: [...] }`；`DELETE /devices/:deviceId`（同时撤销该设备 refresh token）。
- `GET /meta` @public → `{ "version": "0.0.1", "modules": { "pomodoro": true, "habits": true, "matrix": true, "calendar": true } }`。
- `GET /healthz` @public → `{ "status": "ok", "db": "up", "version": "0.0.1", "time": "..." }`（compose 健康检查依赖）。

---

## 组织维度

### folders

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/folders` | 列出未删除文件夹（`sortOrder` 升序） |
| POST | `/folders` | `{ name, color? }`，`sortOrder` = 当前最大 + 1024 |
| PATCH | `/folders/:id` | `{ name?, color?, sortOrder? }` |
| DELETE | `/folders/:id?strategy=inbox\|cascade` | 软删；`inbox`（默认）子清单 `folderId=null`；`cascade` 子清单任务移入收件箱并软删子清单 |
| POST | `/folders/reorder` | `{ orderedIds: [...] }`，`sortOrder = 下标 * 1024` |

### lists

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/lists?folderId=&includeArchived=` | 含 `_count.tasks` |
| POST | `/lists` | `{ name, folderId?, color?, icon? }` |
| PATCH | `/lists/:id` | 部分字段更新 |
| DELETE | `/lists/:id` | 软删，其任务移入收件箱（收件箱本身不可删：`INBOX_PROTECTED`） |
| POST | `/lists/reorder` | `{ orderedIds }` |
| POST | `/lists/:id/archive` | `{ archived? }`（默认 true） |

### tags

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tags` | 含 `_count.tasks` |
| POST | `/tags` | `{ name, color? }` |
| PATCH | `/tags/:id` | 部分字段更新 |
| DELETE | `/tags/:id` | 软删并清理 `task_tags` 关联 |
| POST | `/tags/reorder` | `{ orderedIds }` |
| POST | `/tags/merge` | `{ fromId, toId }`：任务关联改指 `toId` 后软删 `fromId` |

软删 = 置 `deletedAt` 并分配新 `seq`（作为墓碑同步给各端）。

---

## tasks

字段：`listId, parentId, title, notes, priority(0/1/3/5), status(0/2), completedAt, dueDate, isAllDay, startDate, timezone, recurrenceRule, recurrenceTz, recurrenceDtstart, recurrenceEnd, repeatFrom, nextDueDate, reminders, reminderRepeatMinutes, checklist, sortOrder, tagIds()`。
响应额外带 `tagIds: string[]`（关系表 `task_tags` 不进同步流）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tasks?listId&tagId&parentId&topLevel&status&priority&from&to&q&cursor&limit` | 默认按 `sortOrder` 升序；返回 `{items,nextCursor}` |
| POST | `/tasks` | 见下；`listId` 缺省用收件箱；`sortOrder` = 同级最大 + 1024 |
| GET | `/tasks/:id` | 含 `tagIds` 与 `subtasks` |
| PATCH | `/tasks/:id` | 部分更新；`tagIds` 存在时事务内重建关联 |
| DELETE | `/tasks/:id?hard=true` | 软删并级联软删子任务；`hard=true` 物理删除（含后代） |
| POST | `/tasks/:id/complete` | 普通任务：`status=2, completedAt=now`；重复任务：按下文**滚动**（不置完成） |
| POST | `/tasks/:id/uncomplete` | 有完成历史则删除最近一条 `task_occurrence` 并把 `dueDate/nextDueDate` 回退到它的 `occurrenceDate`；否则仅 `status=0, completedAt=null` |
| POST | `/tasks/:id/move` | `{ listId, sortOrder? }` |
| POST | `/tasks/reorder` | `{ listId, parentId?, orderedIds }`，下标 * 1024 |
| POST | `/tasks/:id/checklist` | `{ checklist: [...] }` 全量替换 |
| POST | `/tasks/batch` | `{ ids, action: complete\|delete\|move\|priority\|addTag, payload }` |
| GET | `/tasks/trash` | 回收站（软删任务） |
| POST | `/tasks/trash/empty` | 清空回收站（物理删） |

创建示例：

```json
{ "title": "写方案", "listId": "uuid", "priority": 5, "dueDate": "2026-10-13T09:00:00.000Z",
  "tagIds": ["uuid"], "checklist": [{ "id": "1", "title": "大纲", "checked": false, "sortOrder": 0 }],
  "reminders": [{ "offset": 0 }], "subtasks": [{ "title": "子任务", "priority": 3 }] }
```

### 重复任务（RRULE 简化子集，M2）

**白名单语法**（不满足 → `400 { "error": { "code": "invalid_recurrence" } }`）：

```
FREQ=DAILY|WEEKLY|MONTHLY|YEARLY   必填
INTERVAL=n                          可选，正整数
BYDAY=MO,TU,...                     可选，仅 FREQ=WEEKLY
BYMONTHDAY=n                        可选，仅 FREQ=MONTHLY（|n| ≤ 31）
COUNT=n  或  UNTIL=YYYYMMDDTHHMMSSZ 二选一
```

创建/更新时会用 `rrule` 包 parse 一次确认合法。

- **锚点**：设置重复时服务端取任务当前 `dueDate`（无则 `now()`）写入 `recurrenceDtstart`，并**从此不再改变**；`recurrenceTz` 取用户 `timezone`（默认 `Asia/Shanghai`）。清空 `recurrenceRule`（传 `null`）会一并清空 `recurrenceDtstart/recurrenceTz`。
- **`nextDueDate` 镜像 `dueDate`**：REST 写路径下 `dueDate` 变更时同步镜像 `nextDueDate`（智能清单查询用 `COALESCE(next_due_date, due_date)`，不做惰性推进，逾期重复任务按“已过期”留在今天列表）。
- **完成滚动**（`POST /tasks/:id/complete`，`repeatFrom` 0=按截止日 1=按完成日）：
  - `base = repeatFrom==0 ? (nextDueDate ?? dueDate ?? now) : now`；
  - 用 rrule 求 `base` 之后（严格大于）的第一个 occurrence `next`（受 COUNT/UNTIL 限制）；
  - 若存在 `next`：写 `task_occurrences(occurrenceDate=base 所在那一次, completedAt=now)`；任务**不置完成**，改为 `status=0, dueDate=next, nextDueDate=next, completedAt=null`，其子任务按同一 `next` 一并滚动；响应任务带 `"rolled": true`。
  - 若无 `next`（规则结束）：按普通完成处理（`status=2`，`"rolled": false`）。

---

## views（智能清单）

时间边界按 `users.timezone` + `user_settings.dayStartHour` 用原生 SQL（`AT TIME ZONE`）计算本地“日界”；**有效到期 = `COALESCE(next_due_date, due_date)`**。

- `GET /views/:key`，`key ∈ inbox|today|tomorrow|next7|all|completed|matrix`，可选 `?groupBy=list|date|priority|quadrant`（默认：`list`；`completed` 默认 `date`；`matrix` 默认 `quadrant`）。
  返回：

  ```json
  { "key": "today", "groupBy": "list",
    "groups": [{ "key": "uuid", "label": "收件箱", "tasks": [ /* 含 tagIds */ ] }] }
  ```

  谓词：
  - `today`：未完成且有效到期 < 次日日界（**含已过期**；无到期日不含）。
  - `tomorrow`：∈ [次日日界, 再次日)。
  - `next7`：∈ [今日界, 今日界 + 7 天)。
  - `inbox`：收件箱内未完成任务。`all`：所有未完成。`completed`：`status=2`，按 `completedAt` 倒序取最近 200。
  - `matrix`：重要 = `priority ∈ (3,5)`，紧急 = 有效到期 < 今日界 + 2 天，分 `q1`(重要紧急)/`q2`(重要不紧急)/`q3`(紧急不重要)/`q4`(其余)，不含已完成。

- `GET /views/calendar?from=<ISO>&to=<ISO>`（**真正展开重复任务**，窗口 ≤ 92 天，超限 `400 RANGE_TOO_LARGE`）→

  ```json
  { "from": "2026-10-12T16:00:00.000Z", "to": "2027-01-11T16:00:00.000Z",
    "days": [{ "date": "2026-10-13",
               "tasks": [{ "...": "完整 task 载荷(+tagIds)", "occurrenceDate": "2026-10-13", "completed": false }] }] }
  ```

  - 非重复任务：`dueDate` 落在 `[from,to)` → 出现一次（`occurrenceDate` = 本地日期，`completed` = `status===2`）。
  - 重复任务：以 `recurrenceDtstart` 为锚、rrule 展开到窗口内（受 UNTIL/COUNT 限制），每个 occurrence 一条（同一 task id 可出现多次）；若该 occurrence 在 `task_occurrences` 中有记录（按本地日期匹配）→ `completed: true`。不落库。
  - 时区：按 `users.timezone` 分组本地日期（以 `recurrenceDtstart` 绝对时刻 + UTC 间隔展开，再归本地日期）。**限制**：对含夏令时的时区会有小时级偏移，v1 不处理。
- `GET /views/counts` → `{ "inbox": n, "today": n, "tomorrow": n, "next7": n }`。

---

## search

`GET /search?q=&types=task,list,tag&limit=` → `{ "results": [{ "type": "task", "id": "...", "title": "...", "subtitle": "..." }] }`。
任务按 `title`/`notes` ILIKE 匹配；`types` 默认 `task,list,tag`；`limit` 默认 20（最大 50）。

---

## habits

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/habits` | 每个习惯含近 30 天记录（`records`） |
| POST | `/habits` | `{ name, icon?, color?, goalType?, targetValue?, unit?, frequency?, weekDays?, repeatRule?, startDate?, reminders? }` |
| PATCH | `/habits/:id` | 部分更新 |
| DELETE | `/habits/:id` | 软删 + 分配 seq |
| POST | `/habits/:id/check` | `{ date, value? }`：按 `(habitId,date)` upsert，**幂等**（值相同不推进 seq） |
| POST | `/habits/:id/uncheck` | `{ date }`：软删该记录 |
| GET | `/habits/stats?from&to` | 见下 |
| GET | `/habit-templates` | 习惯库（12 个中文模板，只读） |
| POST | `/habits/from-template` | `{ templateId }` |

`stats` 返回数组，每项：

```json
{ "habitId": "uuid", "name": "阅读30分钟", "currentStreak": 7, "longestStreak": 10,
  "completionRate": 0.7, "days": [{ "date": "2026-10-13", "value": 1 }] }
```

---

## focus

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/focus/sessions` | `{ taskId?, mode(0/1/2)?, plannedSeconds, note? }` → `status=0` |
| PATCH | `/focus/sessions/:id` | `{ action: pause\|resume\|complete\|cancel, actualSeconds?, breakSeconds? }` |
| GET | `/focus/sessions/current` | 进行中/暂停中的会话（跨端恢复） |
| GET | `/focus/stats?from&to&granularity=day` | `{ totalSeconds, sessionCount, byDay: [{ date, totalSeconds, count }] }` |

会话 `status`：`0` 进行中 / `1` 暂停 / `2` 完成 / `3` 取消。

---

## settings

- `GET /settings`：不存在则落库默认值并返回（分配 seq）。
- `PUT /settings`：部分更新，字段 `theme, weekStart, dayStartHour, dateFormat, modulePomodoro, moduleHabits, moduleMatrix, moduleCalendar, smartListsVisible, defaultListId, defaultPriority, defaultReminderOffset, focusSettings`。

---

## sync（客户端主通道）

### `POST /sync`

请求：

```json
{
  "deviceId": "web-1",
  "cursor": 42,
  "entities": {
    "folders": [{ "id": "uuid", "name": "工作", "color": 3355443, "sortOrder": "1024", "updatedAt": "2026-10-13T09:00:00.000Z" }],
    "lists":   [{ "id": "uuid", "folderId": "uuid", "name": "项目", "isInbox": false, "isArchived": false, "sortOrder": "2048", "updatedAt": "..." }],
    "tags":    [{ "id": "uuid", "name": "紧急", "color": 16711680, "sortOrder": "1024", "updatedAt": "..." }],
    "tasks":   [{ "id": "uuid", "listId": "uuid", "parentId": null, "title": "写方案", "notes": null,
                  "priority": 5, "status": 0, "completedAt": null, "dueDate": "2026-10-13T09:00:00.000Z",
                  "isAllDay": false, "startDate": null, "timezone": "Asia/Shanghai",
                  "recurrenceRule": null, "recurrenceTz": null, "recurrenceDtstart": null, "recurrenceEnd": null,
                  "repeatFrom": 0, "nextDueDate": null, "reminders": [{ "offset": 0 }], "reminderRepeatMinutes": null,
                  "checklist": [{ "id": "1", "title": "大纲", "checked": false, "sortOrder": 0 }],
                  "sortOrder": "1024", "tagIds": ["uuid"], "updatedAt": "2026-10-13T09:00:00.000Z" }],
    "habits":  [{ "id": "uuid", "name": "阅读30分钟", "goalType": 0, "targetValue": 30, "unit": "分钟",
                  "frequency": 0, "weekDays": [], "startDate": "2026-10-13", "archived": false, "sortOrder": "1024", "updatedAt": "..." }],
    "habitRecords":  [{ "id": "uuid", "habitId": "uuid", "date": "2026-10-13", "value": 1, "updatedAt": "..." }],
    "focusSessions": [{ "id": "uuid", "taskId": "uuid", "mode": 0, "plannedSeconds": 1500,
                        "startedAt": "...", "endedAt": "...", "actualSeconds": 1200, "breakSeconds": 300,
                        "pauseCount": 0, "status": 2, "interrupted": false, "updatedAt": "..." }],
    "settings": { "theme": "dark", "weekStart": 1, "dayStartHour": 0, "updatedAt": "..." }
  },
  "tombstones": [{ "type": "task", "id": "uuid" }]
}
```

实体 JSON 即数据库字段（camelCase）+ 任务 `tagIds` + `updatedAt`（客户端逻辑时间，ISO）。
`tombstones.type` 接受单/复数（`task`/`tasks` 等；`settings` 无墓碑）。

响应：

```json
{
  "cursor": 57,
  "serverTime": "2026-10-13T09:00:01.000Z",
  "clientLocalDate": "2026-10-13",
  "entities": {
    "folders": [], "lists": [], "tags": [],
    "tasks": [{ "id": "uuid", "title": "写方案", "seq": "57", "tagIds": ["uuid"], "...": "..." }],
    "habits": [], "habitRecords": [], "focusSessions": [],
    "settings": { "userId": "uuid", "theme": "dark", "seq": "56" }
  },
  "tombstones": {
    "folders": [], "lists": [], "tags": [],
    "tasks": [{ "id": "uuid", "deletedAt": "2026-10-13T09:00:00.000Z", "seq": "55" }],
    "habits": [], "habitRecords": [], "focusSessions": [], "settings": null
  },
  "applied": [{ "type": "tasks", "id": "uuid", "seq": 57 }],
  "skippedOlder": [{ "type": "tasks", "id": "uuid" }],
  "needsFullResync": false
}
```

**语义**

- 单个事务内（`withSync`）**先推送、再增量拉取**。拉取返回各表 `seq > cursor` 的全部行，按 `deletedAt` 拆分为 `entities`（存活）与 `tombstones`（墓碑）。
- **LWW**：入站 `updatedAt` 钳制到 `now + 2min`；与存储的 `(lwwAt ?? updatedAt, lwwDevice ?? '')` 按 **(时间, deviceId) 字典序**比较，大者胜。胜出则写入并置 `lwwAt/lwwDevice = 入站值`、`seq = alloc()`；否则进 `skippedOlder`。新实体（不存在）直接写入。
- **tombstones**：把对应实体软删（`deletedAt=now, seq=alloc()`）。
- **重复任务完成滚动（服务端权威）**：推送的 task 若 `status===2` 且服务端当前不存在该任务或非完成态、且该任务带 `recurrenceRule` → **不落地 `status=2`**，而是执行与 REST `POST /tasks/:id/complete` **完全相同的滚动逻辑**（同一共享函数 `rollRecurringTask`）：写 `task_occurrences`（范式同 REST）、`status=0`、`dueDate/nextDueDate=下一次 occurrence`、`completedAt=null`，各分配新 `seq`；规则已终态（无 next）则按普通完成落地 `status=2`。滚动产生的新 seq 自然出现在本次 delta 的 `entities` 中回给客户端（`applied[].seq` 为最终 seq）。由于滚动后 `lwwAt/lwwDevice` 置为入站值，**重复推送同一完成事件**（相同 `updatedAt`+设备）会因 LWW 平局进入 `skippedOlder`，不会二次滚动。incoming 本就是滚动后的状态（`status=0` + 新 `dueDate`）则走正常 LWW。
- **首同步两阶段**：`cursor === 0` 且服务端该用户有数据 且客户端本次带了任何 `entities`/`tombstones` → 返回 `needsFullResync: true`，**不应用任何客户端数据**（`entities`/`tombstones` 为空，`cursor=0`），客户端随后走 `GET /sync/bootstrap` 全量重拉再合并。服务端为空则正常应用（本地种子上云）。
- REST 写路径同样经由 `withSync`，并把 `lwwAt` 设为 `now()`、`lwwDevice = 'server'`。

### `GET /sync/bootstrap`

返回全量存活实体与当前服务端最大 seq：

```json
{ "cursor": 57, "entities": { "folders": [], "lists": [], "tags": [], "tasks": [], "habits": [], "habitRecords": [], "focusSessions": [], "settings": { } } }
```

### 同步基建

- `user_sync_state` 保存每用户单调 `seq`。
- **核心不变量**：一切写操作在交互式事务**开头**对该用户行 `SELECT ... FOR UPDATE` 加锁，再依次 `alloc()` 分配 seq，事务结束一次性推进计数器 → **分配顺序 == 提交顺序**，客户端游标无空洞、无重复。
- 可同步表统一带 `seq / updatedAt / deletedAt / lwwAt / lwwDevice`（`folders, lists, tags, tasks, habits, habit_records, focus_sessions, user_settings`，共 8 张）。

---

## 与实施方案的偏差

1. **注册时序号**：方案写 `user_sync_state.seq=0`；实现为收件箱 `seq=1`、设置 `seq=2`、`user_sync_state.seq=2`，以保证首次 `/sync`（cursor=0）能拉到收件箱与设置且序号与计数器一致。
2. **两阶段判定 “服务端有数据”**：不计入注册自动创建的收件箱与默认设置，仅当存在用户产生的数据（任务/文件夹/标签/习惯/记录/专注/非收件箱清单）时才触发 `needsFullResync`。
3. **`matrix` 默认分组**为 `quadrant`（方案仅明确 `completed` 默认 `date`）。
4. `GET /tasks` 返回 `{items,nextCursor}` 游标分页结构。
5. refresh cookie 的 `Path=/api/backend/auth` 按需求固定，对应 Web 经 Next 代理的浏览器可见路径。