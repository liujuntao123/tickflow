import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { withSync, SyncTx } from '../../common/sync/seq-allocator';
import { clampIncoming, lwwWins, storedLww } from '../../common/sync/lww';
import { localDate } from '../views/views.service';
import { SyncDto } from './sync.dto';

type FieldKind = 'raw' | 'date' | 'bigint' | 'json';

interface ModelSpec {
  key: SyncKey;
  delegate: string;
  idField: 'id' | 'userId';
  fields: Record<string, FieldKind>;
}

export type SyncKey = 'folders' | 'lists' | 'tags' | 'tasks' | 'habits' | 'habitRecords' | 'focusSessions';
export type SyncEntityKey = SyncKey | 'settings';

const SPECS: Record<SyncKey, ModelSpec> = {
  folders: { key: 'folders', delegate: 'folder', idField: 'id', fields: { name: 'raw', color: 'raw', sortOrder: 'bigint' } },
  lists: {
    key: 'lists',
    delegate: 'list',
    idField: 'id',
    fields: {
      folderId: 'raw',
      name: 'raw',
      color: 'raw',
      icon: 'raw',
      isInbox: 'raw',
      isArchived: 'raw',
      sortOrder: 'bigint',
    },
  },
  tags: { key: 'tags', delegate: 'tag', idField: 'id', fields: { name: 'raw', color: 'raw', sortOrder: 'bigint' } },
  tasks: {
    key: 'tasks',
    delegate: 'task',
    idField: 'id',
    fields: {
      listId: 'raw',
      parentId: 'raw',
      title: 'raw',
      notes: 'raw',
      priority: 'raw',
      status: 'raw',
      completedAt: 'date',
      dueDate: 'date',
      isAllDay: 'raw',
      startDate: 'date',
      timezone: 'raw',
      recurrenceRule: 'raw',
      recurrenceTz: 'raw',
      recurrenceDtstart: 'date',
      recurrenceEnd: 'date',
      repeatFrom: 'raw',
      nextDueDate: 'date',
      reminders: 'json',
      reminderRepeatMinutes: 'raw',
      checklist: 'json',
      sortOrder: 'bigint',
    },
  },
  habits: {
    key: 'habits',
    delegate: 'habit',
    idField: 'id',
    fields: {
      name: 'raw',
      icon: 'raw',
      color: 'raw',
      goalType: 'raw',
      targetValue: 'raw',
      unit: 'raw',
      frequency: 'raw',
      weekDays: 'raw',
      repeatRule: 'raw',
      startDate: 'date',
      reminders: 'json',
      archived: 'raw',
      sortOrder: 'bigint',
    },
  },
  habitRecords: {
    key: 'habitRecords',
    delegate: 'habitRecord',
    idField: 'id',
    fields: { habitId: 'raw', date: 'date', value: 'raw', note: 'raw' },
  },
  focusSessions: {
    key: 'focusSessions',
    delegate: 'focusSession',
    idField: 'id',
    fields: {
      taskId: 'raw',
      mode: 'raw',
      plannedSeconds: 'raw',
      startedAt: 'date',
      endedAt: 'date',
      actualSeconds: 'raw',
      breakSeconds: 'raw',
      pauseCount: 'raw',
      status: 'raw',
      interrupted: 'raw',
      note: 'raw',
    },
  },
};

const SETTINGS_FIELDS: Record<string, FieldKind> = {
  theme: 'raw',
  weekStart: 'raw',
  dayStartHour: 'raw',
  dateFormat: 'raw',
  modulePomodoro: 'raw',
  moduleHabits: 'raw',
  moduleMatrix: 'raw',
  moduleCalendar: 'raw',
  smartListsVisible: 'raw',
  defaultListId: 'raw',
  defaultPriority: 'raw',
  defaultReminderOffset: 'raw',
  focusSettings: 'json',
};

