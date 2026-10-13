import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AppException } from '../errors';

export type SyncTx = Prisma.TransactionClient;
export type SeqAllocator = () => number;

/**
 * 同步写路径唯一入口。
 *
 * 核心不变量：在事务**开头**对 user_sync_state 行 `SELECT ... FOR UPDATE` 加锁，
 * 事务内所有写操作通过 alloc() 依次取得递增 seq，事务结束时一次性推进计数器。
 * 由此保证「seq 分配顺序 == 事务提交顺序」，客户端游标无空洞、无重复。
 */
export async function withSync<T>(
  prisma: PrismaService,
  userId: string,
  fn: (tx: SyncTx, alloc: SeqAllocator) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT seq FROM user_sync_state WHERE user_id = ${userId}::uuid FOR UPDATE`;
      const state = await tx.userSyncState.findUnique({ where: { userId } });
      if (!state) {
        throw AppException.notFound('同步状态不存在', 'SYNC_STATE_MISSING');
      }
      let seq = Number(state.seq);
      const alloc: SeqAllocator = () => ++seq;
      const result = await fn(tx, alloc);
      await tx.userSyncState.update({ where: { userId }, data: { seq: BigInt(seq) } });
      return result;
    },
    { timeout: 30000, maxWait: 30000 },
  );
}