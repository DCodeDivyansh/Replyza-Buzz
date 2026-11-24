# Replyza — Complete Codebase Audit (Phase 0)

**Date**: November 2026  
**Auditor**: Principal Software Architect & Senior Backend Engineer  
**Target Repository**: Replyza (Multi-Tenant Instagram Automation SaaS)

---

## 1. Executive Summary & Architecture Overview

Replyza is a high-performance, multi-tenant Instagram comment-to-DM automation SaaS monorepo built using:
- **Frontend**: Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS 4) hosted on Vercel.
- **Backend API**: Node.js 22 LTS, Express, TypeScript, Pino logging, hosted on AWS EC2 behind a Caddy reverse proxy (`api.replyza.buzz`).
- **Worker**: Dedicated Node.js BullMQ background process running on EC2.
- **Queue & Cache**: Local Redis 7 on EC2 (`127.0.0.1:6379`).
- **Database**: PostgreSQL on Supabase using Prisma 7 with client generator (Transaction pooler on port 6543, Session pooler on port 5432).
- **Meta Integration**: Meta Graph API v21.0 / v27.0, Facebook Login for Business (`config_id`), and Instagram webhooks.
- **Shared Package**: `@replyza/shared` housing cryptographic AES-256-GCM token encryption, variable interpolation, and cross-package types.

---

## 2. Existing Functionality

| Subsystem | Components | Verified State |
| :--- | :--- | :--- |
| **Authentication** | Password hashing (bcrypt/argon2), JWT access tokens, rotating refresh token families in DB, HTTP-only cookies | Working and tested |
| **Meta OAuth** | Facebook Login for Business (`config_id`), state verification HMAC, code exchange, token encryption | Working and tested |
| **Instagram Media** | `GET /api/v1/instagram/accounts/:id/media`, 5-min Redis caching, cursor pagination, Error 190 detection | Implemented & tested |
| **Automation CRUD** | Create, read, update, delete, activate, pause, tenant-scoped | Working & tested |
| **Templates** | 5 system templates, custom templates, variable engine (`{{first_name}}`, `{{username}}`, `{{keyword}}`, `{{link}}`) | Implemented & tested |
| **Automation Builder** | 6-step guided wizard, interactive phone simulator, draft auto-save | Implemented & tested |
| **Webhooks** | HMAC-SHA256 signature verification (`x-hub-signature-256`), deduplication of comments via `webhook_events` DB constraint | Working for comments |
| **Worker Processing**| Distributed execution lease locking, heartbeat renewals, idempotent recovery, single private reply enforcement | Working & tested |

---

## 3. Confirmed Defects & Missing Functionality

### 3.1 Database Inconsistencies & Messaging Event Deduplication
1. **Lack of Durable Deduplication for Messaging Events**:
   - `WebhookEvent` table currently has `commentId String` (non-null) and `@@unique([instagramAccountId, commentId])`.
   - When Meta delivers `entry[].messaging` webhooks (Quick Reply clicks, postbacks), there is **no database persistence or uniqueness constraint** for messaging events in `instagram-webhook.service.ts`.
   - Incoming messaging events are directly enqueued to BullMQ. If Meta retries the webhook or network duplicates occur, duplicate follow-check jobs are placed onto Redis without DB deduplication.
2. **Missing Durable State Transitions for Follow-Check Lifecycle**:
   - Currently, `ExecutionStatus` is limited to `PENDING | PROCESSING | COMPLETED | PARTIAL | FAILED`.
   - Follow-to-Get-Link requires distinct stages: `WAITING_FOR_USER_INTERACTION`, `FOLLOW_VERIFIED`, `FOLLOW_NOT_VERIFIED`, `LINK_SENT`.
   - Currently, if a user clicks the Quick Reply button multiple times, or if Meta duplicates the messaging event, `follow-check.processor.ts` has no idempotency guard preventing duplicate link deliveries.

