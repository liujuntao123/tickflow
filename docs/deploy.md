# 部署指南（Docker）

## 前置要求

- Docker 24+ 与 Compose v2
- 2C2G 起（服务器 ≈400MB、Postgres ≈200MB、Web ≈200MB 常驻）
- 可访问镜像仓库；国内网络受限时见文末「镜像获取」

## 一键部署

```bash
cp .env.example .env
# 必填：POSTGRES_PASSWORD（openssl rand -hex 24）、JWT_SECRET（openssl rand -hex 32）
docker compose up -d --build
docker compose ps        # 三个服务应全部 healthy
curl http://localhost:3000/api/v1/healthz
```

首次启动时 `server` 容器会执行 `prisma migrate deploy`（幂等，含重试等待数据库）与习惯模板种子（幂等）。

## 环境变量（.env）

| 变量 | 默认 | 说明 |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | tickflow | 数据库账号/库名 |
| `POSTGRES_PASSWORD` | 必填 | 数据库密码（同时用于拼接 DATABASE_URL） |
| `POSTGRES_PORT` | 5432 | 仅绑定 127.0.0.1，供本机开发直连 |
| `JWT_SECRET` | 必填 | access/refresh 令牌签名密钥 |
| `ACCESS_TOKEN_TTL` | 30m | access token 有效期 |
| `REFRESH_TOKEN_TTL_DAYS` | 60 | refresh token 有效期 |
| `WEB_PORT` | 8080 | Web 对外端口 |
| `SERVER_PORT` | 3000 | API 端口（仅绑定 127.0.0.1） |
| `TZ` | Asia/Shanghai | 容器时区（影响日志与"今天"边界展示） |
| `REGISTRY_PREFIX` | 空 | 镜像前缀，如 `dockerproxy.net/library/` |

## 端口与反向代理

对外只需暴露 Web（8080）。API 默认只绑 127.0.0.1，Android 客户端连**同域名 + 反代到 3000** 或直连 `http://<主机IP>:3000`（需把 compose 中 server 的端口绑定从 `127.0.0.1:` 改为 `0.0.0.0:`）。

Caddy 示例（自动 HTTPS，Web 与 API 同域）：

```caddyfile
tickflow.example.com {
    reverse_proxy /api/* localhost:3000
    reverse_proxy localhost:8080
}
```

## 数据与备份

- 数据落在宿主机 `./data/postgres`（bind mount），`docker compose down` 不会删除数据；**不要执行 `rm -rf data/`**。
- 备份：`docker compose exec -T postgres pg_dump -U tickflow tickflow > backup-$(date +%F).sql`
- 恢复：`cat backup.sql | docker compose exec -T postgres psql -U tickflow -d tickflow`

## 升级

```bash
git pull
docker compose up -d --build   # 迁移在 server 启动时自动执行
```

或使用 GHCR 镜像（发布 tag 时自动构建）：

```bash
# .env 中把 build 换成镜像（或 docker compose pull）：
# image: ghcr.io/liujuntao123/tickflow-server:<version>
# image: ghcr.io/liujuntao123/tickflow-web:<version>
```

## 镜像获取（国内网络）

Docker Hub 不可达时按序尝试：

1. **零拉取**：基础镜像 `node:22-alpine`、`postgres:18-alpine` 已在本机即可直接 `--build`；
2. `.env` 设置 `REGISTRY_PREFIX=dockerproxy.net/library/`（compose 已预留该变量）；
3. 给 Docker Desktop 配置 HTTP 代理指向本机代理软件；
4. 使用 GHCR 镜像 + 加速前缀（如 `ghcr.1ms.run/`）。

## 常见问题

| 现象 | 处理 |
|---|---|
| postgres 反复重启，日志提示 data in /var/lib/postgresql | postgres:18 要求单挂载点 `/var/lib/postgresql`（本仓库已适配；勿改回 `.../data`） |
| server unhealthy 且日志 P1001 | 数据库冷启动竞态；entrypoint 已内置重试，仍失败则确认 postgres 先 healthy |
| 127.0.0.1:3000 打不开 API | 端口仅绑本机属预期；本机 curl 或改用反代/调整绑定 |