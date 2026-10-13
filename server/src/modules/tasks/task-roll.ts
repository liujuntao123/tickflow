import { Prisma } from '@prisma/client';
import { nextOccurrenceAfter, occurrenceAtOrBefore } from '../../common/recurrence';

/** 参与滚动的任务字段（REST 与 /sync 推送共用）。 */
export interface RollableTask {
  id: string;
  recurrenceRule: string | null;
  recurrenceDtstart: Date | null;
  dueDate: Date | null;
  nextDueDate: Date | null;
  repeatFrom: number;
  createdAt: Date;
}

export interface RollOptions {
  tx: Prisma.TransactionClient;
  userId: string;
  task: RollableTask;
  alloc: () => number;
  lwwAt: Date;
  lwwDevice: string;
}

export interface RollResult {
  rolled: boolean;
  next: Date | null;
}

/**
 * 重复任务完成滚动（服务端权威，REST complete 与 /sync 推送共用同一段逻辑）：
 * base = repeatFrom==0 ? (nextDueDate ?? dueDate ?? now) : now；
 * 求 base 之后第一个 occurrence next（受 COUNT/UNTIL 限制）：
 *  - 有 next：写 task_occurrences(occurrenceDate=base 所在那次) + status=0 + dueDate/nextDueDate=next +
 *    completedAt=null，子任务按同一 next 一并滚动，各分配新 seq；
 *  - 无 next（规则终态）：不滚动，由调用方按普通完成处理。
 */
export async function rollRecurringTask(opts: RollOptions): Promise<RollResult> {
  const { tx, userId, task, alloc, lwwAt, lwwDevice } = opts;
  if (!task.recurrenceRule) return { rolled: false, next: null };

  const dtstart = task.recurrenceDtstart ?? task.dueDate ?? task.createdAt;
  const base = task.repeatFrom === 1 ? lwwAt : (task.nextDueDate ?? task.dueDate ?? lwwAt);
  let next: Date | null = null;
  let occurrence: Date = base;
  try {
    next = nextOccurrenceAfter(task.recurrenceRule, dtstart, base);
    occurrence = occurrenceAtOrBefore(task.recurrenceRule, dtstart, base) ?? base;
  } catch {
    next = null;
  }
  if (!next) return { rolled: false, next: null };

  await tx.taskOccurrence.upsert({
    where: { taskId_occurrenceDate: { taskId: task.id, occurrenceDate: occurrence } },
    create: { userId, taskId: task.id, occurrenceDate: occurrence, completedAt: lwwAt },
    update: { completedAt: lwwAt },
  });

  const rolledData = {
    status: 0,
    dueDate: next,
    nextDueDate: next,
    completedAt: null,
    lwwAt,
    lwwDevice,
  };
  await tx.task.update({ where: { id: task.id }, data: { ...rolledData, seq: BigInt(alloc()) } });

  const children = await tx.task.findMany({ where: { userId, parentId: task.id, deletedAt: null } });
  for (const child of children) {
    await tx.task.update({ where: { id: child.id }, data: { ...rolledData, seq: BigInt(alloc()) } });
  }
  return { rolled: true, next };
}