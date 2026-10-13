import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { OrgModule } from './modules/org/org.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ViewsModule } from './modules/views/views.module';
import { SearchModule } from './modules/search/search.module';
import { SyncModule } from './modules/sync/sync.module';
import { HabitsModule } from './modules/habits/habits.module';
import { FocusModule } from './modules/focus/focus.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { MetaModule } from './modules/meta/meta.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 全局默认限流放宽（前端一屏十余请求 + mutation 失效风暴）；auth 路由有独立的 5-10 次/分钟严格限流
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 600),
      },
    ]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('ACCESS_TOKEN_TTL') ?? '30m') as unknown as number },
      }),
    }),
    PrismaModule,
    AuthModule,
    OrgModule,
    TasksModule,
    ViewsModule,
    SearchModule,
    SyncModule,
    HabitsModule,
    FocusModule,
    SettingsModule,
    UsersModule,
    MetaModule,
  ],
  controllers: [HealthController],
  providers: [
    // 限流只作用于 auth 路由（AuthController 上的 @UseGuards(ThrottlerGuard)）；
    // 业务 API 不做全局限流——客户端同步/UI 请求量特性不适合按请求数硬限。
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}