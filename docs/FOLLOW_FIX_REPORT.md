# Follow-Verification & Product-Link Delivery Fix — Final Report

**Branch:** `fix/follow-verification`  
**Scope:** End-to-end root-cause investigation, reproduction, fix, and verification of the follow-verification -> product-link DM delivery flow.

---

## 1. Root Cause(s)

| Suspect | Status | Evidence / File:Line |
|---|---|---|
| **5. Signed payload verification / prod flag mismatch** | **CONFIRMED** | `apps/worker/src/processors/automation.processor.ts:669,904` and `follow-check.processor.ts:278` always sign `FOLLOW_CHECK:<uuid>.<hmac>`. In production (`NODE_ENV=production`), `FOLLOW_CHECK_SIGNED_TOKENS` defaults to `false` (`apps/api/src/config/features.ts:18`), causing `apps/api/src/services/instagram-webhook.service.ts:164` to slice `"FOLLOW_CHECK:"` and pass `"<uuid>.<hmac>"` into Prisma `id: candidateExecutionId`, throwing `P2007` invalid UUID syntax (`follow-verification-repro.test.ts` **R1**). |
| **8. `UNKNOWN` verification failure blocked user retries** | **CONFIRMED** | `apps/worker/src/processors/follow-check.processor.ts:205-206` sets `followCheckStatus = "UNKNOWN"` on `UNKNOWN` verification errors and asks the user to retry, while `follow-check.processor.ts:76` (`if (execution.followCheckStatus === "UNKNOWN") return;`) and `claimed` (`line 102`) blocked every subsequent retry (`follow-verification-repro.test.ts` **R2**). |
| **4. Execution lookup missing 24h window & `TAPPED`/legacy states** | **CONFIRMED** | `apps/api/src/services/instagram-webhook.service.ts:190-203` matched expired (>24h) executions for typed replies (**R3a**), and missed open executions in `TAPPED` with `followCheckStatus = "PENDING"` (**R3b**). |
| **9/10. Retry loop after `MAX_FOLLOW_RETRIES` (3)** | **CONFIRMED** | `apps/worker/src/processors/follow-check.processor.ts:241-261` left `followCheckStatus = "FAILED"`, allowing a 4th tap to re-claim and re-send messages instead of stopping when `conversationState = "FAILED"` (`follow-verification-repro.test.ts` **R4**). |
| **1. Typed replies ignored** | **NOT-AN-ISSUE** (already handled, hardened) | `instagram-webhook.service.ts:188-207` already matched `inboundText` without requiring an exact phrase; fixed the execution lookup filter (**R3a/R3b**). |
| **2. Webhook subscription** | **NOT-AN-ISSUE** in code (needs backfill on legacy accounts) | `apps/api/src/services/meta-graph.service.ts:126` already subscribes to `feed,comments,messages,messaging_postbacks`; `scripts/backfill-subscriptions.ts` handles existing accounts. |
| **3. Webhook parsing (`is_echo`, own-account)** | **NOT-AN-ISSUE** | `instagram-webhook.service.ts:88-99` already filters `is_echo === true` and `senderId === entryInstagramUserId`. |
| **6. Dedupe too aggressive** | **NOT-AN-ISSUE** | Dedupe keys use `providerEventId` (`mid`), not `senderId`, so failed/unknown attempts do not block later retries with a new `mid`. |
| **7. BullMQ queue / worker listener** | **NOT-AN-ISSUE** | `apps/worker/src/index.ts:27` listens on `"follow-check-processing"`, matching `apps/api/src/queues/follow-check.queue.ts`. |
| **9/10/11. Branching, `recipient.id`, Error 190** | **NOT-AN-ISSUE** | `checkUserFollowsBusiness` strictly checks `typeof json.is_user_follow_business !== "boolean"`, `sendDirectMessage` uses `recipient: { id: igsid }`, and Error `190` marks `NEEDS_RECONNECT`. |

---

## 2. What Changed

