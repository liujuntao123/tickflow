import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';
import { HabitCreateDto, HabitUpdateDto } from './habits.dto';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return dateKey(d);
}

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async tz(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.timezone || 'Asia/Shanghai';
  }

  private todayKey(tz: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  async list(userId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.habit.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        records: {
          where: { deletedAt: null, date: { gte: since } },
          orderBy: { date: 'asc' },
        },
      },
    });
  }

  async create(userId: string, dto: HabitCreateDto) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const max = await tx.habit.aggregate({ where: { userId, deletedAt: null }, _max: { sortOrder: true } });
      return tx.habit.create({
        data: {
          userId,
          name: dto.name,
          icon: dto.icon ?? null,
          color: dto.color ?? null,
          goalType: dto.goalType ?? 0,
          targetValue: dto.targetValue ?? 1,
          unit: dto.unit ?? null,
          frequency: dto.frequency ?? 0,
          weekDays: dto.weekDays ?? [],
          repeatRule: dto.repeatRule ?? null,
          startDate: dto.startDate ?? new Date(),
          reminders: dto.reminders == null ? undefined : (dto.reminders as Prisma.InputJsonValue),
          archived: dto.archived ?? false,
          sortOrder: dto.sortOrder !== undefined ? BigInt(dto.sortOrder) : BigInt(max._max.sortOrder ?? 0n) + 1024n,
          seq: BigInt(alloc()),
          lwwAt: new Date(),
          lwwDevice: SERVER_DEVICE,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: HabitUpdateDto) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const habit = await tx.habit.findFirst({ where: { id, userId, deletedAt: null } });
      if (!habit) throw AppException.notFound('习惯不存在', 'HABIT_NOT_FOUND');
      const data: Prisma.HabitUncheckedUpdateInput = { seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.icon !== undefined) data.icon = dto.icon;
      if (dto.color !== undefined) data.color = dto.color;
      if (dto.goalType !== undefined) data.goalType = dto.goalType;
      if (dto.targetValue !== undefined) data.targetValue = dto.targetValue;
      if (dto.unit !== undefined) data.unit = dto.unit;
      if (dto.frequency !== undefined) data.frequency = dto.frequency;
      if (dto.weekDays !== undefined) data.weekDays = dto.weekDays;
      if (dto.repeatRule !== undefined) data.repeatRule = dto.repeatRule;
      if (dto.startDate !== undefined) data.startDate = dto.startDate;
      if (dto.reminders !== undefined) data.reminders = dto.reminders === null ? Prisma.DbNull : (dto.reminders as Prisma.InputJsonValue);
      if (dto.archived !== undefined) data.archived = dto.archived;
      if (dto.sortOrder !== undefined) data.sortOrder = BigInt(dto.sortOrder);
      return tx.habit.update({ where: { id }, data });
    });
  }

  async remove(userId: string, id: string) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const habit = await tx.habit.findFirst({ where: { id, userId, deletedAt: null } });
      if (!habit) throw AppException.notFound('习惯不存在', 'HABIT_NOT_FOUND');
      const now = new Date();
      await tx.habit.update({
        where: { id },
        data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      return { ok: true };
    });
  }

  async check(userId: string, id: string, date: Date, value?: number) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const habit = await tx.habit.findFirst({ where: { id, userId, deletedAt: null } });
      if (!habit) throw AppException.notFound('习惯不存在', 'HABIT_NOT_FOUND');
      const target = value ?? 1;
      const existing = await tx.habitRecord.findUnique({ where: { habitId_date: { habitId: id, date } } });
      if (existing && !existing.deletedAt && existing.value === target) {
        return existing; // 幂等：无变化不推进 seq
      }
      const now = new Date();
      if (existing) {
        return tx.habitRecord.update({
          where: { id: existing.id },
          data: { value: target, deletedAt: null, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
        });
      }
      return tx.habitRecord.create({
        data: { userId, habitId: id, date, value: target, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
    });
  }

  async uncheck(userId: string, id: string, date: Date) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const habit = await tx.habit.findFirst({ where: { id, userId, deletedAt: null } });
      if (!habit) throw AppException.notFound('习惯不存在', 'HABIT_NOT_FOUND');
      const existing = await tx.habitRecord.findUnique({ where: { habitId_date: { habitId: id, date } } });
      if (!existing || existing.deletedAt) return { ok: true };
      const now = new Date();
      await tx.habitRecord.update({
        where: { id: existing.id },
        data: { deletedAt: now, seq: BigInt(alloc()), lwwAt: now, lwwDevice: SERVER_DEVICE },
      });
      return { ok: true };
    });
  }

  async stats(userId: string, from?: Date, to?: Date) {
    const tz = await this.tz(userId);
    const toKey = dateKey(to ?? new Date());
    const fromKey = dateKey(from ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    const habits = await this.prisma.habit.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }],
      include: { records: { where: { deletedAt: null, value: { gt: 0 } }, orderBy: { date: 'asc' } } },
    });
    const today = this.todayKey(tz);
    const totalRangeDays = Math.max(1, daysBetween(fromKey, toKey) + 1);

    return habits.map((h) => {
      const keys = new Set(h.records.map((r) => dateKey(r.date)));
      const days = h.records
        .filter((r) => {
          const k = dateKey(r.date);
          return k >= fromKey && k <= toKey;
        })
        .map((r) => ({ date: dateKey(r.date), value: r.value }));
      const doneInRange = days.filter((d) => d.value > 0).length;

      // 当前连续：从今天（或昨天）向前连续
      let cursor = keys.has(today) ? today : addDays(today, -1);
      let currentStreak = 0;
      while (keys.has(cursor)) {
        currentStreak += 1;
        cursor = addDays(cursor, -1);
      }

      // 最长连续
      const sorted = [...keys].sort();
      let longestStreak = 0;
      let run = 0;
      let prev: string | null = null;
      for (const k of sorted) {
        if (prev && addDays(prev, 1) === k) run += 1;
        else run = 1;
        if (run > longestStreak) longestStreak = run;
        prev = k;
      }

      return {
        habitId: h.id,
        name: h.name,
        currentStreak,
        longestStreak,
        completionRate: Math.round((doneInRange / totalRangeDays) * 1000) / 1000,
        days,
      };
    });
  }

  async templates() {
    return this.prisma.habitTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async fromTemplate(userId: string, templateId: string) {
    const template = await this.prisma.habitTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw AppException.notFound('习惯模板不存在', 'TEMPLATE_NOT_FOUND');
    return this.create(userId, {
      name: template.title,
      icon: template.icon,
      color: template.color,
      goalType: template.defaultGoalType,
      targetValue: template.defaultTargetValue,
      unit: template.defaultUnit ?? undefined,
      frequency: template.frequency,
    });
  }
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00.000Z`).getTime();
  const db = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}