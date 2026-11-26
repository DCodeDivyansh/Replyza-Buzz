# Replyza — Phase 1 Full Code Analysis & ManyChat-Style Engine Audit

**Date:** 2026-11-25  
**Scope:** End-to-end audit of `apps/web`, `apps/api`, `apps/worker`, `packages/database`, and `packages/shared` (read-only analysis; no source code modified).

---

## 1. End-to-End Event-Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. COMMENT INGESTION (apps/api)                                             │
│ Meta Webhook POST /api/v1/webhooks/instagram                                │
│   └─► verifyMetaSignature (rawBody + HMAC-SHA256 timingSafeEqual)           │
│         └─► persistInstagramCommentEvents (instagram-webhook.service.ts)    │
│               ├─ Lookup InstagramAccount by entry.id (instagramUserId)      │
│               ├─ Insert WebhookEvent (unique: [instagramAccountId, commentId])
│               └─► matchAndQueueAutomation (automation-matcher.service.ts)   │
│                     ├─ Transaction: match ACTIVE Automation + create        │
│                     │  AutomationExecution + upsert OutboxEvent (PENDING)   │
│                     └─ Best-effort enqueueAutomationExecution -> BullMQ     │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. WORKER EXECUTION (apps/worker)                                           │
│ processAutomationJob (automation.processor.ts)                              │
│   ├─ claimExecution (PENDING|PARTIAL|RETRY_PENDING -> PROCESSING + lease)   │
│   ├─ Action 1: executeAction("public") -> POST /{commentId}/replies         │
│   ├─ Action 2: executeAction("private") -> POST /{igUserId}/messages        │
│   │     └─ recipient: { comment_id }, quick_replies: [FOLLOW_CHECK:<id>]    │
│   └─ finalizeExecution -> COMPLETED | PARTIAL | RETRY_PENDING | FAILED      │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ User taps Quick Reply in Instagram DM
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MESSAGING WEBHOOK & FOLLOW CHECK (apps/api -> apps/worker)               │
│ Meta Webhook POST /api/v1/webhooks/instagram (entry[].messaging[])          │
│   ├─ persist MessagingWebhookEvent (unique: [instagramAccountId, mid])      │
│   ├─ upsert OutboxEvent (FOLLOW_CHECK) -> enqueueFollowCheck -> BullMQ      │
│   └─► processFollowCheckJob (follow-check.processor.ts)                     │
│         ├─ IDOR & cross-tenant checks (commenterInstagramId === igsid)      │
│         ├─ GET /{igsid}?fields=is_user_follow_business,name,username        │
│         ├─ VERIFIED -> POST /{igUserId}/messages (successText + dmLink)     │
│         ├─ NOT_FOLLOWING -> POST fallbackText + retry Quick Reply (cap 3)   │
│         └─ UNSUPPORTED/PERMISSION_DENIED -> FAILED (honest error persisted) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Meta Capability Findings (Verified Against Official Docs & Repo Config)

- **Configured Graph API Version & Login Flow**:
  - `apps/api/src/config/env.ts:24` requires `META_GRAPH_API_VERSION` (`^v\d+\.\d+$`; test/local setup uses `v27.0`, `MetaGraphClient` default fallback is `v21.0`).
  - `apps/api/src/controllers/instagram-oauth.controller.ts:16-24` uses **Facebook Login for Business** (`https://www.facebook.com/${env.META_GRAPH_API_VERSION}/dialog/oauth` with `config_id: env.META_LOGIN_CONFIG_ID`).
  - `apps/api/src/services/meta-graph.service.ts:87-94` discovers accounts via `GET me/assigned_instagram_accounts?fields=id,username` and subscribes via `POST {instagramUserId}/subscribed_apps` with `subscribed_fields: "feed,comments,messages"`.

