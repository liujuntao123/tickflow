import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthService, REFRESH_COOKIE } from './auth.service';
import { LoginDto, loginSchema, LogoutDto, logoutSchema, RefreshDto, refreshSchema, RegisterDto, registerSchema } from './auth.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.register(dto, res, req.headers['user-agent']);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.login(dto, res, req.headers['user-agent']);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    return this.auth.refresh(dto, res, cookieToken);
  }

  @Post('logout')
  logout(
    @CurrentUser('userId') userId: string,
    @CurrentUser('sid') sid: string,
    @Query(new ZodValidationPipe(logoutSchema)) query: LogoutDto,
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(userId, sid, { all: query.all ?? body.all, refreshToken: body.refreshToken }, res);
  }

  @Get('me')
  me(@CurrentUser('userId') userId: string, @CurrentUser('sid') sid: string) {
    return this.auth.me(userId, sid);
  }
}