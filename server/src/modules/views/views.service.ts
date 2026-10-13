import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { expandOccurrences } from '../../common/recurrence';

export interface DayBoundaries {
  tz: string;
  dayStartHour: number;
  todayStart: Date;
  tomorrowStart: Date;
  dayAfterStart: Date;
  next7End: Date;
}

export function localDate(tz: string, date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const PRIORITY_LABELS: Record<number, string> = { 0: '无优先级', 1: '低', 3: '中', 5: '高' };

@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async boundaries(userId: string): Promise<DayBoundaries> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.notFound('用户不存在', 'USER_NOT_FOUND');
    const settings = await this.prisma.userSetting.findUnique({ where: { userId } });
    const tz = user.timezone || 'Asia/Shanghai';
    const dayStartHour = settings?.dayStartHour ?? 0;

    const rows = await this.prisma.$queryRaw<{ today_start: Date }[]>`
      SELECT ((CASE
        WHEN (now() AT TIME ZONE ${tz}) < (date_trunc('day', now() AT TIME ZONE ${tz}) + make_interval(hours => ${dayStartHour}::int))
        THEN date_trunc('day', now() AT TIME ZONE ${tz}) + make_interval(hours => ${dayStartHour}::int) - interval '1 day'
        ELSE date_trunc('day', now() AT TIME ZONE ${tz}) + make_interval(hours => ${dayStartHour}::int)
      END) AT TIME ZONE ${tz}) AS today_start`;

    const todayStart = rows[0].today_start;
    const DAY = 24 * 60 * 60 * 1000;
    return {
      tz,
      dayStartHour,
      todayStart,
      tomorrowStart: new Date(todayStart.getTime() + DAY),
      dayAfterStart: new Date(todayStart.getTime() + 2 * DAY),
      next7End: new Date(todayStart.getTime() + 7 * DAY),
    };
  }

  /** 有效到期 = COALESCE(next_due_date, due_date) 的区间谓词。 */
  private effRange(gte: Date | null, lt: Date | null): Prisma.TaskWhereInput {
    const filters: Prisma.TaskWhereInput[] = [];
    const nextFilter: Prisma.DateTimeNullableFilter = { not: null };
    const dueFilter: Prisma.DateTimeNullableFilter = { not: null };
    if (gte) {
      nextFilter.gte = gte;
      dueFilter.gte = gte;
    }
    if (lt) {
      nextFilter.lt = lt;
      dueFilter.lt = lt;
    }
    filters.push({ nextDueDate: nextFilter });
    filters.push({ nextDueDate: null, dueDate: dueFilter });
    return { OR: filters };
  }

  private async inboxListId(userId: string): Promise<string> {
    const inbox = await this.prisma.list.findFirst({ where: { userId, isInbox: true, deletedAt: null } });
    if (!inbox) throw AppException.notFound('收件箱不存在', 'INBOX_MISSING');
    return inbox.id;
  }

  private async fetchTasks(userId: string, where: Prisma.TaskWhereInput, orderBy?: Prisma.TaskOrderByWithRelationInput[], take?: number) {
    return this.prisma.task.findMany({
      where: { userId, deletedAt: null, ...where },
      include: { tags: { select: { tagId: true } } },
      orderBy: orderBy ?? [{ sortOrder: 'asc' }, { id: 'asc' }],
      ...(take ? { take } : {}),
    });
  }

  private toDto<T extends { tags?: { tagId: string }[] }>(t: T): Record<string, unknown> {
    const { tags, ...rest } = t;
    return { ...(rest as Record<string, unknown>), tagIds: (tags ?? []).map((x) => x.tagId) };
  }

  async counts(userId: string) {
    const b = await this.boundaries(userId);
    const inboxId = await this.inboxListId(userId);
    const [inbox, today, tomorrow, next7] = await Promise.all([
      this.prisma.task.count({ where: { userId, deletedAt: null, status: 0, listId: inboxId } }),
      this.prisma.task.count({ where: { userId, deletedAt: null, status: 0, ...this.effRange(null, b.tomorrowStart) } }),
      this.prisma.task.count({
        where: { userId, deletedAt: null, status: 0, ...this.effRange(b.tomorrowStart, b.dayAfterStart) },
      }),
      this.prisma.task.count({ where: { userId, deletedAt: null, status: 0, ...this.effRange(b.todayStart, b.next7End) } }),
    ]);
    return { inbox, today, tomorrow, next7 };
  }

  async view(userId: string, key: string, groupBy?: string) {
    const b = await this.boundaries(userId);
    let tasks: Record<string, unknown>[] = [];
    const group = groupBy ?? (key === 'completed' ? 'date' : key === 'matrix' ? 'quadrant' : 'list');

    if (key === 'inbox') {
      const inboxId = await this.inboxListId(userId);
      tasks = (await this.fetchTasks(userId, { status: 0, listId: inboxId })).map((t) => this.toDto(t));
    } else if (key === 'today') {
      tasks = (await this.fetchTasks(userId, { status: 0, ...this.effRange(null, b.tomorrowStart) })).map((t) => this.toDto(t));
    } else if (key === 'tomorrow') {
      tasks = (await this.fetchTasks(userId, { status: 0, ...this.effRange(b.tomorrowStart, b.dayAfterStart) })).map((t) => this.toDto(t));
    } else if (key === 'next7') {
      tasks = (await this.fetchTasks(userId, { status: 0, ...this.effRange(b.todayStart, b.next7End) })).map((t) => this.toDto(t));
    } else if (key === 'all') {
      tasks = (await this.fetchTasks(userId, { status: 0 })).map((t) => this.toDto(t));
    } else if (key === 'completed') {
      tasks = (await this.fetchTasks(userId, { status: 2 }, [{ completedAt: 'desc' }], 200)).map((t) => this.toDto(t));
    } else if (key === 'matrix') {
      tasks = (await this.fetchTasks(userId, { status: 0 })).map((t) => this.toDto(t));
    } else {
      throw AppException.badRequest(`未知的智能清单: ${key}`, 'UNKNOWN_VIEW');
    }

    const groups = await this.buildGroups(userId, b, group, tasks);
    return { key, groupBy: group, groups };
  }

  private async buildGroups(
    userId: string,
    b: DayBoundaries,
    group: string,
    tasks: Record<string, unknown>[],
  ): Promise<{ key: string; label: string; tasks: Record<string, unknown>[] }[]> {
    const buckets = new Map<string, { label: string; tasks: Record<string, unknown>[] }>();

    if (group === 'list') {
      const lists = await this.prisma.list.findMany({ where: { userId, deletedAt: null } });
      const nameOf = new Map(lists.map((l) => [l.id, l.isInbox ? '收件箱' : l.name]));
      for (const t of tasks) {
        const id = (t.listId as string | null) ?? '__none__';
        const label = id === '__none__' ? '无清单' : nameOf.get(id) ?? '已删除清单';
        const bucket = buckets.get(id) ?? { label, tasks: [] };
        bucket.tasks.push(t);
        buckets.set(id, bucket);
      }
    } else if (group === 'date') {
      for (const t of tasks) {
        const due = (t.nextDueDate ?? t.dueDate) as Date | null;
        const key = due ? localDate(b.tz, new Date(due)) : '__none__';
        const label = due ? key : '无日期';
        const bucket = buckets.get(key) ?? { label, tasks: [] };
        bucket.tasks.push(t);
        buckets.set(key, bucket);
      }
    } else if (group === 'priority') {
      for (const t of tasks) {
        const p = (t.priority as number) ?? 0;
        const key = String(p);
        const bucket = buckets.get(key) ?? { label: PRIORITY_LABELS[p] ?? `优先级 ${p}`, tasks: [] };
        bucket.tasks.push(t);
        buckets.set(key, bucket);
      }
    } else if (group === 'quadrant') {
      for (const t of tasks) {
        const p = (t.priority as number) ?? 0;
        const due = (t.nextDueDate ?? t.dueDate) as Date | null;
        const important = p === 3 || p === 5;
        const urgent = due ? new Date(due).getTime() < b.dayAfterStart.getTime() : false;
        const q = important && urgent ? 'q1' : important ? 'q2' : urgent ? 'q3' : 'q4';
        const label = q === 'q1' ? '重要且紧急' : q === 'q2' ? '重要不紧急' : q === 'q3' ? '紧急不重要' : '不重要不紧急';
        const bucket = buckets.get(q) ?? { label, tasks: [] };
        bucket.tasks.push(t);
        buckets.set(q, bucket);
      }
    } else {
      throw AppException.badRequest(`未知的分组方式: ${group}`, 'UNKNOWN_GROUP');
    }

    return [...buckets.entries()]
      .map(([key, v]) => ({ key, label: v.label, tasks: v.tasks }))
      .sort((a, b2) => a.key.localeCompare(b2.key));
  }

  async calendar(userId: string, from?: Date, to?: Date) {
    const b = await this.boundaries(userId);
    const MAX_DAYS = 92;
    const DAY = 24 * 60 * 60 * 1000;
    const start = from ?? b.todayStart;
    const end = to ?? new Date(start.getTime() + 31 * DAY);
    if (end.getTime() <= start.getTime()) throw AppException.badRequest('to 必须晚于 from', 'INVALID_RANGE');
    if (end.getTime() - start.getTime() > MAX_DAYS * DAY) {
      throw AppException.badRequest('时间窗口不得超过 92 天', 'RANGE_TOO_LARGE');
    }

    const buckets = new Map<string, Record<string, unknown>[]>();
    const push = (key: string, item: Record<string, unknown>) => {
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    };

    // 非重复任务：dueDate 落在窗口内 → 出现一次
    const simple = await this.prisma.task.findMany({
      where: { userId, deletedAt: null, recurrenceRule: null, dueDate: { gte: start, lt: end } },
      include: { tags: { select: { tagId: true } } },
    });
    for (const t of simple) {
      const key = localDate(b.tz, t.dueDate as Date);
      push(key, { ...this.toDto(t), occurrenceDate: key, completed: t.status === 2 });
    }

    // 重复任务：以 recurrenceDtstart 为锚展开（受 UNTIL/COUNT 限制）
    const recurring = await this.prisma.task.findMany({
      where: { userId, deletedAt: null, recurrenceRule: { not: null } },
      include: { tags: { select: { tagId: true } } },
    });
    if (recurring.length > 0) {
      const occs = await this.prisma.taskOccurrence.findMany({
        where: { userId, taskId: { in: recurring.map((t) => t.id) } },
      });
      const doneSet = new Set(occs.map((o) => `${o.taskId}:${localDate(b.tz, o.occurrenceDate)}`));
      for (const t of recurring) {
        const rule = t.recurrenceRule as string;
        const dtstart = (t.recurrenceDtstart ?? t.dueDate ?? t.createdAt) as Date;
        let dates: Date[] = [];
        try {
          dates = expandOccurrences(rule, dtstart, start, end);
        } catch {
          dates = [];
        }
        for (const d of dates) {
          const key = localDate(b.tz, d);
          push(key, { ...this.toDto(t), occurrenceDate: key, completed: doneSet.has(`${t.id}:${key}`) });
        }
      }
    }

    const days = [...buckets.entries()]
      .map(([date, list]) => ({ date, tasks: list }))
      .sort((a, b2) => a.date.localeCompare(b2.date));
    return { from: start.toISOString(), to: end.toISOString(), days };
  }
}