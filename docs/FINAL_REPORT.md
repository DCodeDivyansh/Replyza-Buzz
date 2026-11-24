# Replyza ManyChat Automation Engine — Final Engineering Report

**Branch:** `feat/manychat-engine`  
**Scope:** End-to-end rebuild of Replyza's Instagram automation engine into a ManyChat-style two-step conversation flow, defect remediation (`D1`–`D12`), performance optimization, 100-comment burst soak testing, and production rollout readiness.

---

## 1. Executive Summary
Replyza's automation engine has been rebuilt around Meta's Instagram Platform two-step conversation model:
1. **Comment Event** -> **Public Comment Reply** (with variation rotation) + **Private Reply Hook DM** (with an optional Quick Reply button) dispatched **independently in parallel** via per-action `DeliveryAction` rows and BullMQ jobs.
2. **User Tap / Text Consent** -> Opens the 24-hour messaging window -> optional **Follow Verification Gate** (`is_user_follow_business` with bounded retries and safe fallback) -> **Reward DM + Link** delivery.

All 12 audited defects (`D1`–`D12`) were reproduced and resolved, including a critical BullMQ v5 `jobId` colon bug (`"Custom Id cannot contain :"`) discovered during integration testing. All builds, typechecks, lint checks, 94 Vitest tests across 18 suites, backend smoke tests (12 gates), Playwright E2E smoke tests, and a 40,550-row seeded benchmark + 100-comment burst soak test passed after the final code edits.

---