### 3.2 Decentralized Meta Graph API Clients
- **Fragmentation**:
  - `apps/api/src/services/instagram-media.service.ts` calls `fetch()` directly with custom timeouts and error handling.
  - `apps/api/src/services/instagram-oauth.service.ts` calls `fetch()` directly.
  - `apps/worker/src/services/instagram-graph.service.ts` maintains its own `fetch()` functions with separate `MetaApiError` and retry mechanics.
- **Risks**: Inconsistent retry policies, timeouts, error normalization, rate-limit header parsing, and logging across the monorepo.
- **Requirement**: A centralized, singleton Meta Graph API client in `@replyza/shared` (or shared service) with typed error categories, standard timeouts (10s), exponential backoff retries on 5xx/429, and automatic OAuth 190 detection.

### 3.3 Security & Multi-Tenant IDOR Gaps in Follow-Check
- In `instagram-webhook.service.ts`:
  ```ts
  if (senderId && payloadString && payloadString.startsWith("FOLLOW_CHECK:")) {
    const executionId = payloadString.slice("FOLLOW_CHECK:".length);
    await enqueueFollowCheck({ executionId, igsid: senderId, instagramUserId: rawEntry.id });
  }
  ```
- In `follow-check.processor.ts`:
  - It loads `execution` by `executionId`.
  - **Vulnerability**: It does **not** assert that `execution.webhookEvent.commenterInstagramId === igsid` or that `execution.automation.instagramAccount.instagramUserId === instagramUserId`.
  - A malicious actor could craft a Quick Reply webhook targeting another tenant's `executionId` and trigger unauthorized follower checks and link dispatches.
  - **Fix**: Strict multi-tenant cross-validation asserting sender IGSID matches commenter IGSID and account ownership.

### 3.4 Template Snapshot Integrity
- When an automation is created from a template, all fields (`name`, `keywords`, `publicReplyText`, `dmMessageText`, `dmLink`, `followRequired`, `followInstructionText`, `followSuccessText`, `followFallbackText`) must be snapshotted directly onto the `Automation` record.
- While the fields are saved on `Automation`, `templateId` must be strictly tracked without dynamic coupling so that editing/deleting a template never mutates active automations.

---

## 4. Remediation Plan & Execution Phases

```
┌────────────────────────────────────────────────────────┐
│ Phase 0: Complete Codebase Audit (Current)             │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase 1: Database & Prisma Correctness                 │
│ - Durable Messaging Webhook Event Deduplication        │
│ - Follow-Check Execution Tracking & Lifecycle States   │
│ - Rollback SQL & Migration Report                      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase 2: Centralized Meta Graph API Client             │
│ - Unified `@replyza/shared` or API/Worker Meta client   │
│ - Typed Errors, Retries, Rate Limits, Code 190 Hooks   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phases 3 - 6: Subsystem Implementations & Hardening    │
│ - Media Library Caching & Pagination Validation        │
│ - Template Snapshotting & Variable Engine              │
│ - 6-Step Builder Polish & Auto-Save                    │
│ - Follow-to-Get-Link IDOR Hardening & State Machine    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phases 7 - 10: Webhook & Worker Reliability, UI Polish │
│ - Messaging & Comment Ingestion Deduplication          │
│ - Distributed Leasing, Unknown Outcome Reconcile       │
│ - Responsive UI Testing (375px to 1440px)              │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phases 11 - 13: Complete Testing & Production Readiness│
│ - Vitest, Smoke, Webhook, Worker & Playwright E2E      │
│ - Production Deployment Runbook & PARITY Verification  │
└────────────────────────────────────────────────────────┘
```

---

## 5. Audit Sign-off

- **Monorepo Build State**: PASS (`build:all` compiles cleanly)
- **Baseline Typecheck**: PASS (0 errors across 5 workspaces)
- **Baseline Linting**: PASS (0 errors, 0 warnings)
- **Vitest Baseline**: 14 test files, 54 tests passing (100%)
- **Smoke Baseline**: Backend smoke & Web Playwright smoke passing
- **Ready for Implementation**: YES