const TOMBSTONE_TYPE_MAP: Record<string, SyncEntityKey> = {
  folder: 'folders',
  folders: 'folders',
  list: 'lists',
  lists: 'lists',
  tag: 'tags',
  tags: 'tags',
  task: 'tasks',
  tasks: 'tasks',
  habit: 'habits',
  habits: 'habits',
  habitRecord: 'habitRecords',
  habitRecords: 'habitRecords',
  focusSession: 'focusSessions',
  focusSessions: 'focusSessions',
  setting: 'settings',
  settings: 'settings',
};

interface PullBuckets {
  alive: Record<string, unknown>[];
  dead: Record<string, unknown>[];
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  private convert(value: unknown, kind: FieldKind): unknown {
    if (value === null) {
      if (kind === 'json') return Prisma.DbNull;
      return null;
    }
    if (value === undefined) return undefined;
    switch (kind) {
      case 'date': {
        const d = value instanceof Date ? value : new Date(value as string);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      case 'bigint':
        return BigInt(value as number | string);
      default:
        return value;
    }
  }

  private buildData(input: Record<string, unknown>, fields: Record<string, FieldKind>, extra: Record<string, unknown> = {}) {
    const data: Record<string, unknown> = { ...extra };
    for (const [field, kind] of Object.entries(fields)) {
      if (input[field] === undefined) continue;
      data[field] = this.convert(input[field], kind);
    }
    return data;
  }

  private delegate(tx: SyncTx, name: string): any {
    return (tx as unknown as Record<string, any>)[name];
  }

  private async writeEntity(
    tx: SyncTx,
    userId: string,
    deviceId: string,
    spec: ModelSpec,
    input: Record<string, unknown>,
    alloc: () => number,
    applied: { type: string; id: string; seq: number }[],
    skipped: { type: string; id: string }[],
  ): Promise<void> {
    const id = String(input.id);
    const incomingAt = clampIncoming(input.updatedAt as string | undefined);
    const incomingDevice = String(input.deviceId ?? deviceId);
    const delegate = this.delegate(tx, spec.delegate);
    const existing = await delegate.findFirst({ where: { userId, [spec.idField]: id } });

    const base = this.buildData(input, spec.fields);

    if (!existing) {
      const created = await delegate.create({
        data: {
          ...base,
          userId,
          [spec.idField]: id,
          seq: BigInt(alloc()),
          lwwAt: incomingAt,
          lwwDevice: incomingDevice,
        },
      });
      applied.push({ type: spec.key, id, seq: Number(created.seq) });
    } else {
      const stored = storedLww(existing);
      if (lwwWins(incomingAt, incomingDevice, stored.at, stored.device)) {
        const updated = await delegate.update({
          where: { [spec.idField]: id },
          data: { ...base, seq: BigInt(alloc()), lwwAt: incomingAt, lwwDevice: incomingDevice },
        });
        applied.push({ type: spec.key, id, seq: Number(updated.seq) });
      } else {
        skipped.push({ type: spec.key, id });
      }
    }

    if (spec.key === 'tasks' && Array.isArray(input.tagIds)) {
      await this.rebuildTaskTags(tx, userId, id, input.tagIds as string[]);
    }
  }

  private async rebuildTaskTags(tx: SyncTx, userId: string, taskId: string, tagIds: string[]): Promise<void> {
    await tx.taskTag.deleteMany({ where: { userId, taskId } });
    const unique = [...new Set(tagIds.filter((t) => typeof t === 'string'))];
    if (unique.length === 0) return;
    const valid = await tx.tag.findMany({ where: { userId, id: { in: unique }, deletedAt: null }, select: { id: true } });
    if (valid.length) {
      await tx.taskTag.createMany({
        data: valid.map((t) => ({ taskId, tagId: t.id, userId })),
        skipDuplicates: true,
      });
    }
  }

  private async writeSettings(
    tx: SyncTx,
    userId: string,
    deviceId: string,
    input: Record<string, unknown>,
    alloc: () => number,
    applied: { type: string; id: string; seq: number }[],
    skipped: { type: string; id: string }[],
  ): Promise<void> {
    const incomingAt = clampIncoming(input.updatedAt as string | undefined);
    const incomingDevice = String(input.deviceId ?? deviceId);
    const existing = await tx.userSetting.findUnique({ where: { userId } });
    const base = this.buildData(input, SETTINGS_FIELDS);
    if (!existing) {
      const created = await tx.userSetting.create({
        data: { ...base, userId, seq: BigInt(alloc()), lwwAt: incomingAt, lwwDevice: incomingDevice } as Prisma.UserSettingUncheckedCreateInput,
      });
      applied.push({ type: 'settings', id: userId, seq: Number(created.seq) });
      return;
    }
    const stored = storedLww(existing);
    if (lwwWins(incomingAt, incomingDevice, stored.at, stored.device)) {
      const updated = await tx.userSetting.update({
        where: { userId },
        data: { ...base, seq: BigInt(alloc()), lwwAt: incomingAt, lwwDevice: incomingDevice } as Prisma.UserSettingUncheckedUpdateInput,
      });
      applied.push({ type: 'settings', id: userId, seq: Number(updated.seq) });
    } else {
      skipped.push({ type: 'settings', id: userId });
    }
  }

  private async applyTombstone(
    tx: SyncTx,
    userId: string,
    deviceId: string,
    key: SyncEntityKey,
    id: string,
    alloc: () => number,
  ): Promise<void> {
    const now = new Date();
    if (key === 'settings') return;
    const spec = SPECS[key];
    const delegate = this.delegate(tx, spec.delegate);
    const existing = await delegate.findFirst({ where: { userId, [spec.idField]: id } });
    if (!existing || existing.deletedAt) return;
    await delegate.update({
      where: { [spec.idField]: id },
      data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: deviceId },
    });
  }