- [apps/api/src/services/instagram-webhook.service.ts](file:///e:/Study/Website/Replyza/apps/api/src/services/instagram-webhook.service.ts):
  - Strips optional `.<hmac>` and validates UUID format before querying Prisma even when `FOLLOW_CHECK_SIGNED_TOKENS=false`.
  - Enforces the 24-hour messaging window (`MESSAGING_WINDOW_MS`) on typed-consent execution lookup (`createdAt` and `followCheckSentAt`), excludes terminal states (`COMPLETED`, `EXPIRED_WINDOW`, `FAILED`, `NEEDS_RECONNECT`), and picks the most recent unexpired open execution.
  - Added structured logs with `executionId`, masked `igsid`, `mid`, and trigger type.
- [apps/worker/src/processors/follow-check.processor.ts](file:///e:/Study/Website/Replyza/apps/worker/src/processors/follow-check.processor.ts):
  - Skips terminal states (`COMPLETED`, `EXPIRED_WINDOW`, `NEEDS_RECONNECT`, `FAILED` at `retryCount >= 3`).
  - Checks `LINK_DM` `DeliveryAction` before claiming: blocks duplicate `LINK_DM` when `SENT`, `SENDING`, or `NEEDS_REVIEW` (transitioning crashed `SENDING` to `NEEDS_REVIEW`), while allowing user retries after `UNKNOWN` verification API failures.
  - Enforces 24h window check before calling Meta (`EXPIRED_WINDOW` if expired).
  - Updated neutral verification-unavailable DM to `"I couldn't verify right now, please try again in a minute."`.
- [apps/worker/src/processors/automation.processor.ts](file:///e:/Study/Website/Replyza/apps/worker/src/processors/automation.processor.ts):
  - Updated default `followInstructionText` to clearly include `"reply FOLLOWED once you've followed"` alongside the quick-reply button.
- [apps/web/src/types/automation.ts](file:///e:/Study/Website/Replyza/apps/web/src/types/automation.ts) & [apps/web/src/app/(dashboard)/activity/page.tsx](file:///e:/Study/Website/Replyza/apps/web/src/app/(dashboard)/activity/page.tsx):
  - Synced `ConversationStateType` with Prisma `ConversationState` enum and surfaced plain-language follow-flow badges (`Verified · Link sent`, `Not following`, `Couldn't verify`, `Window expired (24h)`, `Reconnect Instagram`, `Awaiting follow`).
- **Migrations & Flags**: No schema migration needed (`ConversationState` and `DeliveryAction` already exist). All feature flags remain default `OFF` in `NODE_ENV=production`.

---

## 3. Verification Outcome Matrix

| Outcome | DB State | Message Sent to User |
|---|---|---|
| `VERIFIED` (`is_user_follow_business === true`) | `status = COMPLETED`, `conversationState = COMPLETED`, `followCheckStatus = SUCCESS`, `LINK_DM = SENT` | `followSuccessText` + `dmLink` (exactly once, `recipient.id = igsid`) |
| `NOT_FOLLOWING` (`=== false`, retry `< 3`) | `conversationState = AWAITING_FOLLOW`, `followCheckStatus = FAILED`, `followCheckRetryCount += 1` | `followFallbackText` + retry button `"I've followed! ✅"` |
| `NOT_FOLLOWING` (3rd retry exhausted) | `conversationState = FAILED`, `followCheckStatus = FAILED` | `"We still couldn't confirm a follow after multiple checks. Feel free to follow anytime and comment again later!"` |
| `UNSUPPORTED` / `PERMISSION_DENIED` / `UNKNOWN` | `conversationState = AWAITING_FOLLOW`, `followCheckStatus = UNKNOWN` (or `FAILED`), `followVerificationOutcome` + `followCheckError` recorded | `"I couldn't verify right now, please try again in a minute."` (retried once before fallback) |
| Token Error `190` | Account `status = NEEDS_RECONNECT`, `conversationState = NEEDS_RECONNECT` | None (stops sending, surfaces reconnect banner) |
| Window Expired (`551` or `> 24h`) | `conversationState = EXPIRED_WINDOW`, `followCheckStatus = FAILED` | None (recorded in Activity UI) |

---

## 4. Meta Findings & Limitations
- **`is_user_follow_business`**: Exposed on `GET /{igsid}?fields=is_user_follow_business,name,username` (Instagram User Profile API: `https://developers.facebook.com/documentation/instagram-platform/reference/instagram-user`). Requires active user messaging consent and permissions (`instagram_basic`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`). May be omitted for privacy-restricted users or apps without Advanced Access; Replyza treats omission as `UNSUPPORTED` (never false-success or false-not-following).
- **Private Replies & 24-Hour Window**: Meta allows **1 Private Reply per comment within 7 days** (`https://developers.facebook.com/documentation/instagram-platform/webhooks`, `https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api`). The 24-hour standard messaging window opens only after the user taps a Quick Reply or sends an inbound DM. Quick Replies are supported up to 20 chars per title and may not render on desktop Instagram Web, which is why Replyza sends both the button and a typed-reply instruction.

---

## 5. Test Results

- **Before Fix (`follow-verification-repro.test.ts`)**: `5 failed (5)` — reproduced `P2007` invalid UUID on R1, blocked retry after `UNKNOWN` on R2, expired window match on R3a, missed `TAPPED` state on R3b, and 4th-tap loop on R4.
- **After Fix**:
  - `pnpm build:all`: **PASSED** (exit code `0`)
  - `pnpm typecheck`: **PASSED** (all workspace packages)
  - `pnpm lint:web`: **PASSED** (exit code `0`)
  - `pnpm test` (Vitest): **20/20 files, 109/109 tests passed** (`follow-verification-repro.test.ts`: 5/5, `follow-to-get-link.test.ts`: 13/13, `follow-verification-matrix.test.ts`: 10/10, `manychat-engine.test.ts`: 7/7, plus all unit & integration suites).
  - `pnpm smoke` & `pnpm smoke:web` (Playwright E2E including `/activity` check): **PASSED** (verified on local test stack with Mock Meta).

---

## 6. Not Verified (Requires Real Instagram Account)
- Live Meta Graph API delivery (`POST /{ig-user-id}/messages`, `GET /{igsid}?fields=is_user_follow_business`) and desktop vs mobile Quick Reply rendering.
- See [docs/follow-flow-manual-test.md](file:///e:/Study/Website/Replyza/docs/follow-flow-manual-test.md) for the exact real-account QA steps.

---

## 7. Deploy Steps (Do Not Run Against Production Yet)
1. Merge `fix/follow-verification` after CI passes.
2. Build & deploy `apps/api` and `apps/worker` on EC2; deploy `apps/web` on Vercel.
3. Backfill `messaging_postbacks` subscriptions on existing active accounts:
   - Dry run: `npx tsx scripts/backfill-subscriptions.ts`
   - Apply: `npx tsx scripts/backfill-subscriptions.ts --apply`
4. Enable feature flags in order:
   1. `ENABLE_FOLLOW_CHECK_SIGNED_TOKENS=true`
   2. `ENABLE_INDEPENDENT_ACTIONS=true`
   3. `ENABLE_MANYCHAT_ENGINE=true`
5. Run post-deploy checks: `GET /api/v1/ready` + [docs/follow-flow-manual-test.md](file:///e:/Study/Website/Replyza/docs/follow-flow-manual-test.md).
6. Rollback: revert the deploy / set the feature flags back to `false` (no destructive DB migration was introduced).
