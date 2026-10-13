import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser, IS_PUBLIC_KEY } from '../decorators';
import { AppException } from '../errors';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppException.unauthorized('缺少访问令牌', 'AUTH_REQUIRED');
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
        throw new Error('invalid payload');
      }
      req.user = { userId: payload.sub, sid: payload.sid };
      return true;
    } catch {
      throw AppException.unauthorized('访问令牌无效或已过期', 'INVALID_TOKEN');
    }
  }
}