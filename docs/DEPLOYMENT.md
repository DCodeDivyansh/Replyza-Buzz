# Replyza — Production Deployment Guide

This guide describes how to deploy the Replyza platform to production using:
- **AWS EC2 (Ubuntu 24.04 LTS)**: Houses the Express API, BullMQ background worker, local Redis, and Caddy reverse proxy (`api.replyza.buzz`).
- **Vercel**: Hosts the Next.js 16 App Router frontend (`replyza.buzz`).
- **Supabase**: Managed PostgreSQL database with Transaction and Session poolers.
- **Meta Platform**: Instagram Graph API v27.0 with Facebook Login for Business.

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Vercel (Frontend)             │
                      │         https://replyza.buzz           │
                      └──────────────────┬─────────────────────┘
                                         │
                 Reverse Proxy Routes    │  Encrypted Token & CSRF Headers
                 /api/proxy/*            │  x-replyza-proxy-secret
                                         ▼
                      ┌────────────────────────────────────────┐
                      │          AWS EC2 Instance              │
                      │       https://api.replyza.buzz         │
                      │                                        │
                      │  ┌────────────┐     ┌───────────────┐  │
                      │  │ Caddy SSL  │ ──> │  Express API  │  │
                      │  │ (:443)     │     │  (Port 4000)  │  │
                      │  └────────────┘     └───────┬───────┘  │
                      │                             │          │
                      │  ┌────────────┐     ┌───────▼───────┐  │
                      │  │   Redis    │ <── │ BullMQ Worker │  │
                      │  │ (:6379)    │     │ (Concurrency) │  │
                      │  └────────────┘     └───────┬───────┘  │
                      └─────────────────────────────┼──────────┘
                                                    │
                                     Pooled DB Query│(AES-256-GCM)
                                                    ▼
                      ┌────────────────────────────────────────┐
                      │          Supabase PostgreSQL           │
                      │       Port 6543 (Tx Pooler)            │
                      │       Port 5432 (Session Migrations)   │
                      └────────────────────────────────────────┘
```

---

## 2. Server Provisioning (AWS EC2)

### A. Recommended Instance Spec
- **Type**: `t4g.small` or `t3.small` (2 vCPU, 2GB RAM minimum).
- **OS**: Ubuntu 24.04 LTS.
- **Storage**: 20GB gp3 SSD.
- **Security Group Inbound Rules**:
  - Port 22 (SSH) from your administrative IP.
  - Port 80 (HTTP) from `0.0.0.0/0` (for ACME challenge).
  - Port 443 (HTTPS) from `0.0.0.0/0` (public API & webhook endpoint).

### B. System Dependencies
SSH into the EC2 instance and install Node.js 22, pnpm, Redis, and Caddy:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Install pnpm
sudo npm install -g pnpm@12.21.0

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable --now redis-server

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

### C. Create Dedicated System User
```bash
sudo useradd -m -s /bin/bash replyza
sudo mkdir -p /var/www/replyza
sudo chown -R replyza:replyza /var/www/replyza
```

---

## 3. Environment Configuration

Create the production environment file at `/etc/replyza.env`:

```bash
sudo cp deploy/env.production.example /etc/replyza.env
sudo chown replyza:replyza /etc/replyza.env
sudo chmod 600 /etc/replyza.env
sudo nano /etc/replyza.env
```

Ensure all variables are populated:
- `NODE_ENV=production`
- `PORT=4000`
- `FRONTEND_URL=https://replyza.buzz` (No trailing slash)
- `PROXY_SHARED_SECRET`: Cryptographic 64-char random hex string.
- `DATABASE_URL`: Supabase Transaction Pooler URL (`port 6543` with `?pgbouncer=true&connection_limit=10`).
- `DIRECT_URL`: Supabase Session Pooler URL (`port 5432`).
- `REDIS_URL=redis://127.0.0.1:6379`
- `JWT_SECRET` & `SESSION_SECRET`: 64-character random hex strings.
- `META_TOKEN_ENCRYPTION_KEY`: 64-character hexadecimal key for AES-256-GCM.
- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_LOGIN_CONFIG_ID`.
- `META_REDIRECT_URI=https://api.replyza.buzz/api/v1/instagram/oauth/callback`
- Feature flags (default true): `ENABLE_MEDIA_LIBRARY=true`, `ENABLE_FOLLOW_GATE=true`, `ENABLE_TEMPLATES=true`, `ENABLE_NEW_BUILDER=true`.

---

## 4. Systemd Services Setup

Install the API and background worker systemd units:

```bash
# Copy unit files
sudo cp deploy/replyza-api.service /etc/systemd/system/
sudo cp deploy/replyza-worker.service /etc/systemd/system/

# Reload systemd and enable services
sudo systemctl daemon-reload
sudo systemctl enable replyza-api replyza-worker
```

### Useful Service Commands
```bash
# Check status
sudo systemctl status replyza-api
sudo systemctl status replyza-worker

# Inspect live logs
sudo journalctl -u replyza-api -f
sudo journalctl -u replyza-worker -f

# Restart services
sudo systemctl restart replyza-api replyza-worker
```

---

## 5. Caddy Reverse Proxy & HTTPS

Configure Caddy to handle automatic TLS termination and proxy to port 4000:

```bash
# Copy Caddyfile
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile

# Validate and reload Caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 6. Vercel Frontend Deployment

1. Connect the GitHub repository to Vercel.
2. Set Root Directory to `apps/web`.
3. Configure the following environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_API_URL=https://api.replyza.buzz`
   - `INTERNAL_API_URL=https://api.replyza.buzz`
   - `FRONTEND_URL=https://replyza.buzz`
   - `PROXY_SHARED_SECRET`: (Must match `PROXY_SHARED_SECRET` in `/etc/replyza.env` on EC2).
   - Feature flags (default true): `NEXT_PUBLIC_ENABLE_MEDIA_LIBRARY=true`, `NEXT_PUBLIC_ENABLE_FOLLOW_GATE=true`, `NEXT_PUBLIC_ENABLE_TEMPLATES=true`, `NEXT_PUBLIC_ENABLE_NEW_BUILDER=true`.
4. Deploy the production branch.

---

## 7. Meta App Review & Webhooks Setup

1. **Meta App Dashboard**:
   - Set **App Domains** to `replyza.buzz` and `api.replyza.buzz`.
   - Set **Privacy Policy URL** to `https://replyza.buzz/privacy`.
   - Set **Terms of Service URL** to `https://replyza.buzz/terms`.
   - Set **User Data Deletion Callback URL** to `https://api.replyza.buzz/api/v1/meta/data-deletion`.
2. **Facebook Login for Business**:
   - Valid OAuth Redirect URIs: `https://api.replyza.buzz/api/v1/instagram/oauth/callback`.
3. **Webhooks**:
   - Callback URL: `https://api.replyza.buzz/api/v1/webhooks/instagram`.
   - Verify Token: (Matches `META_WEBHOOK_VERIFY_TOKEN`).
   - Subscribe to the `Instagram` object and both `comments` and `messages` fields (required for follow check interactive Quick Reply callbacks).
4. **Required Permissions**:
   - `instagram_basic`: Access connected Instagram account profiles and media feed.
   - `instagram_manage_comments`: Monitor comments and publish public responses.
   - `instagram_manage_messages`: Send private Direct Messages and interactive Quick Reply buttons.

---

## 8. Database Migrations & Rollback Procedures

### A. Deploying Additive Enhancement Migrations

Run Prisma migrations using the Session Pooler (`DIRECT_URL` on port 5432):

```bash
cd /var/www/replyza
pnpm --filter @replyza/database prisma migrate deploy
```

This applies `20261124160000_add_product_enhancements`:
- Adds `followRequired`, `followInstructionText`, `followSuccessText`, `followFallbackText`, `templateId` to `automations`.
- Creates the `automation_templates` table.
- All schema changes are 100% additive and backward-compatible with zero downtime.

### B. Rollback Runbook

If an emergency rollback is required:

1. Execute the rollback SQL script located at:
   `packages/database/prisma/rollbacks/20261124160000_add_product_enhancements_rollback.sql`
   ```bash
   psql "$DIRECT_URL" -f packages/database/prisma/rollbacks/20261124160000_add_product_enhancements_rollback.sql
   ```
2. Mark the migration as rolled back in Prisma's tracking table:
   ```bash
   pnpm --filter @replyza/database prisma migrate resolve --rolled-back 20261124160000_add_product_enhancements
   ```
3. Set feature flags to `false` in `/etc/replyza.env` and restart services:
   ```bash
   sudo systemctl restart replyza-api replyza-worker
   ```

---

## 9. Manual Real-Account Verification Plan

Execute these steps with a real Instagram Creator/Business test account and a secondary personal follower account:

### Step 1: Connect Real Account
1. Log in to the Replyza dashboard at `https://replyza.buzz/login`.
2. Navigate to `/instagram` and click **Connect Instagram with Meta**.
3. Complete the Facebook Login for Business dialog, granting `instagram_basic`, `instagram_manage_comments`, and `instagram_manage_messages`.
4. Verify your account is listed with an active green status.

### Step 2: Browse Media Library
1. Navigate to `/media`.
2. Confirm your recent feed posts, reels, and carousels appear with correct captions and thumbnails.
3. Test filter pills (`All`, `Reels`, `Photos`, `Carousels`).
4. Click **Automate Post** on a selected post.

### Step 3: Configure Automation via 6-Step Builder
1. Confirm the wizard pre-selects your chosen post and lands on **Step 2 (Template)**.
2. Choose the **Follow-to-Get-Link** or **Product Promotion** template.
3. In Step 3, enter a target keyword (e.g. `TESTPROMO`).
4. In Step 4, customize the public reply and DM text using variables (`{{first_name}}`, `{{username}}`).
5. In Step 5, enter a test destination URL (e.g. `https://yourbrand.com/promo`).
6. In Step 6, inspect the Live Instagram Phone Simulator. Click **Activate Automation**.

### Step 4: Execute Live Comment Test
1. From a secondary personal Instagram account, open the selected post on the Instagram mobile app.
2. Comment: `Can I get the TESTPROMO please?`
3. Verify:
   - Public comment reply is posted by your business account within seconds.
   - Private Direct Message is received from your business account.
   - If Follow-to-Get-Link was enabled: DM contains the interactive **I've followed! ✅** Quick Reply button.
   - Tap the Quick Reply button -> verify Replyza checks follower status via Meta Graph API and immediately delivers the link.

### Step 5: Duplicate and Pause Verification
1. Post a duplicate keyword comment from the same user: verify no second DM is sent (idempotency).
2. Pause the automation in `/automations`: verify incoming comments no longer trigger responses.
