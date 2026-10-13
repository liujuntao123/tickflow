# @tickflow/web

TickFlow 的 Web 桌面端（Next.js 15 App Router + React 19），滴答清单风格的复刻实现，当前为 **M1**。

## 技术要点

- **路由代理**：所有后端请求统一走 `src/app/api/backend/[...path]/route.ts`，由 Next 运行时代理到 `server` 容器，cookie 原样透传。
- **鉴权**：access token 仅存内存（zustand，`src/lib/session.ts`）；refresh token 由后端种在 httpOnly cookie `tf_rt`（`Path=/api/backend/auth`）。刷新页面时 `src/lib/api.ts` 会先静默 `POST /auth/refresh` 续期；业务请求遇 401 自动刷新一次并重试，失败则清空会话跳转 `/login`。
- **数据层**：`@tanstack/react-query`，hooks 位于 `src/lib/hooks/*`；任务勾选与快速添加使用乐观更新，随后失效 `tasks` / `views` / `counts` 查询。
- **主题**：class 策略（`<html class="dark">`），`src/app/globals.css` 用 `@custom-variant dark` 覆盖 Tailwind v4 默认的 `prefers-color-scheme`；切换结果同时写入 `localStorage` 与后端 `settings.theme`。

## 目录结构

```
src/
  app/
    (auth)/           登录、注册（居中卡片布局）
    (app)/            三栏应用外壳（侧边栏 + 中栏任务列表 + 右栏详情）
      today|inbox|tomorrow|next7|all|completed
      list/[id]  folder/[id]  tag/[id]  search  settings
      calendar|focus|habits|matrix      占位页（后续里程碑）
    api/backend/[...path]/route.ts      后端代理
    api/health/route.ts                 容器健康检查
    providers.tsx                       QueryClient + 会话引导 + 主题初始化
  components/
    ui.tsx                             基础组件（Button/Input/Modal/Dropdown…）
    app/                               侧边栏、任务行、快速添加、详情面板、工作区…
  lib/
    api.ts  session.ts  theme.ts  ui-store.ts  types.ts  utils.ts  grouping.ts
    hooks/                             react-query hooks
```

## 本地开发

前置：后端已在本机 `:3000` 运行（`docker compose up -d server`，或 `pnpm dev:server`）。

```bash
pnpm install
pnpm --filter @tickflow/web dev      # http://127.0.0.1:3001
```

可选环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3000` | Next 代理指向的后端地址 |

## 构建

```bash
pnpm --filter @tickflow/web build    # 输出 .next/standalone
pnpm --filter @tickflow/web start    # 生产模式，端口 3001
```

## Docker

在仓库根目录执行：

```bash
docker compose build web
docker compose up -d web             # http://127.0.0.1:8080
docker compose ps                    # web 应显示 healthy
```

## 验证

1. `pnpm --filter @tickflow/web build` 零错误（TS strict）。
2. `pnpm --filter @tickflow/web dev` 后经 `http://127.0.0.1:3001/api/backend` 走一遍注册 → 登录 → 建清单 → 建任务 → 查 `views/counts`；确认 web 平台响应体**不含** `refreshToken`，且已种下 `tf_rt` cookie。
3. `docker compose build web && docker compose up -d web` 后 `docker compose ps` 为 healthy，`http://127.0.0.1:8080/api/backend/healthz` 与首页均返回 200。

## 已知限制（M1）

- 智能清单的**分组切换在客户端完成**（服务端先按清单返回，前端再按 日期/优先级 重排）。
- 任务行内的**子任务计数**依赖 `checklist`；子任务本身（`subtasks`）仅在 `/tasks/:id` 返回，故计数只在详情面板中展示。
- 批量操作、拖拽排序、日历/专注/习惯/四象限均为占位页，留待后续里程碑。
- `packages/contracts` 的常量在 `src/lib/constants.ts` 做了本地镜像，避免 web 构建依赖其编译产物。