  private async serverHasData(tx: SyncTx, userId: string): Promise<boolean> {
    const [tasks, folders, tags, habits, habitRecords, focus, extraLists] = await Promise.all([
      tx.task.count({ where: { userId } }),
      tx.folder.count({ where: { userId } }),
      tx.tag.count({ where: { userId } }),
      tx.habit.count({ where: { userId } }),
      tx.habitRecord.count({ where: { userId } }),
      tx.focusSession.count({ where: { userId } }),
      tx.list.count({ where: { userId, isInbox: false } }),
    ]);
    return tasks + folders + tags + habits + habitRecords + focus + extraLists > 0;
  }

  private taskOut(t: Record<string, unknown>): Record<string, unknown> {
    const { tags, ...rest } = t as { tags?: { tagId: string }[] };
    return { ...(rest as Record<string, unknown>), tagIds: (tags ?? []).map((x) => x.tagId) };
  }

  async sync(userId: string, dto: SyncDto) {
    const inputCursor = dto.cursor ?? 0;
    const deviceId = dto.deviceId;

    const sentAny =
      dto.tombstones.length > 0 ||
      Object.values(dto.entities).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined));

    return withSync(this.prisma, userId, async (tx, alloc) => {
      const stateStart = await tx.userSyncState.findUnique({ where: { userId } });
      let maxSeq = Number(stateStart?.seq ?? 0);
      const tracked = () => {
        const s = alloc();
        if (s > maxSeq) maxSeq = s;
        return s;
      };

      const applied: { type: string; id: string; seq: number }[] = [];
      const skipped: { type: string; id: string }[] = [];

      if (inputCursor === 0 && sentAny && (await this.serverHasData(tx, userId))) {
        return {
          cursor: 0,
          serverTime: new Date().toISOString(),
          clientLocalDate: await this.clientLocalDate(userId),
          entities: emptyEntities(),
          tombstones: emptyEntities(),
          applied: [],
          skippedOlder: [],
          needsFullResync: true,
        };
      }

      // 1) 处理推送
      for (const key of Object.keys(SPECS) as SyncKey[]) {
        const list = (dto.entities[key] ?? []) as Record<string, unknown>[];
        for (const item of list) {
          await this.writeEntity(tx, userId, deviceId, SPECS[key], item, tracked, applied, skipped);
        }
      }
      if (dto.entities.settings) {
        await this.writeSettings(tx, userId, deviceId, dto.entities.settings as Record<string, unknown>, tracked, applied, skipped);
      }
      for (const tomb of dto.tombstones) {
        const key = TOMBSTONE_TYPE_MAP[tomb.type];
        if (!key) continue;
        await this.applyTombstone(tx, userId, deviceId, key, tomb.id, tracked);
      }

      // 2) 增量拉取
      const entities: Record<string, unknown> = emptyEntities();
      const tombstones: Record<string, unknown> = emptyEntities();
      for (const key of Object.keys(SPECS) as SyncKey[]) {
        const buckets = await this.pull(tx, userId, SPECS[key], inputCursor);
        entities[key] = buckets.alive;
        tombstones[key] = buckets.dead;
      }
      const settings = await tx.userSetting.findUnique({ where: { userId } });
      entities.settings = settings && Number(settings.seq) > inputCursor ? settingsDto(settings) : null;

      await tx.device.updateMany({ where: { userId, deviceId }, data: { lastSyncAt: new Date() } });

      return {
        cursor: maxSeq,
        serverTime: new Date().toISOString(),
        clientLocalDate: await this.clientLocalDate(userId),
        entities,
        tombstones,
        applied,
        skippedOlder: skipped,
        needsFullResync: false,
      };
    });
  }

  private async pull(tx: SyncTx, userId: string, spec: ModelSpec, cursor: number): Promise<PullBuckets> {
    const delegate = this.delegate(tx, spec.delegate);
    const rows: Record<string, unknown>[] = await delegate.findMany({
      where: { userId, seq: { gt: BigInt(cursor) } },
      orderBy: { seq: 'asc' },
      ...(spec.key === 'tasks' ? { include: { tags: { select: { tagId: true } } } } : {}),
    });
    const alive: Record<string, unknown>[] = [];
    const dead: Record<string, unknown>[] = [];
    for (const r of rows) {
      const out = spec.key === 'tasks' ? this.taskOut(r) : r;
      if (r.deletedAt) dead.push(out);
      else alive.push(out);
    }
    return { alive, dead };
  }

  private async clientLocalDate(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return localDate(user?.timezone || 'Asia/Shanghai', new Date());
  }

  async bootstrap(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('user not found');
    const entities: Record<string, unknown> = emptyEntities();
    for (const key of Object.keys(SPECS) as SyncKey[]) {
      const spec = SPECS[key];
      const delegate = this.delegate(this.prisma as unknown as SyncTx, spec.delegate);
      const rows: Record<string, unknown>[] = await delegate.findMany({
        where: { userId, deletedAt: null },
        orderBy: { seq: 'asc' },
        ...(spec.key === 'tasks' ? { include: { tags: { select: { tagId: true } } } } : {}),
      });
      entities[key] = rows.map((r) => (spec.key === 'tasks' ? this.taskOut(r) : r));
    }
    const settings = await this.prisma.userSetting.findUnique({ where: { userId } });
    entities.settings = settings ? settingsDto(settings) : null;
    const state = await this.prisma.userSyncState.findUnique({ where: { userId } });
    return { cursor: Number(state?.seq ?? 0), entities };
  }
}

function emptyEntities(): Record<string, never[] | null> {
  return {
    folders: [],
    lists: [],
    tags: [],
    tasks: [],
    habits: [],
    habitRecords: [],
    focusSessions: [],
    settings: null,
  };
}

function settingsDto<T extends object>(s: T): Record<string, unknown> {
  const { lwwAt: _a, lwwDevice: _d, ...rest } = s as T & { lwwAt?: unknown; lwwDevice?: unknown };
  return rest as Record<string, unknown>;
}