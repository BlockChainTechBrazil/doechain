#!/bin/sh
set -e

echo "[start.sh] Ensuring data directory exists"
mkdir -p data

if [ ! -f data/doechain.db ]; then
  echo "[start.sh] Database not found — initializing DB"
  npm run init-db
  echo "[start.sh] Creating admin user"
  npm run create-admin
else
  echo "[start.sh] Database exists, skipping init"
fi

echo "[start.sh] Starting Node server"
exec node src/services/server.js
