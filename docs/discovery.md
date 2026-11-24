# Replyza Product Enhancements — Discovery & Architecture Document

**Document Version:** 1.0.0  
**Date:** November 2026  
**Status:** Phase 0 Complete — Awaiting Approval to Begin Phase 1  

---

## 1. Executive Summary & Architecture Overview

Replyza is a multi-tenant Instagram comment-to-DM automation SaaS. When an Instagram user comments on a connected business account's post or reel, the platform evaluates configured triggers, publishes a public comment reply, and sends a private direct message (DM).

### Current System Topology
- **Web Frontend (`apps/web`)**: Next.js 16 (App Router, React 19, Tailwind CSS 4) hosted on Vercel. Communicates with the API via client-side proxy route (`/api/proxy/[...path]`) keeping tokens secure.
- **Backend API (`apps/api`)**: Node.js & Express with TypeScript running on AWS EC2. Handles authentication, Instagram OAuth, webhook reception from Meta, and automation CRUD.
- **Worker Service (`apps/worker`)**: BullMQ consumer running on AWS EC2 alongside Redis. Manages queue execution, distributed leasing, idempotency locks, and resilient communication with the Meta Graph API.
- **Database (`packages/database`)**: PostgreSQL (managed via Supabase) using Prisma 7 with client generated at `@replyza/database`.
- **Shared Utilities (`packages/shared`)**: Shared cryptographic helpers (AES-256-GCM token encryption) and common types.

