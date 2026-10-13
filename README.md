# TickFlow

自托管任务管理应用（滴答清单风格复刻）· NestJS + Next.js + Kotlin/Compose

- `server/` — NestJS + Prisma + PostgreSQL 后端（Docker 部署）
- `web/` — Next.js 桌面端 Web 应用
- `android/` — Kotlin + Jetpack Compose 原生 Android 应用
- `packages/contracts/` — 三端共享契约（zod schema / 规则常量）

## 快速开始（Docker）

```bash
cp .env.example .env        # 填写 POSTGRES_PASSWORD 与 JWT_SECRET
docker compose up -d --build
# Web:  http://localhost:8080
# API:  http://localhost:3000/api/v1/healthz
```

## 本地开发

```bash
pnpm install
pnpm dev:server             # 后端 http://localhost:3000
pnpm dev:web                # Web  http://localhost:3001
```

## Android 打包

推送 `v*` tag 触发 GitHub Actions，产物在 Release 中：

```bash
git tag v0.1.0 && git push origin v0.1.0
```