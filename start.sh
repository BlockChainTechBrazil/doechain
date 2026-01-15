#!/bin/sh
set -e

echo "[start.sh] Ensuring data directory exists"
mkdir -p data

# Always attempt to initialize the database and create admin.
# The init scripts are idempotent (use CREATE TABLE IF NOT EXISTS
# and check for existing admin), so it's safe to run them on every start.
echo "[start.sh] Running database initialization (idempotent)"
npm run init-db || echo "[start.sh] init-db failed (continuing): $?"

echo "[start.sh] Ensuring admin user exists (idempotent)"
npm run create-admin || echo "[start.sh] create-admin failed (continuing): $?"

echo "[start.sh] Starting Node server"
exec node src/services/server.js
