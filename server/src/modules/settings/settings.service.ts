import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { withSync } from '../../common/sync/seq-allocator';
import { SERVER_DEVICE } from '../../common/sync/lww';
import { SettingsUpdateDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const existing = await this.prisma.userSetting.findUnique({ where: { userId } });
    if (existing) return existing;
    // 不存在则返回默认并落库（分配 seq）
    return withSync(this.prisma, userId, async (tx, alloc) => {
      return tx.userSetting.create({
        data: { userId, seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE },
      });
    });
  }

  async update(userId: string, dto: SettingsUpdateDto) {
    return withSync(this.prisma, userId, async (tx, alloc) => {
      const exists = await tx.userSetting.findUnique({ where: { userId } });
      const data: Prisma.UserSettingUncheckedUpdateInput = { seq: BigInt(alloc()), lwwAt: new Date(), lwwDevice: SERVER_DEVICE };
      if (dto.theme !== undefined) data.theme = dto.theme;
      if (dto.weekStart !== undefined) data.weekStart = dto.weekStart;
      if (dto.dayStartHour !== undefined) data.dayStartHour = dto.dayStartHour;
      if (dto.dateFormat !== undefined) data.dateFormat = dto.dateFormat;
      if (dto.modulePomodoro !== undefined) data.modulePomodoro = dto.modulePomodoro;
      if (dto.moduleHabits !== undefined) data.moduleHabits = dto.moduleHabits;
      if (dto.moduleMatrix !== undefined) data.moduleMatrix = dto.moduleMatrix;
      if (dto.moduleCalendar !== undefined) data.moduleCalendar = dto.moduleCalendar;
      if (dto.smartListsVisible !== undefined) data.smartListsVisible = dto.smartListsVisible;
      if (dto.defaultListId !== undefined) data.defaultListId = dto.defaultListId;
      if (dto.defaultPriority !== undefined) data.defaultPriority = dto.defaultPriority;
      if (dto.defaultReminderOffset !== undefined) data.defaultReminderOffset = dto.defaultReminderOffset;
      if (dto.focusSettings !== undefined) data.focusSettings = dto.focusSettings === null ? Prisma.DbNull : (dto.focusSettings as Prisma.InputJsonValue);

      if (!exists) {
        return tx.userSetting.create({
          data: { ...(data as Prisma.UserSettingUncheckedCreateInput), userId },
        });
      }
      return tx.userSetting.update({ where: { userId }, data });
    });
  }
}