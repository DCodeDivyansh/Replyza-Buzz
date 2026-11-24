#!/usr/bin/env bash
set -euo pipefail

# Replyza EC2 Deployment Script
# Target: AWS EC2 Ubuntu 24.04 LTS (API + Worker + Redis + Caddy)
# Working Directory: /var/www/replyza

echo "============================================="
echo " Deploying Replyza Production Release"
echo " Date: $(date -u)"
echo "============================================="

APP_DIR="/var/www/replyza"
cd "$APP_DIR"

# 1. Pull latest verified release
echo "[1/6] Fetching latest changes..."
git fetch origin main
git reset --hard origin/main

# 2. Install dependencies using frozen lockfile
echo "[2/6] Installing dependencies with pnpm..."
pnpm install --frozen-lockfile

# 3. Build all workspace packages in topological order
echo "[3/6] Building packages (shared, database, api, worker)..."
pnpm --filter @replyza/shared build
pnpm --filter @replyza/database build
pnpm --filter @replyza/api build
pnpm --filter @replyza/worker build

# 4. Run database migrations with masked host checks
echo "[4/6] Applying Prisma database migrations..."
if [ -f "/etc/replyza.env" ]; then
    set -a
    source /etc/replyza.env
    set +a
fi

cd packages/database
npx prisma migrate deploy
cd "$APP_DIR"

# 5. Restart systemd services
echo "[5/6] Restarting replyza-api and replyza-worker services..."
sudo systemctl restart replyza-api
sudo systemctl restart replyza-worker

# 6. Verify health check
echo "[6/6] Verifying service readiness..."
sleep 2
HEALTH_RESPONSE=$(curl -s -f http://127.0.0.1:4000/api/v1/health || echo "FAILED")

if [[ "$HEALTH_RESPONSE" == *"ok"* ]] || [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    echo "============================================="
    echo " Deployment Succeeded! API Health: OK"
    echo "============================================="
else
    echo "============================================="
    echo " CRITICAL: Health check failed: $HEALTH_RESPONSE"
    echo " Check logs: journalctl -u replyza-api -n 50"
    echo "============================================="
    exit 1
fi
