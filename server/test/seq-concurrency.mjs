#!/usr/bin/env node
// 并发 seq 分配器正确性测试
// 断言：10 个并发写操作分配的 seq 无重复、无空洞（分配序 == 提交序）。
// 用法（依赖已编译的 dist，先 `pnpm --filter @tickflow/server build`）：
//   DATABASE_URL=... node server/test/seq-concurrency.mjs
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { withSync } = require('../dist/common/sync/seq-allocator.js');

const prisma = new PrismaClient();
const N = 10;

function assert(cond, msg) {
  if (cond) {
    console.log(`ok   - ${msg}`);
  } else {
    console.error(`FAIL - ${msg}`);
    process.exitCode = 1;
  }
}

async function runBatch(userId, label, expectedStart) {
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      withSync(prisma, userId, async (tx, alloc) => {
        const created = await tx.task.create({
          data: { userId, title: `${label}-${i}`, seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: 'test' },
        });
        return Number(created.seq);
      }),
    ),
  );

  const sorted = [...results].sort((a, b) => a - b);
  const unique = new Set(results);
  const expected = Array.from({ length: N }, (_, i) => expectedStart + i);
  console.log(`   ${label} 分配结果: [${sorted.join(', ')}]`);
  assert(unique.size === N, `${label}: seq 无重复（${unique.size}/${N}）`);
  assert(JSON.stringify(sorted) === JSON.stringify(expected), `${label}: seq 无空洞且连续 [${expectedStart}..${expectedStart + N - 1}]`);
  return N;
}

async function main() {
  const userId = randomUUID();
  const email = `seqtest_${Date.now()}@tickflow.test`;
  await prisma.user.create({ data: { id: userId, email, passwordHash: 'x', displayName: 'seq-test' } });
  await prisma.userSetting.create({ data: { userId, seq: 0n } });
  await prisma.list.create({ data: { userId, name: '收件箱', isInbox: true, seq: 0n } });
  await prisma.userSyncState.create({ data: { userId, seq: 0n } });

  try {
    await runBatch(userId, 'batch1', 1);
    await runBatch(userId, 'batch2', N + 1);

    const state = await prisma.userSyncState.findUnique({ where: { userId } });
    assert(Number(state.seq) === 2 * N, `user_sync_state.seq 归位为 ${2 * N}`);
    const count = await prisma.task.count({ where: { userId } });
    assert(count === 2 * N, `实际写入 ${2 * N} 条任务`);
    const tasks = await prisma.task.findMany({ where: { userId }, select: { seq: true } });
    const seqs = tasks.map((t) => Number(t.seq)).sort((a, b) => a - b);
    const contiguous = seqs.every((s, i) => s === i + 1);
    assert(contiguous, 'DB 中全部任务 seq 连续无空洞');

    console.log('\n并发 seq 测试完成');
  } finally {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});