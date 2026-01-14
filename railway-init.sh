#!/bin/sh
set -e

# railway-init.sh - helper to initialize and deploy DoeChain on Railway (MVP)
# Usage: edit the variables below if you want defaults, then run: ./railway-init.sh

#########################
# Config - edit if desired
PROJECT_NAME="doechain"
SERVICE_NAME="doechain-web"
GITHUB_REPO="" # e.g. user/repo - leave empty to select interactively in railway init
BRANCH="davi"

# Optional overrides (leave empty to use Dockerfile defaults)
PORT="3001"
JWT_SECRET="doechain_jwt_secret_hospital_ses_go_2026"
RELAYER_PRIVATE_KEY=""  # set if you want a custom relayer key
RPC_URL="https://rpc.example.local"
TRUSTED_FORWARDER="0x0000000000000000000000000000000000000000"
ADMIN_EMAIL="admin@doechain.gov.br"
ADMIN_PASSWORD="admin123456"
#########################

echo "== DoeChain Railway init helper =="

if ! command -v railway > /dev/null 2>&1; then
  echo "Railway CLI not found. Install with: npm i -g railway"
  exit 1
fi

echo "Logging into Railway..."
railway login

echo "\nStarting project initialization. You will be prompted to select GitHub repo/branch if needed.\n"
if [ -n "$GITHUB_REPO" ]; then
  echo "Initializing project with repo: $GITHUB_REPO (branch: $BRANCH)"
  railway init --name "$PROJECT_NAME" --org "$RAILWAY_ORG" || true
else
  echo "Running interactive 'railway init' - follow the prompts to select repo and branch."
  railway init || true
fi

echo "\nDeploying service (this will build the Docker image on Railway)..."
railway up || true

echo "Waiting 10s for service to stabilize..."
sleep 10

echo "Running DB initialization and admin creation inside the deployed environment."
echo "If the project/service wasn't linked, 'railway run' might fail - run manually from Railway dashboard shell."

if [ -n "$RELAYER_PRIVATE_KEY" ]; then
  export RELAYER_PRIVATE_KEY="$RELAYER_PRIVATE_KEY"
fi
export JWT_SECRET="$JWT_SECRET"
export RPC_URL="$RPC_URL"
export TRUSTED_FORWARDER="$TRUSTED_FORWARDER"
export ADMIN_EMAIL="$ADMIN_EMAIL"
export ADMIN_PASSWORD="$ADMIN_PASSWORD"

echo "Running 'npm run init-db' on Railway..."
railway run "npm run init-db" || true

echo "Running 'npm run create-admin' on Railway..."
railway run "npm run create-admin" || true

echo "\nDone. Check Railway dashboard for logs and the public URL."
echo "Verify health: https://<your-service>.up.railway.app/api/health"

echo "If any step failed, inspect Railway logs and re-run the failing command via 'railway run'."