```
+-----------------------------------------------------------------------------------+
|                                 REPLYZA TOPOLOGY                                  |
|                                                                                   |
|  [ Vercel: Next.js 16 Web App ] <---> [/api/proxy] <---> [ AWS EC2: Express API ] |
|                                                                    |              |
|                                                                    v              |
|  [ Supabase: PostgreSQL ] <------------------------------ [ Redis / BullMQ ]      |
|           ^                                                        |              |
|           |                                                        v              |
|           +--------------------------------------------- [ AWS EC2: Worker ]      |
|                                                                    |              |
|                                                                    v              |
|                                                         [ Meta Graph API v27.0 ]  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Meta Capability Matrix & API Constraints

To ensure zero production breakages and prevent account suspensions, all features adhere strictly to Meta's official documentation. We never simulate, mock-and-ship, or invent unsupported Meta behavior.

| Feature Requirement | Meta Capability Status | Endpoint / Graph Method | Required Permissions | Official Limits & Behavior | Official Documentation Reference |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Instagram Media Library** | **Fully Supported** | `GET /v27.0/{ig-user-id}/media` | `instagram_business_basic` | • Query fields: `id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp`<br>• Pagination: Cursor-based via `paging.cursors.after`<br>• `media_product_type`: `FEED`, `REELS`, `STORY`, `AD`<br>• Reels use `thumbnail_url`<br>• Rate limit: 200 calls/hr/user (Business Use Case) | [Meta Media Endpoint Docs](https://developers.facebook.com/docs/instagram-platform/reference/instagram-user/media) |
| **Public Comment Reply** | **Fully Supported** | `POST /v27.0/{ig-comment-id}/replies` | `instagram_manage_comments` | • Payload: `message=<text>`<br>• Must be executed while comment is active<br>• Rate limit: Subject to standard Instagram spam prevention rules | [Meta Comment Moderation](https://developers.facebook.com/docs/instagram-platform/comment-moderation) |
| **Private Reply (Comment to DM)** | **Fully Supported** (Strict Constraints) | `POST /v27.0/{ig-user-id}/messages` | `instagram_manage_messages` | • Payload: `recipient: { comment_id: "<COMMENT_ID>" }`<br>• **Single Reply Limit**: Exactly **one** private reply per comment is permitted<br>• **7-Day Window**: Must be sent within 7 days of the comment<br>• **Window Rule**: Sending a private reply does **NOT** open the standard 24-hour messaging window! | [Meta Private Replies Docs](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/private-replies) |
| **Follower Status Check (`is_user_follow_business`)** | **Conditional / Two-Stage Consent Flow** | `GET /v27.0/{IGSID}?fields=is_user_follow_business,name,username` | `instagram_manage_messages` | • **CRITICAL CONSTRAINT**: Attempting to call this endpoint at comment-time fails with `(#100) User consent is required`<br>• User consent is **only** established once the user interacts with the business in DM (e.g. tapping a Quick Reply button or sending a message)<br>• Commenter Instagram ID != Messaging IGSID until DM interaction occurs | [Meta User Profile API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/user-profile) |
| **Follow-to-Get-Link Delivery (Standard DM)** | **Fully Supported** (Post-Consent) | `POST /v27.0/{ig-user-id}/messages` | `instagram_manage_messages` | • Payload: `recipient: { id: "<IGSID>" }`, `message: { text: "..." }`<br>• Allowed **only** within the 24-hour messaging window opened by the user's Quick Reply tap<br>• Once consent is granted, the app verifies `is_user_follow_business` and dispatches link or fallback | [Meta Send API / 24h Window](https://developers.facebook.com/docs/messenger-platform/send-messages) |

### The Honest "Follow-to-Get-Link" Architecture
Because Meta prevents checking follower status or sending unsolicited links outside the 24-hour window, the **Follow-to-Get-Link** workflow must be implemented as a compliant two-step conversational interaction:
1. **Comment Trigger**: User comments on a post or reel.
2. **Initial Response**: Replyza publishes the public comment reply and sends a private reply DM via `recipient: { comment_id }` with an interactive Quick Reply button:
   - Message: `followInstructionText` (e.g., *"Hey {{first_name}}! Thanks for commenting. Follow our page and tap the button below to get your link instantly! 👇"*)
   - Quick Reply button: `{"content_type": "text", "title": "I've followed! ✅", "payload": "FOLLOW_CHECK:<execution_id>"}`.
3. **User Action**: The user taps *"I've followed! ✅"* in their Instagram DM inbox.
4. **Consent & 24h Window Opening**: Meta delivers an `entry[].messaging` webhook event with the user's `IGSID` (sender ID). This tap constitutes explicit user consent and opens the official 24-hour messaging window.
5. **Follower Verification**: The worker/service queries `GET /v27.0/{IGSID}?fields=is_user_follow_business`.
6. **Result Branching**:
   - **User IS following (`is_user_follow_business === true`)**: Worker dispatches the link DM (`followSuccessText` + `dmLink`) directly to `{ recipient: { id: IGSID } }`. Execution marked `COMPLETED`.
   - **User is NOT following (`is_user_follow_business === false`)**: Worker sends `followFallbackText` (e.g., *"Looks like you haven't followed @handle yet! Please hit follow and tap the button below."*) with the retry Quick Reply button.

---

## 3. Analysis of Existing Codebase & Identified Risks

### 1. Webhook Scope & Event Ingestion
- **Current State**: `apps/api/src/services/instagram-webhook.service.ts` only processes `rawEntry.changes` where `field === "comments"`. Any incoming `rawEntry.messaging` payload is ignored.
- **Required Fix**: Extend webhook handling to support `rawEntry.messaging` events (specifically `messaging.postback` or `messaging.message.quick_reply`).
- **Risk Mitigation**: Messaging webhooks must be deduplicated using `message.mid` or `postback.mid` to prevent double-processing on Meta retries.

### 2. Single-Shot Private Reply Enforceability
- **Constraint**: Meta enforces that only one private reply may ever be sent per comment ID. If a worker job retries `sendPrivateReply` after a network hiccup where Meta actually received the message, Meta returns `(#100) This comment already has a private reply`.
- **Mitigation**: Our existing `action-state.service.ts` and `execution-lease.service.ts` already record `metaPrivateReplyId` and use pessimistic leasing. We will ensure the Quick Reply configuration is included in this single private reply call.

### 3. Token Validity & Long-Lived Refresh
- **Current State**: Tokens are long-lived user/page tokens (valid for ~60 days).
- **Risk**: If a user revokes permissions or the token expires, media listing and message sending will fail with error code `190`.
- **Mitigation**: Implement robust error detection in the media fetch and worker service. When Meta returns error `190` (Invalid OAuth access token), mark `instagram_accounts.status = 'NEEDS_RECONNECT'` and notify the user on the dashboard with a reconnection alert.

### 4. Zero Downtime & Backward Compatibility
- **Constraint**: Existing automations in production must continue operating without interruption.
- **Mitigation**: All database schema changes will be purely additive (new columns with default values or nullable, new independent tables). Existing triggers `ANY_COMMENT` and `KEYWORD` remain unchanged.

---

## 4. Implementation Plan

### Phase 1: Foundation (Database & Feature Flags)
1. **Additive Database Migrations**:
   - Update `automations` table:
     - `followRequired` (Boolean, default `false`)
     - `followInstructionText` (Text, nullable)
     - `followSuccessText` (Text, nullable)
     - `followFallbackText` (Text, nullable)
     - `templateId` (UUID, nullable)
   - New table `automation_templates`:
     - `id` (UUID, PK)
     - `userId` (UUID, nullable for system templates)
     - `name` (String)
     - `category` (String)
     - `description` (Text?)
     - `triggerType` (`AutomationTrigger`)
     - `keywords` (Text[])
     - `publicReplyText` (Text)
     - `dmMessageText` (Text)
     - `dmLink` (Text?)
     - `followRequired` (Boolean, default `false`)
     - `followInstructionText` (Text?)
     - `followSuccessText` (Text?)
     - `followFallbackText` (Text?)
     - `isSystem` (Boolean, default `false`)
     - `createdAt`, `updatedAt`
   - SQL rollback scripts for every migration in `packages/database/prisma/rollbacks/`.
   - Verify tenant isolation: Ensure all queries are scoped by `userId` or `instagramAccountId`.
2. **Feature Flags**:
   - Configuration in `apps/api/src/config/features.ts` and `apps/web/src/lib/features.ts` for gradual enablement:
     - `ENABLE_MEDIA_LIBRARY` (default `true`)
     - `ENABLE_FOLLOW_GATE` (default `true`)
     - `ENABLE_TEMPLATES` (default `true`)
     - `ENABLE_NEW_BUILDER` (default `true`)

### Phase 2: Feature Implementation

#### 2.1 Instagram Media Library
- **Backend**:
  - Service: `apps/api/src/services/instagram-media.service.ts` querying Meta Graph API `GET /{ig-user-id}/media`.
  - Redis Caching: 5-minute cache TTL (`ig:media:{accountId}:{cursor}`) to avoid hitting Meta rate limits during frequent navigation.
  - Controller & Routes: `GET /api/v1/instagram/accounts/:accountId/media` supporting cursor pagination (`after`).
- **Frontend**:
  - `apps/web/src/app/(dashboard)/media/page.tsx`: Media grid view.
  - Component `apps/web/src/components/media/media-card.tsx`: Shows thumbnail, post type badge (`REEL`, `POST`, `CAROUSEL`), date, caption excerpt, and permalink link.
  - "Create Automation" button: Instantly navigates to `/automations/new?mediaId=...&permalink=...&mediaType=...`, completely removing manual Media ID entry across the entire app.

#### 2.2 Follow-to-Get-Link Engine
- **Backend / Webhook Ingestion**:
  - Update `apps/api/src/services/instagram-webhook.service.ts` to inspect `rawEntry.messaging`.
  - Extract quick reply postback payload `FOLLOW_CHECK:<execution_id>`.
  - Enqueue follow-check job into BullMQ `follow-check-queue`.
- **Worker**:
  - Processor: `apps/worker/src/processors/follow-check.processor.ts`.
  - Check follower status via `GET /v27.0/{IGSID}?fields=is_user_follow_business`.
  - If following: Send `followSuccessText` + `dmLink` via `POST /v27.0/{ig-user-id}/messages`.
  - If not following: Send `followFallbackText` with repeat Quick Reply button.
- **Graph Service**:
  - Enhance `apps/worker/src/services/instagram-graph.service.ts` with `sendPrivateReplyWithQuickReply` and `sendDirectMessage`.

#### 2.3 Automation Templates & Variable Engine
- **System Templates**:
  1. *Get Link / Resource Delivery*: Keyword trigger "LINK" -> DM with resource link.
  2. *Product Promotion / Discount Code*: Trigger on "PROMO" or "DEAL" -> Delivers promo code & checkout link.
  3. *Free Guide / Lead Gen*: Trigger on "GUIDE" -> Delivers downloadable PDF guide.
  4. *Follow-Gated VIP Access*: Requires following before delivering VIP discount/link.
  5. *Custom Blank*: Clean slate for advanced creators.
- **Variable Engine**:
  - Interpolation helper `replaceVariables(template, { first_name, username, keyword, link })`.
  - Safe fallbacks: If `first_name` is missing or blank, cleanly falls back to `"there"` or `username`.
- **Frontend Live Preview**:
  - Interactive Instagram chat bubble and comment thread simulator updating in real time as the user types.
- **User Custom Templates**:
  - Ability for users to save any active automation as a reusable template.

#### 2.4 6-Step Automation Builder Flow
- Guided wizard in `apps/web/src/components/automations/builder/`:
  - **Step 1: Select Media**: Visual grid of recent posts & reels (or option to apply to all media if desired).
  - **Step 2: Choose Template**: Select from proven templates or start from scratch.
  - **Step 3: Trigger Settings**: Choose "Any comment" vs. "Specific keywords" with tag input.
  - **Step 4: Craft Responses**: Public comment replies (with variation support) and initial DM copy.
  - **Step 5: Follow Gate & Link**: Toggle Follow-to-Get-Link, configure success/fallback copy, and set target URL.
  - **Step 6: Preview & Activate**: Side-by-side Instagram mockups (Comment + DM inbox) and 1-click activation.
- LocalStorage draft auto-save so user progress is never lost on refresh.
- Edit mode support for existing automations.

#### 2.5 UI/UX Redesign
- Clean, high-conversion SaaS aesthetic adhering to modern design principles:
  - High typographic clarity, crisp borders, subtle shadows (`shadow-xs` / `shadow-sm`).
  - Redesigned dashboard metrics with trend indicators and status breakdowns.
  - Polished responsive layouts tested at mobile (375px), tablet (768px), and desktop (1280px+).

---

## 5. Migration List

All migrations are additive. Existing columns and tables are strictly preserved.

### 1. Prisma Schema Changes (`packages/database/prisma/schema.prisma`)
```prisma
// 1. Additive fields to Automation
model Automation {
  // Existing fields remain unchanged...
  followRequired       Boolean   @default(false)
  followInstructionText String?   @db.Text
  followSuccessText    String?   @db.Text
  followFallbackText   String?   @db.Text
  templateId           String?   @db.Uuid
}

// 2. New AutomationTemplate model
model AutomationTemplate {
  id                   String            @id @default(uuid()) @db.Uuid
  userId               String?           @db.Uuid
  name                 String
  category             String
  description          String?           @db.Text
  triggerType          AutomationTrigger @default(KEYWORD)
  keywords             String[]          @default([])
  publicReplyText      String            @db.Text
  dmMessageText        String            @db.Text
  dmLink               String?
  followRequired       Boolean           @default(false)
  followInstructionText String?          @db.Text
  followSuccessText    String?           @db.Text
  followFallbackText   String?           @db.Text
  isSystem             Boolean           @default(false)
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  user                 User?             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isSystem])
  @@map("automation_templates")
}
```

### 2. Forward SQL Migration (`20261124_product_enhancements.sql`)
```sql
-- Additive columns to automations
ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "followRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "followInstructionText" TEXT,
  ADD COLUMN IF NOT EXISTS "followSuccessText" TEXT,
  ADD COLUMN IF NOT EXISTS "followFallbackText" TEXT,
  ADD COLUMN IF NOT EXISTS "templateId" UUID;

-- Create automation_templates table
CREATE TABLE IF NOT EXISTS "automation_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "triggerType" "AutomationTrigger" NOT NULL DEFAULT 'KEYWORD',
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "publicReplyText" TEXT NOT NULL,
  "dmMessageText" TEXT NOT NULL,
  "dmLink" TEXT,
  "followRequired" BOOLEAN NOT NULL DEFAULT false,
  "followInstructionText" TEXT,
  "followSuccessText" TEXT,
  "followFallbackText" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "automation_templates_userId_idx" ON "automation_templates"("userId");
CREATE INDEX IF NOT EXISTS "automation_templates_isSystem_idx" ON "automation_templates"("isSystem");
```

### 3. Rollback SQL Script (`packages/database/prisma/rollbacks/20261124_product_enhancements_rollback.sql`)
```sql
-- Drop automation_templates table
DROP TABLE IF EXISTS "automation_templates";

-- Remove additive columns from automations
ALTER TABLE "automations"
  DROP COLUMN IF EXISTS "followRequired",
  DROP COLUMN IF EXISTS "followInstructionText",
  DROP COLUMN IF EXISTS "followSuccessText",
  DROP COLUMN IF EXISTS "followFallbackText",
  DROP COLUMN IF EXISTS "templateId";
```

---

## 6. Risk Assessment & Mitigation Strategies

| Risk | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Meta User Consent / Policy Violation** | High | Low | Never attempt follower checks at comment time. Strictly use interactive Quick Reply buttons to collect explicit user consent and open the 24-hour messaging window. |
| **Meta Rate Limits on Media Fetch** | Medium | Medium | Implement Redis caching with a 5-minute TTL per account media request. Only fetch when cache expires or on explicit user refresh. |
| **24-Hour Messaging Window Expiration** | Medium | Low | If a user taps the Quick Reply button after more than 24 hours, handle Meta window expiration errors gracefully and log execution status as `EXPIRED_WINDOW`. |
| **Token Invalidation (Code 190)** | High | Medium | Inspect Graph API error codes; if OAuth token is revoked or expired, update `InstagramAccount.status = 'NEEDS_RECONNECT'` and display user alert. |
| **Prisma 7 / PostgreSQL Migration Drift** | High | Low | Run safe additive migrations verified on local test database (`replyza_test` on `127.0.0.1:5433`). Check database host before every run. Provide tested rollback SQL. |
| **UI Regressions on Existing Automations** | Medium | Low | Maintain full backward compatibility for `Automation` records where `followRequired === false`. Run existing 41 Vitest tests and Playwright E2E suite. |

---

## 7. Next Steps & Phase Progression

- [x] **Phase 0: Discovery**: Completed analysis, Meta capability matrix, risk assessment, and implementation plan.
- [ ] **Phase 1: Foundation**: Await user approval. Upon approval, apply additive Prisma migrations, write rollbacks, and set up feature flags.
- [ ] **Phase 2: Feature Implementation**: Build Media Library, Follow-to-Get-Link engine, Templates, 6-Step Builder, and UI Redesign.
- [ ] **Phase 3: Testing & Verification**: Execute unit, integration, and Playwright tests against real local PostgreSQL & Redis. Provide manual real-account test plan.
- [ ] **Phase 4: Production Readiness**: Verify migration safety, write deployment documentation, and prepare release.
