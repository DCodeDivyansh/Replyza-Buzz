# Replyza Deployment & Production Readiness Guide

This document covers safe, zero-downtime rollout of the `feat/manychat-engine` changes to production (`apps/web` on Vercel, `apps/api` + `apps/worker` on AWS EC2, PostgreSQL on Supabase, Redis).

---

## 1. Pre-Deploy Verification Gate
Run locally before merging `feat/manychat-engine`:
```powershell
pnpm build:all
pnpm typecheck
pnpm lint:web
pnpm test
pnpm smoke
pnpm smoke:web
```

---

## 2. Production Environment & Meta Config Audit Checklist
Verify these environment variables on EC2 (`apps/api`, `apps/worker`) and Vercel (`apps/web`):

- `META_GRAPH_API_VERSION` — **Required** (no silent fallback). Set explicitly (e.g. `v22.0`).
- `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` — Facebook Login for Business configuration.
- `META_TOKEN_ENCRYPTION_KEY` — 32-byte hex/base64 key for AES-256-GCM token encryption.
- `SESSION_SECRET` — Used for JWT signing and HMAC-SHA256 `FOLLOW_CHECK` payload signing.
- `DATABASE_URL` & `DIRECT_URL` — Supabase PostgreSQL pooled + direct URLs.
- `REDIS_URL` — Redis connection string for BullMQ + webhook fast-path dedupe.

### Feature Flags (Safe Rollout)
All new engine flags default to **`false` in `NODE_ENV=production`** and `true` in dev/test:
- `FEATURE_MANYCHAT_ENGINE=false`
- `FEATURE_INDEPENDENT_ACTIONS=false`
- `FEATURE_FOLLOW_CHECK_SIGNED_TOKENS=false`
- `FEATURE_DM_ME_FALLBACK=false`

Roll out in order after deploy:
1. Deploy code + DB migration with all flags `false` (legacy path remains active).
2. Enable `FEATURE_FOLLOW_CHECK_SIGNED_TOKENS=true` & `FEATURE_INDEPENDENT_ACTIONS=true`.
3. Enable `FEATURE_MANYCHAT_ENGINE=true`, then `FEATURE_DM_ME_FALLBACK=true`.

### Meta App Dashboard Checklist
- Webhooks subscribed fields: `comments`, `messages`, `messaging_postbacks`.
- Facebook Login for Business `config_id` includes: `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `business_management`.

---

## 3. Additive Database Migration & Rollback
Apply migration (additive, backward-compatible — `mediaId` becomes nullable, new `delivery_actions` table and columns added):
```bash
pnpm --filter @replyza/database exec prisma migrate deploy
```

If rollback is ever required:
```bash
psql "$DIRECT_URL" -f packages/database/prisma/rollbacks/20261125020000_manychat_engine_and_delivery_actions_rollback.sql
```

---

## 4. Webhook Subscription Backfill (for Existing Accounts)
Existing connected accounts may not yet have `messaging_postbacks` subscribed.
1. Dry run first:
   ```bash
   npx tsx scripts/backfill-subscriptions.ts
   ```
2. Apply to active accounts:
   ```bash
   npx tsx scripts/backfill-subscriptions.ts --apply
   ```

---

## 5. Rollout Order
1. Run `prisma migrate deploy` against Supabase `DIRECT_URL`.
2. Deploy `apps/api` and `apps/worker` on EC2 (build `@replyza/shared`, `@replyza/database`, `@replyza/api`, `@replyza/worker`, restart PM2/systemd processes).
3. Deploy `apps/web` to Vercel.
4. Run `backfill-subscriptions.ts --apply`.
5. Flip feature flags to `true` gradually and monitor `/api/v1/health` and worker logs.
