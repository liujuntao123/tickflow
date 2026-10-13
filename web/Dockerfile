FROM node:22-alpine

RUN npm install -g pnpm@12.4.2

WORKDIR /app

# workspace manifests（先拷贝以利用层缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY server/package.json server/
COPY web/package.json web/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY web ./web

RUN pnpm --filter @tickflow/web build \
 && mkdir -p web/.next/standalone/web/.next \
 && cp -r web/.next/static web/.next/standalone/web/.next/static \
 && mkdir -p web/public \
 && cp -r web/public/. web/.next/standalone/web/public/

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
CMD ["node", "web/.next/standalone/web/server.js"]