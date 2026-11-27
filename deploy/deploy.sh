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
echo "[3/7] Generating Prisma client & building packages (shared, database, api, worker, web)..."
pnpm --filter @replyza/shared build
pnpm --filter @replyza/database db:generate
pnpm --filter @replyza/database build
pnpm --filter @replyza/api build
pnpm --filter @replyza/worker build
pnpm --filter web build

# 4. Load production environment & take pre-migration DB backup
echo "[4/7] Creating pre-migration PostgreSQL backup..."
if [ -f "/etc/replyza.env" ]; then
    set -a
    source /etc/replyza.env
    set +a
fi

if [ -z "${DIRECT_URL:-}" ]; then
    echo "CRITICAL: DIRECT_URL is not set; aborting before migration."
    exit 1
fi

BACKUP_DIR="/var/backups/replyza"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/replyza_$(date -u +%Y%m%d_%H%M%S).dump"
pg_dump "$DIRECT_URL" --format=custom --file="$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# 5. Run database migrations
echo "[5/7] Applying Prisma database migrations..."
cd packages/database
npx prisma migrate deploy
cd "$APP_DIR"

# 6. Restart services
echo "[6/7] Restarting replyza-api, replyza-worker, and web (if local)..."
sudo systemctl restart replyza-api
sudo systemctl restart replyza-worker
if systemctl list-unit-files | grep -q '^replyza-web\.service'; then
    sudo systemctl restart replyza-web
elif command -v pm2 >/dev/null 2>&1 && pm2 describe replyza-web >/dev/null 2>&1; then
    pm2 restart replyza-web
else
    echo "Note: No local replyza-web systemd/PM2 service detected (assumed hosted separately)."
fi

# 7. Verify health & readiness checks
echo "[7/7] Verifying service health and readiness..."
sleep 2
HEALTH_RESPONSE=$(curl -s -f http://127.0.0.1:4000/api/v1/health || echo "FAILED")
READY_RESPONSE=$(curl -s -f http://127.0.0.1:4000/api/v1/ready || echo "FAILED")

if { [[ "$HEALTH_RESPONSE" == *"ok"* ]] || [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; } && [[ "$READY_RESPONSE" == *"\"status\":\"ready\""* ]]; then
    echo "============================================="
    echo " Deployment Succeeded! Health & Ready: OK"
    echo "============================================="
else
    echo "============================================="
    echo " CRITICAL: Health/Readiness check failed!"
    echo " Health: $HEALTH_RESPONSE"
    echo " Ready:  $READY_RESPONSE"
    echo " Check logs: journalctl -u replyza-api -n 50"
    echo "============================================="
    exit 1
fi
