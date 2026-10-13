import { Injectable } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';
import { getInboxListId } from '../org/folders.service';
import { TaskCreateDto, TaskQueryDto, TaskUpdateDto } from './tasks.dto';

type Tx = Prisma.TransactionClient;

export function taskDto(t: Task & { tags?: { tagId: string }[] }) {
  const { tags, ...rest } = t;
  return { ...rest, tagIds: (tags ?? []).map((x) => x.tagId) };
}

async function collectDescendants(tx: Tx, userId: string, rootId: string): Promise<string[]> {
  const all: string[] = [rootId];
  let frontier: string[] = [rootId];
  while (frontier.length) {
    const children = await tx.task.findMany({
      where: { userId, parentId: { in: frontier } },
      select: { id: true },
    });
    const ids = children.map((c) => c.id).filter((cid) => !all.includes(cid));
    if (ids.length === 0) break;
    all.push(...ids);
    frontier = ids;
  }
  return all;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: TaskQueryDto) {
    const where: Prisma.TaskWhereInput = { userId, deletedAt: null };
    if (query.listId) where.listId = query.listId;
    if (query.parentId) where.parentId = query.parentId;
    if (query.topLevel) where.parentId = null;
    if (query.status !== undefined) where.status = query.status;
    if (query.priority !== undefined) where.priority = query.priority;
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };
    if (query.q) {
      where.OR = [{ title: { contains: query.q, mode: 'insensitive' } }, { notes: { contains: query.q, mode: 'insensitive' } }];
    }
    if (query.from || query.to) {
      const range: Prisma.DateTimeNullableFilter = {};
      if (query.from) range.gte = query.from;
      if (query.to) range.lte = query.to;
      where.AND = [{ OR: [{ dueDate: range }, { nextDueDate: range }] }];
    }

    const limit = query.limit ?? 100;
    const items = await this.prisma.task.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { tags: { select: { tagId: true } } },
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return { items: page.map(taskDto), nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  private async readTask(tx: Tx, userId: string, id: string) {
    const task = await tx.task.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        tags: { select: { tagId: true } },
        children: { where: { deletedAt: null }, include: { tags: { select: { tagId: true } } } },
      },
    });
    if (!task) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
    const { children, ...rest } = task;
    return { ...taskDto(rest as Task & { tags: { tagId: string }[] }), subtasks: children.map((c) => taskDto(c)) };
  }

  async get(userId: string, id: string) {
    return this.readTask(this.prisma as unknown as Tx, userId, id);
  }

  private async resolveListId(tx: Tx, userId: string, listId: string | null | undefined): Promise<string> {
    if (listId) {
      const list = await tx.list.findFirst({ where: { id: listId, userId, deletedAt: null } });
      if (!list) throw AppException.notFound('清单不存在', 'LIST_NOT_FOUND');
      return list.id;
    }
    return getInboxListId(tx, userId);
  }

  private async nextSortOrder(tx: Tx, userId: string, listId: string, parentId: string | null): Promise<bigint> {
    const max = await tx.task.aggregate({
      where: { userId, listId, parentId, deletedAt: null },
      _max: { sortOrder: true },
    });
    return BigInt(max._max.sortOrder ?? 0n) + 1024n;
  }

  async create(userId: string, dto: TaskCreateDto) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const listId = await this.resolveListId(tx, userId, dto.listId);
      let parentId: string | null = null;
      if (dto.parentId) {
        const parent = await tx.task.findFirst({ where: { id: dto.parentId, userId, deletedAt: null } });
        if (!parent) throw AppException.notFound('父任务不存在', 'PARENT_NOT_FOUND');
        parentId = parent.id;
      }
      const sortOrder = dto.sortOrder !== undefined ? BigInt(dto.sortOrder) : await this.nextSortOrder(tx, userId, listId, parentId);
      const now = new Date();
      const task = await tx.task.create({
        data: {
          userId,
          listId,
          parentId,
          title: dto.title,
          notes: dto.notes ?? null,
          priority: dto.priority ?? 0,
          status: dto.status ?? 0,
          completedAt: dto.completedAt ?? null,
          dueDate: dto.dueDate ?? null,
          isAllDay: dto.isAllDay ?? false,
          startDate: dto.startDate ?? null,
          timezone: dto.timezone ?? null,
          recurrenceRule: dto.recurrenceRule ?? null,
          recurrenceTz: dto.recurrenceTz ?? null,
          recurrenceDtstart: dto.recurrenceDtstart ?? null,
          recurrenceEnd: dto.recurrenceEnd ?? null,
          repeatFrom: dto.repeatFrom ?? 0,
          nextDueDate: dto.nextDueDate ?? null,
          reminders: dto.reminders == null ? undefined : (dto.reminders as Prisma.InputJsonValue),
          reminderRepeatMinutes: dto.reminderRepeatMinutes ?? null,
          checklist: dto.checklist == null ? undefined : (dto.checklist as Prisma.InputJsonValue),
          sortOrder,
          seq: BigInt(alloc()),
          lwwAt: now,
          lwwDevice: SERVER_DEVICE,
        },
      });

      if (dto.tagIds?.length) {
        await this.replaceTags(tx, userId, task.id, dto.tagIds);
      }
      for (const sub of dto.subtasks ?? []) {
        await tx.task.create({
          data: {
            userId,
            listId,
            parentId: task.id,
            title: sub.title,
            priority: sub.priority ?? 0,
            sortOrder: await this.nextSortOrder(tx, userId, listId, task.id),
            seq: BigInt(alloc()),
            lwwAt: now,
            lwwDevice: SERVER_DEVICE,
          },
        });
      }
      return this.readTask(tx, userId, task.id);
    });
  }

  private async replaceTags(tx: Tx, userId: string, taskId: string, tagIds: string[]): Promise<void> {
    await tx.taskTag.deleteMany({ where: { userId, taskId } });
    const unique = [...new Set(tagIds)];
    if (unique.length === 0) return;
    const valid = await tx.tag.findMany({ where: { userId, id: { in: unique }, deletedAt: null }, select: { id: true } });
    const rows = valid.map((t) => ({ taskId, tagId: t.id, userId }));
    if (rows.length) await tx.taskTag.createMany({ data: rows, skipDuplicates: true });
  }

  async update(userId: string, id: string, dto: TaskUpdateDto) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const existing = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!existing) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      const data: Prisma.TaskUncheckedUpdateInput = { seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE };

      if (dto.title !== undefined) data.title = dto.title;
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.priority !== undefined) data.priority = dto.priority;
      if (dto.dueDate !== undefined) data.dueDate = dto.dueDate;
      if (dto.isAllDay !== undefined) data.isAllDay = dto.isAllDay;
      if (dto.startDate !== undefined) data.startDate = dto.startDate;
      if (dto.timezone !== undefined) data.timezone = dto.timezone;
      if (dto.recurrenceRule !== undefined) data.recurrenceRule = dto.recurrenceRule;
      if (dto.recurrenceTz !== undefined) data.recurrenceTz = dto.recurrenceTz;
      if (dto.recurrenceDtstart !== undefined) data.recurrenceDtstart = dto.recurrenceDtstart;
      if (dto.recurrenceEnd !== undefined) data.recurrenceEnd = dto.recurrenceEnd;
      if (dto.repeatFrom !== undefined) data.repeatFrom = dto.repeatFrom;
      if (dto.nextDueDate !== undefined) data.nextDueDate = dto.nextDueDate;
      if (dto.reminderRepeatMinutes !== undefined) data.reminderRepeatMinutes = dto.reminderRepeatMinutes;
      if (dto.reminders !== undefined) data.reminders = dto.reminders === null ? Prisma.DbNull : (dto.reminders as Prisma.InputJsonValue);
      if (dto.checklist !== undefined) data.checklist = dto.checklist === null ? Prisma.DbNull : (dto.checklist as Prisma.InputJsonValue);
      if (dto.sortOrder !== undefined) data.sortOrder = BigInt(dto.sortOrder);
      if (dto.listId !== undefined) data.listId = await this.resolveListId(tx, userId, dto.listId);
      if (dto.parentId !== undefined) {
        if (dto.parentId === null) {
          data.parentId = null;
        } else {
          const parent = await tx.task.findFirst({ where: { id: dto.parentId, userId, deletedAt: null } });
          if (!parent) throw AppException.notFound('父任务不存在', 'PARENT_NOT_FOUND');
          data.parentId = parent.id;
        }
      }
      if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === 2) {
          data.completedAt = dto.completedAt ?? new Date();
        } else {
          data.completedAt = null;
        }
      } else if (dto.completedAt !== undefined) {
        data.completedAt = dto.completedAt;
      }

      await tx.task.update({ where: { id }, data });
      if (dto.tagIds !== undefined) {
        await this.replaceTags(tx, userId, id, dto.tagIds);
      }
      return this.readTask(tx, userId, id);
    });
  }

  async remove(userId: string, id: string, hard = false) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const existing = await tx.task.findFirst({ where: { id, userId } });
      if (!existing) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      if (hard) {
        const ids = await collectDescendants(tx, userId, id);
        await tx.taskTag.deleteMany({ where: { userId, taskId: { in: ids } } });
        await tx.task.deleteMany({ where: { userId, id: { in: ids } } });
        return { ok: true, hard: true, removed: ids.length };
      }
      const ids = await collectDescendants(tx, userId, id);
      const now = new Date();
      await tx.task.updateMany({
        where: { userId, id: { in: ids } },
        data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      return { ok: true, removed: ids.length };
    });
  }

  async complete(userId: string, id: string) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const task = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!task) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      const now = new Date();
      await tx.task.update({
        where: { id },
        data: { status: 2, completedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      if (task.recurrenceRule) {
        const occurrenceDate = task.nextDueDate ?? task.dueDate ?? now;
        await tx.taskOccurrence.upsert({
          where: { taskId_occurrenceDate: { taskId: id, occurrenceDate } },
          create: { userId, taskId: id, occurrenceDate, completedAt: now },
          update: { completedAt: now },
        });
      }
      return this.readTask(tx, userId, id);
    });
  }

  async uncomplete(userId: string, id: string) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const task = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!task) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      await tx.task.update({
        where: { id },
        data: { status: 0, completedAt: null, seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE },
      });
      return this.readTask(tx, userId, id);
    });
  }

  async move(userId: string, id: string, listId: string, sortOrder?: number) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const task = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!task) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      const target = await this.resolveListId(tx, userId, listId);
      const order =
        sortOrder !== undefined ? BigInt(sortOrder) : await this.nextSortOrder(tx, userId, target, task.parentId);
      await tx.task.update({
        where: { id },
        data: { listId: target, sortOrder: order, seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE },
      });
      return this.readTask(tx, userId, id);
    });
  }

  async reorder(userId: string, listId: string, parentId: string | null, orderedIds: string[]) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      await this.resolveListId(tx, userId, listId);
      const now = new Date();
      for (let i = 0; i < orderedIds.length; i += 1) {
        const updated = await tx.task.updateMany({
          where: { id: orderedIds[i], userId, deletedAt: null },
          data: { listId, parentId, sortOrder: BigInt(i) * 1024n, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        if (updated.count === 0) throw AppException.notFound(`任务不存在: ${orderedIds[i]}`, 'TASK_NOT_FOUND');
      }
      return { ok: true };
    });
  }

  async replaceChecklist(userId: string, id: string, checklist: unknown[]) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const task = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!task) throw AppException.notFound('任务不存在', 'TASK_NOT_FOUND');
      await tx.task.update({
        where: { id },
        data: { checklist: checklist as Prisma.InputJsonValue, seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE },
      });
      return this.readTask(tx, userId, id);
    });
  }

  async batch(
    userId: string,
    ids: string[],
    action: 'complete' | 'delete' | 'move' | 'priority' | 'addTag',
    payload?: { listId?: string; priority?: number; tagId?: string },
  ) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const now = new Date();
      let affected = 0;
      if (action === 'complete') {
        const r = await tx.task.updateMany({
          where: { userId, id: { in: ids }, deletedAt: null },
          data: { status: 2, completedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        affected = r.count;
      } else if (action === 'delete') {
        const r = await tx.task.updateMany({
          where: { userId, id: { in: ids }, deletedAt: null },
          data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        affected = r.count;
      } else if (action === 'move') {
        if (!payload?.listId) throw AppException.badRequest('缺少 listId', 'MISSING_LIST');
        const listId = await this.resolveListId(tx, userId, payload.listId);
        const r = await tx.task.updateMany({
          where: { userId, id: { in: ids }, deletedAt: null },
          data: { listId, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        affected = r.count;
      } else if (action === 'priority') {
        if (payload?.priority === undefined) throw AppException.badRequest('缺少 priority', 'MISSING_PRIORITY');
        const r = await tx.task.updateMany({
          where: { userId, id: { in: ids }, deletedAt: null },
          data: { priority: payload.priority, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
        affected = r.count;
      } else if (action === 'addTag') {
        if (!payload?.tagId) throw AppException.badRequest('缺少 tagId', 'MISSING_TAG');
        const tag = await tx.tag.findFirst({ where: { id: payload.tagId, userId, deletedAt: null } });
        if (!tag) throw AppException.notFound('标签不存在', 'TAG_NOT_FOUND');
        const tasks = await tx.task.findMany({ where: { userId, id: { in: ids }, deletedAt: null }, select: { id: true } });
        await tx.taskTag.createMany({
          data: tasks.map((t) => ({ taskId: t.id, tagId: tag.id, userId })),
          skipDuplicates: true,
        });
        for (const t of tasks) {
          await tx.task.update({
            where: { id: t.id },
            data: { seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
          });
        }
        affected = tasks.length;
      }
      return { ok: true, affected };
    });
  }

  async trash(userId: string) {
    const items = await this.prisma.task.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 500,
      include: { tags: { select: { tagId: true } } },
    });
    return { items: items.map(taskDto) };
  }

  async emptyTrash(userId: string) {
    return withSync(this.prisma, userId, async (tx) => {
      const r = await tx.task.deleteMany({ where: { userId, deletedAt: { not: null } } });
      return { ok: true, removed: r.count };
    });
  }
}