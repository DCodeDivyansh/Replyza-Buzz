# Replyza — Database Migration Report (Phase 1)

**Date**: November 2026  
**Status**: VERIFIED & APPLIED LOCALLY (127.0.0.1:5433)  
**Database**: PostgreSQL 16 (Supabase-compatible)  
**Prisma Version**: 7.10.1  

---

## 1. Migration Overview

### Applied Migrations

1. `20261122045915_init`: Core user authentication, Instagram accounts, automations, webhook events, and execution records.
2. `20261122082726_add_refresh_tokens`: Refresh token family tracking for secure rotation and replay detection.
3. `20261122101158_add_comment_automation`: Trigger configurations, keywords array, and public/private message fields.
4. `20261123101038_add_action_processing_states`: Explicit `ActionStatus` state tracking for public reply and private DM.
5. `20261123104953_add_execution_lease`: Distributed execution lease expiration timestamp for worker crash safety.
6. `20261123110456_add_execution_lease_token`: Cryptographic UUID lease token for optimistic concurrency locking.
7. `20261124084500_add_instagram_account_status`: Account status enum (`ACTIVE` | `NEEDS_RECONNECT`) for token expiration handling.
8. `20261124160000_add_product_enhancements`: Additive fields for Follow-to-Get-Link, and `automation_templates` table.
9. `20261124180000_add_messaging_events_and_follow_tracking`:
   - Durable deduplication table `messaging_webhook_events` with `@@unique([instagramAccountId, providerEventId])`.
   - Durable follow-check tracking fields on `automation_executions` (`followCheckStatus`, `followCheckSentAt`, `followCheckVerifiedAt`, `followCheckRetryCount`, `metaFollowCheckReplyId`).

---

## 2. Table Schemas & Constraints

### A. `messaging_webhook_events` (New Table)

```sql
CREATE TABLE "messaging_webhook_events" (
    "id" UUID NOT NULL PRIMARY KEY,
    "instagramAccountId" UUID NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "payload" TEXT,
    "executionId" UUID,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "messaging_webhook_events_instagramAccountId_fkey" 
      FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE,
    CONSTRAINT "messaging_webhook_events_executionId_fkey" 
      FOREIGN KEY ("executionId") REFERENCES "automation_executions"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "messaging_webhook_events_instagramAccountId_providerEventId_key" 
  ON "messaging_webhook_events"("instagramAccountId", "providerEventId");

CREATE INDEX "messaging_webhook_events_executionId_idx" 
  ON "messaging_webhook_events"("executionId");

CREATE INDEX "messaging_webhook_events_status_receivedAt_idx" 
  ON "messaging_webhook_events"("status", "receivedAt");
```

### B. `automation_executions` (Updated Columns)

```sql
ALTER TABLE "automation_executions"
  ADD COLUMN "followCheckStatus" "ActionStatus" DEFAULT 'PENDING',
  ADD COLUMN "followCheckSentAt" TIMESTAMP(3),
  ADD COLUMN "followCheckVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "followCheckRetryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "metaFollowCheckReplyId" TEXT;
```

---

## 3. Rollback Procedures & Verification

Every migration includes a standalone, idempotent rollback script:

| Migration | Rollback Script |
| :--- | :--- |
| `20261124160000_add_product_enhancements` | `packages/database/prisma/rollbacks/20261124160000_add_product_enhancements_rollback.sql` |
| `20261124180000_add_messaging_events_and_follow_tracking` | `packages/database/prisma/rollbacks/20261124180000_add_messaging_events_and_follow_tracking_rollback.sql` |

### Rollback Execution Command:
```bash
psql "$DIRECT_URL" -f packages/database/prisma/rollbacks/20261124180000_add_messaging_events_and_follow_tracking_rollback.sql
pnpm --filter @replyza/database prisma migrate resolve --rolled-back 20261124180000_add_messaging_events_and_follow_tracking
```

---

## 4. Verification Checklist

- [x] Prisma schema validates (`prisma validate` passes)
- [x] Migration applied to fresh database (`replyza_test`)
- [x] Migration applied to development database (`replyza`)
- [x] Prisma Client re-generated successfully
- [x] Database package built with TypeScript compiler (0 errors)
- [x] Multi-tenant cascading rules verified (`ON DELETE CASCADE` on `instagramAccountId`, `ON DELETE SET NULL` on `executionId`)
- [x] Event uniqueness constraint verified on `(instagramAccountId, providerEventId)`
