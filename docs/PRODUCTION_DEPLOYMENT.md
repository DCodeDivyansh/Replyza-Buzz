# Production Deployment Runbook

## 1. Production Architecture Overview

- **Frontend**: Next.js 16 App Router hosted on **Vercel** (`https://www.replyza.buzz`).
- **Backend API & Worker**: Hosted on **AWS EC2 Ubuntu 24.04 LTS** (`https://api.replyza.buzz`).
- **Reverse Proxy**: **Caddy** (automatic TLS certificates from Let's Encrypt).
- **Process Manager**: **PM2** or **systemd** managing Node.js API and BullMQ worker.
- **Queue Storage**: **Redis 7** running locally on the EC2 instance (`127.0.0.1:6379`).
- **Database**: **Supabase PostgreSQL** (Transaction Pooler on Port `6543`, Session Pooler on Port `5432`).

---

## 2. Environment Variables Checklist

### 2.1 Backend EC2 (`apps/api` & `apps/worker` in `/etc/replyza/.env`)

```ini
# Environment
NODE_ENV=production
PORT=4000

# Security Keys (Generate with: openssl rand -hex 32)
JWT_SECRET=super_secret_jwt_key_minimum_32_chars
JWT_REFRESH_SECRET=super_secret_refresh_key_minimum_32_chars
COOKIE_SECRET=super_secret_cookie_key_minimum_32_chars
META_TOKEN_ENCRYPTION_KEY=64_hex_chars_or_32_byte_aes_gcm_key
REPLYZA_PROXY_SECRET=shared_secret_between_nextjs_and_api

# Database (Supabase PostgreSQL)
# Port 6543 for transaction pooling in API and Worker:
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20
# Port 5432 for migrations:
DIRECT_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Meta Instagram App Configuration
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_WEBHOOK_VERIFY_TOKEN=your_random_webhook_verify_token
META_REDIRECT_URI=https://api.replyza.buzz/api/v1/instagram/callback

# Client URLs (CORS & Redirects)
CLIENT_URL=https://www.replyza.buzz
CORS_ORIGIN=https://www.replyza.buzz
```

### 2.2 Frontend Vercel (`apps/web` Project Settings)

```ini
NEXT_PUBLIC_APP_URL=https://www.replyza.buzz
API_BASE_URL=https://api.replyza.buzz
REPLYZA_PROXY_SECRET=shared_secret_matching_api_env
COOKIE_SECRET=super_secret_cookie_key_minimum_32_chars
```

---

## 3. EC2 Provisioning & Setup Runbook

### Step 1: Install Dependencies on Ubuntu 24.04
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git redis-server caddy build-essential

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm pm2
```

### Step 2: Configure Redis
Edit `/etc/redis/redis.conf`:
```ini
bind 127.0.0.1 ::1
protected-mode yes
maxmemory 512mb
maxmemory-policy noeviction
save 900 1
```
Restart Redis:
```bash
sudo systemctl enable redis-server
sudo systemctl restart redis-server
```

### Step 3: Configure Caddy Reverse Proxy
Edit `/etc/caddy/Caddyfile`:
```caddy
api.replyza.buzz {
    reverse_proxy 127.0.0.1:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    log {
        output file /var/log/caddy/api_access.log
    }
}
```
Reload Caddy:
```bash
sudo systemctl reload caddy
```

### Step 4: Clone Repository & Build Monorepo
```bash
git clone https://github.com/your-org/replyza.git /var/www/replyza
cd /var/www/replyza
pnpm install --frozen-lockfile
pnpm run build:all
```

### Step 5: Run Database Migrations
```bash
# Uses DIRECT_URL (Port 5432)
pnpm --filter @replyza/database prisma migrate deploy
```

### Step 6: Start Services with PM2
Create `ecosystem.config.js` in `/var/www/replyza`:
```javascript
module.exports = {
  apps: [
    {
      name: "replyza-api",
      script: "apps/api/dist/server.js",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "replyza-worker",
      script: "apps/worker/dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```
Start PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 4. Verification & Health Checks

After deployment, verify that the systems are operational:
1. **API Readiness Probe**:
   ```bash
   curl -I https://api.replyza.buzz/api/v1/ready
   # Expected: HTTP/1.1 200 OK
   # Body: { "status": "ok", "db": "connected", "redis": "connected" }
   ```
2. **Meta Webhook Subscription Verification**:
   ```bash
   curl "https://api.replyza.buzz/api/v1/webhooks/instagram?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=YOUR_VERIFY_TOKEN"
   # Expected: HTTP/1.1 200 OK with body "test_challenge"
   ```
3. **Frontend Dashboard**:
   Visit `https://www.replyza.buzz/login` and verify seamless authentication.