- **Verified Meta Platform Rules**:
  1. **Private Replies via `comment_id` with Quick Replies**:
     - `POST /{ig-user-or-page-id}/messages` with `recipient: { comment_id }` **does support** `message.quick_replies` (up to 13 text quick replies, max 20 characters per title; contact-info quick replies disabled on Instagram; mobile-only rendering).
     - Constraint: **One** private reply per comment, within **7 days** of comment creation.
     - Source: `https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api` and `https://developers.facebook.com/documentation/instagram-platform/webhooks`.
  2. **Follower Verification (`is_user_follow_business`)**:
     - `GET /{IGSID}?fields=is_user_follow_business,name,username` is part of the **Instagram User Profile API**.
     - It **only** works after the user has initiated/interacted in a messaging session (consent). Querying at comment time before DM interaction is unsupported/forbidden.
     - Requires `instagram_basic` and `instagram_manage_messages` (with App Review / Advanced Access for live non-test users) and can be omitted by Meta depending on user privacy or access level.
     - Source: `https://developers.facebook.com/documentation/instagram-platform/reference/instagram-user`.
  3. **Commenter ID vs Messaging IGSID**:
     - Under the same app and Instagram Professional account, `comment.from.id` and `messaging.sender.id` map to the user's app-scoped Instagram ID (IGSID), though edge cases across legacy/business-login transitions must still be logged cleanly.
  4. **Messaging Webhook Fields & Event Shapes**:
     - Subscribed fields required: `comments`, `messages`, and `messaging_postbacks` (note: current `meta-graph.service.ts:126` only subscribes `"feed,comments,messages"` — missing `messaging_postbacks`!).
     - Quick reply taps arrive under `entry[].messaging[].message.quick_reply.payload` with `message.mid` and `sender.id`. Postbacks arrive under `entry[].messaging[].postback.payload`.
  5. **24-Hour Window, 7-Day Private Reply & Rate Limits**:
     - **7-day rule**: Private reply via `comment_id` must be sent within 7 days of the comment; it does **not** open a 24-hour window by itself.
     - **24-hour window**: Opens when the user taps the Quick Reply button or sends a DM; resets on each user message. Sending outside the window returns Meta error code `551` / `100` (subcode `2534022` / `2534014`).
     - **Rate limits**: Private replies to comments are capped at **750 calls/hour** per Instagram Professional account; messaging rate limits scale dynamically with engaged users (`X-App-Usage` / codes `4`, `17`, `32`, `613`).

---

## 3. Defect Table

| ID | Symptom | Root Cause (File & Line) | Severity | Fix Plan |
|---|---|---|---|---|
| **D1** | Own public replies can re-enter webhook pipeline and cause reply loops | `apps/api/src/services/instagram-webhook.service.ts:183-210` does not ignore comments where `commenter.id === entryInstagramUserId` | **Critical** | Drop/ignore incoming comment events where `commenter.id === entryInstagramUserId` before creating `WebhookEvent` |
| **D2** | No all-media automations (`mediaId = null`), and multiple automations have no deterministic precedence | `packages/database/prisma/schema.prisma:111,136` makes `mediaId` non-null `String`; `apps/api/src/services/automation-matcher.service.ts:23-29,82-98` only matches exact `mediaId` | **Critical** | Make `mediaId` nullable (`String?`) for all-media automations, replace unique constraint safely, and enforce precedence: media-specific first, then all-media, oldest active (`createdAt ASC`) wins |
| **D3** | Public reply and Hook DM run sequentially instead of independent parallel channels; missing per-action `DeliveryAction` table | `apps/worker/src/processors/automation.processor.ts:601-705` runs public reply then private reply sequentially on one `AutomationExecution` row | **High** | Add `DeliveryAction` model (`PUBLIC_REPLY`, `HOOK_DM`, `LINK_DM`, `FOLLOW_FALLBACK_DM`) and execute `PUBLIC_REPLY` + `HOOK_DM` in parallel with `Promise.allSettled` |
| **D4** | Meta "already replied" errors (`DUPLICATE_ACTION`) are marked `FAILED` instead of `SENT`-equivalent | `apps/worker/src/processors/automation.processor.ts:178-192` marks all non-transient `MetaApiError`s as `FAILED` | **High** | Treat `MetaErrorCategory === "DUPLICATE_ACTION"` as `SENT`-equivalent (`SUCCESS`) so it is never retried or surfaced as failure |
| **D5** | Unsigned `FOLLOW_CHECK:<executionId>` Quick Reply payload can be forged or enumerated | `apps/worker/src/processors/automation.processor.ts:640`, `follow-check.processor.ts:238`, `instagram-webhook.service.ts:95` use raw `FOLLOW_CHECK:<uuid>` | **Critical** | Sign payload with HMAC-SHA256 (`FOLLOW_CHECK:<executionId>.<sig>`) and verify with `timingSafeEqual` in webhook & worker |
| **D6** | `followRequired = false` cannot use two-step hook DM button; tapping button when `followRequired = false` still runs follow check | `apps/worker/src/processors/automation.processor.ts:625-665` & `follow-check.processor.ts:154-205` | **High** | Support `buttonLabel` for two-step hook DM; when `followRequired = false`, tap skips `checkUserFollowsBusiness` and delivers `LINK_DM` immediately |
| **D7** | Unknown / errored follow verification marks `FAILED` immediately without retrying once or sending neutral message | `apps/worker/src/processors/follow-check.processor.ts:173-190` | **Medium** | Retry `UNKNOWN`/`TRANSIENT_ERROR` check once cleanly, then send neutral message if still unavailable; never treat as `NOT_FOLLOWING` |
| **D8** | Keyword matching fails on punctuation/emoji boundaries, lacks `EXACT` mode, and has no per-user cooldown | `apps/api/src/services/automation-matcher.service.ts:37-50,88-96` | **High** | Add `keywordMatchMode` (`CONTAINS \| EXACT`), Unicode/punctuation normalization, and per-user `cooldownSeconds` per automation |
| **D9** | No `DM me <keyword>` fallback when private reply fails permanently | `apps/api/src/services/instagram-webhook.service.ts:60-118` only parses `FOLLOW_CHECK:` payloads | **Medium** | Add opt-in `dmMeFallbackEnabled` on `Automation` and match incoming DM text against active automations' keywords when user DMs first |
| **D10** | Messaging webhook subscription omits `messaging_postbacks` | `apps/api/src/services/meta-graph.service.ts:126` subscribes `"feed,comments,messages"` | **High** | Subscribe to `"feed,comments,messages,messaging_postbacks"` |
| **D11** | Duplicate webhooks hit Postgres before fast Redis dedupe; `automation_templates` missing DB constraints | `instagram-webhook.service.ts`, `packages/database/prisma/schema.prisma:234-260` | **Medium** | Add Redis `SET NX EX` fast-path dedupe (DB unique constraint remains authoritative); add FK on `templateId` (`ON DELETE SET NULL`) and `CHECK ("isSystem" = ("userId" IS NULL))` |
| **D12** | Frontend missing `publicReplyVariations`, `buttonLabel`, `keywordMatchMode`, `cooldownSeconds`, `dmMeFallbackEnabled`, Meta limit explanations, and ManyChat gap documentation | `apps/web/src/components/automations/builder/builder-wizard.tsx`, `apps/web/src/app/(dashboard)/activity/page.tsx` | **Medium** | Update builder, templates, activity log, and add lazy-loading + `next/image` optimization |