## 2. Audit Findings & Defects Resolved (`D1`–`D12`)
Full details are recorded in [docs/audit.md](file:///e:/Study/Website/Replyza/docs/audit.md) and [docs/decisions.md](file:///e:/Study/Website/Replyza/docs/decisions.md):

| ID | Defect | Root Cause & Fix |
|---|---|---|
| **D1** | Self-reply comment loops | `instagram-webhook.service.ts` now ignores comments where `from.id === entryInstagramUserId`. |
| **D2** | Sequential coupling of public reply & private DM | Split into independent `PUBLIC_REPLY` and `HOOK_DM` `DeliveryAction` rows and BullMQ jobs (`apps/api/src/services/automation-matcher.service.ts`, `apps/worker/src/processors/automation.processor.ts`). |
| **D3** | No "All Posts & Reels" automation support | Made `Automation.mediaId` nullable with partial uniqueness and deterministic precedence (media-specific > all-media > oldest active). |
| **D4** | Meta duplicate-action errors treated as failures | `DUPLICATE_ACTION` (e.g., Meta code `100` / subcode `2534005`) on `HOOK_DM` marks `DeliveryAction` as `SENT` instead of `FAILED`. |
| **D5** | Unsigned `FOLLOW_CHECK:<executionId>` payloads | Added HMAC-SHA256 signing and verification (`signFollowCheckPayload` / `verifyFollowCheckPayload` in `packages/shared/src/follow-token.ts`). |
| **D6** | `followRequired=false` still gated or blocked | `follow-check.processor.ts` skips `is_user_follow_business` when `followRequired === false` and delivers the reward link DM directly. |
| **D7** | `UNSUPPORTED` / `PERMISSION_DENIED` left users hanging | `follow-check.processor.ts` retries once on `UNKNOWN`/`TRANSIENT_ERROR` and sends a polite neutral message on `UNSUPPORTED`/`PERMISSION_DENIED`/`UNKNOWN` without false-verifying. |
| **D8** | Unlimited `NOT_FOLLOWING` retries | Bounded retries (`MAX_FOLLOW_RETRIES = 3`) followed by a closing message and `FAILED` terminal state. |
| **D9** | Inbound `is_echo` DM loops | `instagram-webhook.service.ts` filters `message.is_echo === true` before processing. |
| **D10** | Missing `messaging_postbacks` subscription & stale `v21.0` fallback | Added `messaging_postbacks` to `subscribeWebhooks` (`apps/api/src/services/meta-graph.service.ts`), created `scripts/backfill-subscriptions.ts`, and removed silent `v21.0` fallback in `packages/shared/src/meta-graph-client.ts`. |
| **D11** | Duplicate webhook DB pressure under burst | Added fast-path Redis `SET NX EX 300` (`ig:dedupe:*`) in `instagram-webhook.service.ts` while preserving PostgreSQL unique constraints as the authoritative guard. |
| **D12** | Fragile substring keyword matching | Added Unicode/punctuation/emoji-safe `matchCommentKeywords` (`CONTAINS`, `EXACT`, `ANY`) in `packages/shared/src/keyword-matcher.ts`. |

Additionally, during full-suite verification we uncovered and fixed **BullMQ v5 `jobId` rejection on `:`** (`"Custom Id cannot contain :"`) in `apps/api/src/queues/automation.queue.ts`, `apps/api/src/queues/follow-check.queue.ts`, and `apps/worker/src/services/outbox-dispatcher.service.ts` (replaced `:` with `__`).

---

## 3. ManyChat Two-Step Engine Architecture
- **Atomic Action Claiming (`apps/worker/src/services/delivery-action.service.ts`)**: Uses `UPDATE "delivery_actions" SET "status" = 'SENDING', "attempts" = "attempts" + 1 ... WHERE "status" = 'PENDING' RETURNING` so concurrent workers never double-send.
- **Stale `SENDING` Reconciliation (`apps/worker/src/services/outbox-dispatcher.service.ts`)**: `recoverOrphanedRecords()` transitions `SENDING` actions older than 120 seconds to `NEEDS_REVIEW` (`STALE_SENDING`) without blind resending.
- **Rate Limiting & Retry-After**: BullMQ worker rate limiter (`max: 180, duration: 60_000`) and `Retry-After` parsing (`retryAfterMs`) in `MetaGraphClient`.
- **Desktop Text-Fallback & `dmMeFallbackEnabled`**: Plain-text consent replies (`YES`, `DONE`, `FOLLOWED`, `CHECK`) while `conversationState === "AWAITING_TAP"` enqueue `followCheckQueue`; opt-in `dmMeFallbackEnabled` matches inbound DM keywords when no open execution exists.

---

## 4. Meta Platform Capabilities, Limitations & Cited URLs
- **Private Replies (`POST /{ig-user-id}/messages` with `comment_id`)**: Meta allows **1 Private Reply DM per comment** within **7 days** of the comment. Reference: Meta Instagram Platform Webhooks & Messaging documentation (`https://developers.facebook.com/documentation/instagram-platform/webhooks`, `https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api`).
- **24-Hour Messaging Window**: Tapping a Quick Reply button or sending an inbound DM opens a 24-hour standard messaging window for follow verification and reward link delivery.
- **Follow Verification (`is_user_follow_business`)**: May be omitted (`UNSUPPORTED`) or denied (`PERMISSION_DENIED`) depending on Meta app permissions/user privacy; Replyza never treats `UNSUPPORTED`/`UNKNOWN` as `NOT_FOLLOWING` or `VERIFIED`.
- **Facebook Login for Business (`config_id`)**: Implemented in `apps/api/src/controllers/instagram-oauth.controller.ts` and `instagram-oauth-redirect.controller.ts`.

---

## 5. Database Schema & Additive Migrations
- **Migration**: `packages/database/prisma/migrations/20261125020000_manychat_engine_and_delivery_actions/migration.sql`
- **Tested Rollback**: `packages/database/prisma/rollbacks/20261125020000_manychat_engine_and_delivery_actions_rollback.sql` (verified UP -> insert all-media row -> DOWN -> UP on `replyza_test`).
- **Key Additions**:
  - Enums: `KeywordMatchMode`, `DeliveryMode`, `DeliveryActionType`, `DeliveryActionStatus`, `ConversationState`.
  - `automations`: nullable `mediaId`, `keywordMatchMode`, `deliveryMode`, `buttonLabel`, `publicReplyVariations`, `cooldownSeconds`, `dmMeFallbackEnabled`, `templateId` FK.
  - `automation_executions`: `conversationState`, `commenterIgsid`, `tapEventMid`.
  - `delivery_actions`: per-action idempotent state table with `@@unique([executionId, actionType])`.

---

## 6. Feature Flags & Safe Rollout
Defined in `apps/api/src/config/features.ts` and `apps/web/src/lib/features.ts` (all default `false` in `NODE_ENV === "production"`, `true` in dev/test):
- `MANYCHAT_ENGINE`
- `INDEPENDENT_ACTIONS`
- `FOLLOW_CHECK_SIGNED_TOKENS`
- `DM_ME_FALLBACK`

See [docs/deployment.md](file:///e:/Study/Website/Replyza/docs/deployment.md) for the staged rollout order and `scripts/backfill-subscriptions.ts` (`--apply` to update existing accounts).

---

## 7. Frontend Updates & Bundle Size
- **Builder (`apps/web/src/components/automations/builder/builder-wizard.tsx`)**: Added All Posts & Reels scope, `keywordMatchMode`, `publicReplyVariations`, `deliveryMode` (`DIRECT` vs `BUTTON`), `buttonLabel`, `cooldownSeconds`, and `dmMeFallbackEnabled`. Lazy-loaded via `next/dynamic` in `apps/web/src/app/(dashboard)/automations/new/page.tsx`.
- **Activity (`apps/web/src/app/(dashboard)/activity/page.tsx`)**: Added Meta Platform Rules banner (1 Private Reply per comment / 7-day / 24h messaging window) and `conversationState` + `deliveryActions` timeline breakdown backed by `apps/api/src/services/automation.service.ts`.
- **Next.js Static Chunks (`apps/web/.next/static/chunks`)**:
  - Baseline (Phase 1): `27` files, `1,401.1 KB`
  - Post-redesign & ManyChat updates: `28` files, `1,415 KB`

---

## 8. Performance Benchmarks & 100-Comment Burst Soak Test
Executed via `scripts/bench-and-soak.ts` against local `replyza_test` seeded with **50 Instagram accounts, 500 automations, 10,000 `webhook_events`, 10,000 `automation_executions`, and 20,000 `delivery_actions`** (mocked Meta Graph API):

- **Seeded `EXPLAIN (ANALYZE, BUFFERS)`**:
  - Q1 (Active automation match): `0.101 ms`
  - Q2 (Cooldown check): `0.050 ms`
  - Q3 (Activity list 25 rows): `5.082 ms`
- **100-Comment Burst + 20 Duplicate Retries Soak Test**:
  - Webhook HTTP latency (20 concurrent/batch): `p50 = 319.23 ms`, `p95 = 416.21 ms`, `max = 420.94 ms`
  - Worker `PUBLIC_REPLY` processing: `p50 = 23.55 ms`, `p95 = 29.7 ms` (`calls = 100`)
  - Worker `HOOK_DM` processing: `p50 = 24.73 ms`, `p95 = 32.54 ms` (`calls = 100`)
  - Invariants: `Executions created = 100/100`, `Completed = 100/100`, `0` duplicates, `0` lost comments.

---

## 9. Automated Verification Results
All checks ran against the local test stack (`127.0.0.1:5433/replyza_test`, Redis `127.0.0.1:6379`, Mock Meta on `127.0.0.1:4005`):
- `pnpm build:all`: **PASSED** (exit code 0)
- `pnpm typecheck`: **PASSED** (all workspace packages, exit code 0)
- `pnpm lint:web`: **PASSED** (exit code 0)
- `pnpm test` (Vitest): **PASSED** — **18/18 test files**, **94/94 tests** passed
- `pnpm smoke` (API + Worker + Mock Meta): **PASSED** — all **12 verification gates** passed
- `pnpm smoke:web` (Playwright E2E): **PASSED** — **1/1 passed** (`10.7s`)

---

## 10. Production Readiness & Remaining Risks
- **Live Meta Verification Pending**: Automated tests mock Meta Graph API responses; run [docs/manual-test-script.md](file:///e:/Study/Website/Replyza/docs/manual-test-script.md) with a real test IG Business account after staging deploy.
- **Token Expiry Handling**: `apps/worker/src/processors/token-expiry.processor.ts` flags expiring/expired tokens as `NEEDS_RECONNECT` rather than silently refreshing; users reconnect via OAuth.
- **No Production Deploy Executed**: All changes remain local on branch `feat/manychat-engine` (not pushed or deployed).

---

## 11. Deliverables
- [docs/audit.md](file:///e:/Study/Website/Replyza/docs/audit.md)
- [docs/decisions.md](file:///e:/Study/Website/Replyza/docs/decisions.md)
- [docs/deployment.md](file:///e:/Study/Website/Replyza/docs/deployment.md)
- [docs/manual-test-script.md](file:///e:/Study/Website/Replyza/docs/manual-test-script.md)
- [docs/FINAL_REPORT.md](file:///e:/Study/Website/Replyza/docs/FINAL_REPORT.md)
- [scripts/bench-and-soak.ts](file:///e:/Study/Website/Replyza/scripts/bench-and-soak.ts)
- [scripts/backfill-subscriptions.ts](file:///e:/Study/Website/Replyza/scripts/backfill-subscriptions.ts)
