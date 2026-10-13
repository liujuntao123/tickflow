import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';

function localDate(tz: string, date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

@Injectable()
export class FocusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: { taskId?: string | null; mode?: number; plannedSeconds: number; note?: string | null }) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      if (dto.taskId) {
        const task = await tx.task.findFirst({ where: { id: dto.taskId, userId, deletedAt: null } });
        if (!task) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      }
      return tx.focusSession.create({
        data: {
          userId,
          taskId: dto.taskId ?? null,
          mode: dto.mode ?? 0,
          plannedSeconds: dto.plannedSeconds,
          startedAt: new Date(),
          note: dto.note ?? null,
          status: 0,
          seq: BigInt(alloc()),
          lwwAt: new Date(),
          lwwDevice: SERVER_DEVICE,
        },
      });
    });
  }

  async patch(userId: string, id: string, dto: { action: 'pause' | 'resume' | 'complete' | 'cancel'; actualSeconds?: number; breakSeconds?: number }) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const session = await tx.focusSession.findFirst({ where: { id, userId, deletedAt: null } });
      if (!session) throw AppException.notFound('专注会话不存在', 'FOCUS_NOT_FOUND');
      const now = new Date();
      const data: Record<string, unknown> = { seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE };

      if (dto.action === 'pause') {
        if (session.status !== 0) throw AppException.badRequest('仅进行中的会话可暂停', 'INVALID_STATE');
        data.status = 1;
        data.pauseCount = session.pauseCount + 1;
      } else if (dto.action === 'resume') {
        if (session.status !== 1) throw AppException.badRequest('仅暂停中的会话可恢复', 'INVALID_STATE');
        data.status = 0;
      } else if (dto.action === 'complete') {
        if (session.status === 2 || session.status === 3) throw AppException.badRequest('会话已结束', 'INVALID_STATE');
        const elapsed = Math.round((now.getTime() - session.startedAt.getTime()) / 1000);
        data.status = 2;
        data.endedAt = now;
        data.actualSeconds = dto.actualSeconds ?? Math.max(0, elapsed);
        if (dto.breakSeconds !== undefined) data.breakSeconds = dto.breakSeconds;
      } else if (dto.action === 'cancel') {
        if (session.status === 2 || session.status === 3) throw AppException.badRequest('会话已结束', 'INVALID_STATE');
        data.status = 3;
        data.endedAt = now;
        data.interrupted = true;
        if (dto.actualSeconds !== undefined) data.actualSeconds = dto.actualSeconds;
      }
      return tx.focusSession.update({ where: { id }, data });
    });
  }

  async current(userId: string) {
    return this.prisma.focusSession.findFirst({
      where: { userId, deletedAt: null, status: { in: [0, 1] } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async stats(userId: string, from?: Date, to?: Date) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const tz = user?.timezone || 'Asia/Shanghai';
    const start = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = to ?? new Date();

    const sessions = await this.prisma.focusSession.findMany({
      where: { userId, deletedAt: null, status: 2, startedAt: { gte: start, lte: end } },
      orderBy: { startedAt: 'asc' },
    });

    const buckets = new Map<string, { totalSeconds: number; count: number }>();
    let totalSeconds = 0;
    for (const s of sessions) {
      totalSeconds += s.actualSeconds;
      const key = localDate(tz, s.startedAt);
      const bucket = buckets.get(key) ?? { totalSeconds: 0, count: 0 };
      bucket.totalSeconds += s.actualSeconds;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    const byDay = [...buckets.entries()]
      .map(([date, v]) => ({ date, totalSeconds: v.totalSeconds, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalSeconds, sessionCount: sessions.length, byDay };
  }
}