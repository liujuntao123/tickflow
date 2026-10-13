import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RefreshToken, User } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Response } from 'express';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../prisma.service';
import { PublicUser, serializeUser } from '../../common/serialize';
import { LoginDto, RegisterDto, RefreshDto } from './auth.dto';

export const REFRESH_COOKIE = 'tf_rt';
/** web 前端经 next 代理访问，cookie Path 与浏览器可见路径一致。 */
export const REFRESH_COOKIE_PATH = '/api/backend/auth';

type Tx = Prisma.TransactionClient;

export interface SessionPayload {
  user: PublicUser;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get refreshTtlMs(): number {
    const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 60);
    return (Number.isFinite(days) && days > 0 ? days : 60) * 24 * 60 * 60 * 1000;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.refreshTtlMs,
      secure: this.config.get('COOKIE_SECURE') === 'true',
    };
  }

  private sha256(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async signAccess(userId: string, sid: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, sid, typ: 'access' });
  }

  private async createRefreshToken(
    tx: Tx,
    userId: string,
    deviceId: string,
    platform: string,
    userAgent?: string,
  ): Promise<{ raw: string; record: RefreshToken }> {
    const raw = randomBytes(32).toString('hex');
    const record = await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: this.sha256(raw),
        deviceId,
        platform,
        userAgent: userAgent ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return { raw, record };
  }

  /** web 平台 refreshToken 走 httpOnly cookie，其它平台在 body 返回。 */
  private applyRefreshDelivery(platform: string, res: Response | undefined, payload: SessionPayload): SessionPayload {
    const needsCookie = platform === 'web';
    if (needsCookie && res && payload.refreshToken) {
      res.cookie(REFRESH_COOKIE, payload.refreshToken, this.cookieOptions());
    }
    if (needsCookie) {
      const { refreshToken: _omit, ...rest } = payload;
      return rest;
    }
    return payload;
  }

  private async upsertDevice(tx: Tx, userId: string, deviceId: string, platform: string, appVersion?: string) {
    await tx.device.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, platform, appVersion: appVersion ?? null },
      update: { platform, ...(appVersion ? { appVersion } : {}) },
    });
  }

  async register(dto: RegisterDto, res?: Response, userAgent?: string): Promise<SessionPayload> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await hash(dto.password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw AppException.conflict('该邮箱已注册', 'EMAIL_TAKEN');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: dto.displayName?.trim() || email.split('@')[0],
            timezone: dto.timezone || 'Asia/Shanghai',
          },
        });
        // 序号 1：默认收件箱清单
        await tx.list.create({
          data: { userId: user.id, name: '收件箱', isInbox: true, sortOrder: 0n, seq: 1n },
        });
        // 序号 2：默认设置
        await tx.userSetting.create({ data: { userId: user.id, seq: 2n } });
        // 同步状态与已分配序号对齐
        await tx.userSyncState.create({ data: { userId: user.id, seq: 2n } });
        await this.upsertDevice(tx, user.id, dto.deviceId, dto.platform, dto.appVersion);
        const { raw, record } = await this.createRefreshToken(tx, user.id, dto.deviceId, dto.platform, userAgent);
        const accessToken = await this.signAccess(user.id, record.id);
        return { user, refreshToken: raw, accessToken };
      });

      const payload: SessionPayload = {
        user: serializeUser(result.user),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
      return this.applyRefreshDelivery(dto.platform, res, payload);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw AppException.conflict('该邮箱已注册', 'EMAIL_TAKEN');
      }
      throw e;
    }
  }

  async login(dto: LoginDto, res?: Response, userAgent?: string): Promise<SessionPayload> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw AppException.unauthorized('邮箱或密码不正确', 'INVALID_CREDENTIALS');

    const ok = await verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) throw AppException.unauthorized('邮箱或密码不正确', 'INVALID_CREDENTIALS');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.upsertDevice(tx, user.id, dto.deviceId, dto.platform, dto.appVersion);
      const { raw, record } = await this.createRefreshToken(tx, user.id, dto.deviceId, dto.platform, userAgent);
      const accessToken = await this.signAccess(user.id, record.id);
      return { refreshToken: raw, accessToken };
    });

    const payload: SessionPayload = {
      user: serializeUser({ ...user, lastLoginAt: new Date() }),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
    return this.applyRefreshDelivery(dto.platform, res, payload);
  }

  async refresh(dto: RefreshDto, res?: Response, cookieToken?: string): Promise<SessionPayload> {
    const raw = dto.refreshToken ?? cookieToken;
    if (!raw) throw AppException.unauthorized('缺少刷新令牌', 'REFRESH_REQUIRED');

    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.sha256(raw) } });
    if (!token) throw AppException.unauthorized('刷新令牌无效', 'INVALID_REFRESH');

    // 重放检测：已撤销 token 被再次使用 → 撤销该用户全部 refresh token
    if (token.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppException.unauthorized('刷新令牌已失效，请重新登录', 'REFRESH_REPLAY');
    }
    if (token.expiresAt.getTime() <= Date.now()) {
      throw AppException.unauthorized('刷新令牌已过期', 'REFRESH_EXPIRED');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const { raw: newRaw, record } = await this.createRefreshToken(
        tx,
        token.userId,
        token.deviceId,
        token.platform,
        token.userAgent ?? undefined,
      );
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date(), replacedById: record.id, lastUsedAt: new Date() },
      });
      const user = await tx.user.findUniqueOrThrow({ where: { id: token.userId } });
      const accessToken = await this.signAccess(user.id, record.id);
      return { user, refreshToken: newRaw, accessToken, platform: token.platform };
    });

    const payload: SessionPayload = {
      user: serializeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
    return this.applyRefreshDelivery(result.platform, res, payload);
  }

  async logout(userId: string, sid: string, dto: { all?: boolean; refreshToken?: string }, res?: Response) {
    if (dto.all) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, OR: [{ id: sid }, { tokenHash: dto.refreshToken ? this.sha256(dto.refreshToken) : '' }] },
        data: { revokedAt: new Date() },
      });
    }
    if (res) res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return { ok: true };
  }

  async me(userId: string, sid: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.notFound('用户不存在', 'USER_NOT_FOUND');
    const devices = await this.prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return {
      user: serializeUser(user),
      sessionId: sid,
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        platform: d.platform,
        appVersion: d.appVersion,
        lastSyncAt: d.lastSyncAt,
        createdAt: d.createdAt,
      })),
    };
  }
}