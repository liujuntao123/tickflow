#!/bin/sh
set -e
cd /app/server

echo "[tickflow] applying database migrations..."
i=1
until ./node_modules/.bin/prisma migrate deploy; do
  if [ "$i" -ge 10 ]; then
    echo "[tickflow] migrate failed after $i attempts, giving up" >&2
    exit 1
  fi
  echo "[tickflow] database not ready, retry $i/10 in 3s..."
  i=$((i + 1))
  sleep 3
done

echo "[tickflow] seeding habit templates..."
node prisma/seed.js || echo "[tickflow] seed skipped (non-fatal)"

echo "[tickflow] starting server..."
exec node dist/main.js