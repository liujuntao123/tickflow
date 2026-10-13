# TickFlow

自托管任务管理应用（滴答清单 / TickTick 风格复刻）——任务、清单、标签、智能清单、重复任务、提醒、日历、番茄专注、习惯打卡、四象限，多端实时同步。

| 目录 | 说明 |
|---|---|
| `server/` | NestJS 11 + Prisma 6 + PostgreSQL 18（Docker 部署、REST + 增量同步） |
| `web/` | Next.js 15 桌面端（三栏布局、日历、专注、习惯、四象限） |
| `android/` | Kotlin + Jetpack Compose 原生应用（离线优先、精确提醒） |
| `packages/contracts/` | 三端共享规则常量与 RRULE 测试向量 |

## 快速开始（Docker）

```bash
cp .env.example .env          # 填写 POSTGRES_PASSWORD 与 JWT_SECRET
docker compose up -d --build  # 零拉取可用（本机已有 node:22-alpine / postgres:18-alpine 时）
# Web:  http://localhost:8080
# API:  http://localhost:3000/api/v1/healthz
```

部署细节、环境变量、反向代理与备份见 [docs/deploy.md](docs/deploy.md)。

## 本地开发

```bash
pnpm install
pnpm dev:server   # http://localhost:3000（需要本机/容器 Postgres，compose 已映射 127.0.0.1:5432）
pnpm dev:web      # http://localhost:3001
```

Android 本地构建、服务器地址配置与真机验证清单见 [android/README.md](android/README.md)。

## 测试与冒烟

```bash
node scripts/smoke.mjs              # 后端全链路冒烟（85 项：auth/组织/任务/视图/同步/习惯/专注/设置）
node server/test/rrule-vectors.mjs  # 重复规则向量（23 项）
```

CI（push/PR）自动执行 server 构建、web 构建与 android assembleDebug 三路检查。

## 发版

```bash
git tag v1.0.0 && git push origin v1.0.0
```

自动产出：GitHub Release 中签名 APK + GHCR 镜像（`ghcr.io/liujuntao123/tickflow-server|web`）。
签名与工作流细节见 [docs/releasing.md](docs/releasing.md)。

## 功能范围

- **任务**：标题/备注(Markdown)/清单/子任务/检查项/标签/优先级(无·低·中·高)/截止时间/提醒(多选偏移)/重复(每周几、每月几日、结束条件)/拖拽排序
- **组织**：文件夹、清单（含收件箱）、标签（含合并）；智能清单：收件箱/今天/明天/未来 7 天/所有/已完成
- **视图**：日历（月/议程，重复任务真实展开）、四象限（重要×紧急，拖拽改优先级）、流程图占位
- **番茄专注**：时长配置、圆环计时、暂停/继续/放弃/完成、跨端恢复、近 7 天统计；Android 前台服务常驻倒计时
- **习惯打卡**：模板库/自定义、计数型与打卡型、连续天数、12 周热力图
- **同步**：状态基增量同步（LWW + seq 游标 + 墓碑），离线可写；原理见 [docs/sync-design.md](docs/sync-design.md)
- **提醒**：Android 精确闹钟（锁屏通知、点击直达、开机重建）；Web 页内通知（仅页面打开时生效）

## 已知限制

- Web 端浏览器通知只在页面打开时生效（未接 Web Push）
- Android 提醒依赖「精确闹钟」权限，国产 ROM 需加入电池优化白名单（设置页有跳转）
- 中文搜索使用 pg_trgm（未接中文分词）；协作/附件/桌面小组件为后续迭代

## 文档索引

- [docs/api.md](docs/api.md) — 全部 REST 端点与载荷、BigInt 字符串约定
- [docs/deploy.md](docs/deploy.md) — Docker 部署、环境变量、反代、备份升级
- [docs/releasing.md](docs/releasing.md) — 发版流程、签名、工作流
- [docs/sync-design.md](docs/sync-design.md) — 同步协议与不变量
- [docs/ux-reference.md](docs/ux-reference.md) — 端侧界面结构与设计取向

## 后续路线（P2+，均未开工）

- Web Push（自托管 VAPID，替代「页面打开才通知」）
- 回收站 UI、CSV/JSON 导入导出
- 专注/习惯统计细化（按清单/标签聚合、月视图）
- WS 变更推送（当前为拉取式增量，`/ws` 为预留位）
- 协作共享、附件、Android 桌面小组件、看板视图

## 开发约定（改代码前请先读）

- **同步不变量**：所有写路径必须经由 `withSync` 分配 seq（事务开头行锁）——见 [docs/sync-design.md](docs/sync-design.md)
- **重复任务**：完成滚动只在服务端（REST 与 `/sync` 共用 `rollRecurringTask`），客户端只消费结果
- **JSON 约定**：BigInt（seq / sortOrder）一律序列化为字符串；智能清单与四象限规则常量的唯一来源是 `packages/contracts/src/`
- **限流**：仅 auth 路由有限制（登录/注册 5 次/分钟）；业务 API 不做全局限流（避免误伤前端请求风暴）
- **提交前门槛**：`node scripts/smoke.mjs`（85 项）、`node server/test/rrule-vectors.mjs`（23 项）；Android 改动跑 `cd android && ./gradlew :app:assembleDebug`
- **发版**：`git tag vX.Y.Z && git push origin vX.Y.Z` → 自动产出签名 APK 与 GHCR 镜像
- **勿入库**：`.env`、`data/`、keystore（签名文件在 `C:\Users\admin\tools\tickflow-keystore\`，仓库外双备份）