---

## 4. Performance Baseline (Measured)

| Metric | Measured Baseline | Notes |
|---|---|---|
| **Web client static chunks** | `27` files, `1,401.1 KB` total (`apps/web/.next/static/chunks`) | Opportunity: lazy-load `BuilderWizard`, `LivePreview`, and `WorkflowDiagram` |
| **DB: Automation match query** | `0.919 ms` execution time (`Index Scan` on `automations_instagramAccountId_mediaId_key`) | Measured via `EXPLAIN ANALYZE` on `replyza_test` |
| **DB: Execution history query** | `0.052 ms` execution time (`Index Scan Backward` on `automation_executions_automationId_createdAt_idx`) | Measured via `EXPLAIN ANALYZE` on `replyza_test` |
| **DB: Messaging dedupe query** | `0.009 ms` execution time (`Index Scan` on `messaging_webhook_events_instagramAccountId_providerEventId_key`) | Measured via `EXPLAIN ANALYZE` on `replyza_test` |
| **Worker parallelism** | `concurrency: 5` on `automation-processing` & `follow-check-processing`; **sequential** public -> private reply per job | Parallelizing `PUBLIC_REPLY` and `HOOK_DM` cuts per-job Meta round-trip time ~2x |
| **Architecture / Region notes** | Vercel (Web) -> AWS EC2 (API + Worker + Redis) -> Supabase (Postgres) | Keep EC2 API & Redis co-located in the same AWS region as Supabase to avoid cross-region DB round-trip amplification |

---

## 5. Implementation Plan (Phases 2–6)

1. **Phase 2 (Reproduce First)**: Create failing integration tests on a feature branch (`feat/manychat-engine`) for concurrent duplicate webhooks (1/2/10x), overlapping automations, mid-job worker kill/retry, and follow-gate tap delivery.
2. **Phase 3 (ManyChat-Style Engine)**:
   - Additive Prisma migration (with rollback SQL tested up/down/up on `replyza_test`): `DeliveryAction` table, `conversationState` on `AutomationExecution`, nullable `mediaId` + `buttonLabel`, `publicReplyVariations`, `keywordMatchMode`, `cooldownSeconds`, `dmMeFallbackEnabled` on `Automation`, FK + CHECK constraint on `AutomationTemplate` + idempotent system template seed.
   - Signed `FOLLOW_CHECK` HMAC payloads, Redis fast-path + DB authoritative dedupe, own-account loop prevention, per-user cooldown, deterministic automation precedence, parallel independent `PUBLIC_REPLY` + `HOOK_DM` channels, `DUPLICATE_ACTION` -> `SENT`-equivalent, `EXPIRED_WINDOW` handling, and opt-in `"DM me"` fallback.
   - Frontend: builder support for all new fields, Meta limit callouts, ManyChat parity/gap documentation, and per-comment activity timeline.
3. **Phase 4 (Performance)**: Parallelize `PUBLIC_REPLY` and `HOOK_DM`, add `next/dynamic` lazy loading on builder/preview, `next/image`, and measure before/after bundle & latency numbers.
4. **Phase 5 (Comprehensive Testing & Load/Soak)**: Full unit, integration, concurrency, failure-matrix, 100-comment burst soak test, Playwright E2E, and manual real-account test script.
5. **Phase 6 (Production Readiness)**: Feature flags defaulting OFF in production, `docs/deployment.md`, and stop for operator approval before deploying.
