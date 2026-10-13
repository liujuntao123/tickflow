FROM node:22-alpine

RUN npm install -g pnpm@12.4.2 && apk add --no-cache openssl

WORKDIR /app

# workspace manifests（先拷贝以利用层缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY server/package.json server/
COPY web/package.json web/

RUN pnpm install --frozen-lockfile

# 源码
COPY packages ./packages
COPY server ./server

RUN pnpm --filter @tickflow/contracts build \
 && pnpm --filter @tickflow/server exec prisma generate \
 && pnpm --filter @tickflow/server build

EXPOSE 3000
CMD ["sh", "/app/server/docker-entrypoint.sh"]