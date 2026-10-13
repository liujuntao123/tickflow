import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { serializeUser } from '../../common/serialize';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateMe(userId: string, dto: { displayName?: string; timezone?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      },
    });
    return { user: serializeUser(user) };
  }

  async changePassword(userId: string, sid: string, dto: { oldPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.notFound('用户不存在', 'USER_NOT_FOUND');
    const ok = await verify(user.passwordHash, dto.oldPassword).catch(() => false);
    if (!ok) throw AppException.badRequest('原密码不正确', 'INVALID_OLD_PASSWORD');
    const passwordHash = await hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      // 撤销其他 refresh token，保留当前会话
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null, id: { not: sid } },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }

  async devices(userId: string) {
    const devices = await this.prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return {
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        platform: d.platform,
        appVersion: d.appVersion,
        lastSyncAt: d.lastSyncAt,
        createdAt: d.createdAt,
      })),
    };
  }

  async removeDevice(userId: string, deviceId: string) {
    const result = await this.prisma.device.deleteMany({ where: { userId, deviceId } });
    if (result.count === 0) throw AppException.notFound('设备不存在', 'DEVICE_NOT_FOUND');
    // 撤销该设备的 refresh token
    await this.prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}