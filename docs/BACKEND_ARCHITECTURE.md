# Replyza Backend Architecture & System Design

## 1. Executive Summary

Replyza is a high-reliability, multi-tenant Instagram comment-to-DM automation SaaS built for creators and e-commerce brands. The architecture separates client-facing interactions, secure API gateways, and distributed asynchronous execution workers into distinct layers to guarantee 100% at-least-once webhook capture, strict exactly-once message delivery, and sub-100ms response times.

---

## 2. Monorepo Organization

The project uses a **pnpm workspace** monorepo structure:

```
replyza/
├── apps/
│   ├── web/          # Next.js 16 App Router frontend (React 19, Tailwind CSS 4, Turbopack)
│   ├── api/          # Express 4 REST API (TypeScript, Pino logging, Helmet, CORS)
│   └── worker/       # BullMQ asynchronous job processing worker (Redis, Prisma)
├── packages/
│   ├── database/     # Prisma 7 ORM, database migrations, connection poolers
│   └── shared/       # Shared TypeScript types, MetaGraphClient, encryption, variable interpolation
├── tests/            # Integration & unit test suites (Vitest)
└── docs/             # Technical architecture, runbooks, and audit reports
```

### Dependency Graph

```
apps/web ──► apps/api (via Next.js server proxy /api/proxy/[...path])
apps/api ──► packages/database, packages/shared
apps/worker ──► packages/database, packages/shared
packages/database ──► PostgreSQL (Supabase / Local Docker)
apps/api & apps/worker ──► Redis (Queue & Cache)
```

---

## 3. Core System Components

### 3.1 Next.js Proxy & Security Layer (`apps/web`)
- **App Router Proxy (`/api/proxy/[...path]`)**: The frontend never exposes the backend API URL directly to the user's browser. All browser requests flow through the Next.js server-side route handler.
- **Shared Proxy Secret (`x-replyza-proxy-secret`)**: The Express API verifies that incoming requests originate from the trusted Next.js server runtime via an HMAC/header secret.
- **Cookie & CSRF Isolation**: Authentication tokens (`access_token` and `refresh_token`) are stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies. The proxy manages token injection, token refresh rotation, and CSRF token verification (`x-csrf-protection: 1`).

### 3.2 Express API Service (`apps/api`)
- **Port**: 4000 (EC2 production behind Caddy reverse proxy)
- **Security Middleware**:
  - `helmet`: Strict CSP, HSTS (`max-age=31536000`), COOP, CORP, X-Frame-Options (`SAMEORIGIN`).
  - `cors`: Restricted to `https://www.replyza.buzz` (or `http://localhost:3000` in local dev).
  - Rate limiting with Redis store:
    - Auth endpoints: 5 attempts per IP per hour.
    - General endpoints: 100 requests per 15 minutes.
    - Webhook ingest: Highly resilient, bounded memory buffer.
- **Meta Webhook Endpoint (`/api/v1/webhooks/instagram`)**:
  - Validates `x-hub-signature-256` using constant-time cryptographic comparison (`timingSafeEqual`).
  - Immediately logs and persists incoming comment and messaging events to PostgreSQL.
  - Returns `200 EVENT_RECEIVED` under 50ms to satisfy Meta's strict timeout SLA.

### 3.3 Asynchronous Execution Worker (`apps/worker`)
- Built on **BullMQ** backed by Redis 7.
- Two primary queues:
  1. `automation-processing`: Handles comment webhooks, keyword matching, distributed lease locking, public comment replies, and private DM replies.
  2. `follow-check-processing`: Handles follower verification Quick Reply clicks, cross-tenant IDOR checks, follow status query, and conditional link delivery.
- Uses distributed pessimistic database leasing (`leaseToken`, `leaseExpiresAt`, 30-second heartbeat) to prevent split-brain execution across multiple worker replicas.

---

## 4. Multi-Tenant Database Schema (`packages/database`)

The PostgreSQL database enforces tenant isolation using foreign keys cascade-linked to `User`:

- **User**: Authentication record (`id`, `email`, `passwordHash`, `role`).
- **RefreshToken**: Hashed refresh token storage for cookie-based session rotation.
- **InstagramAccount**: Connected Meta account (`userId`, `instagramUserId`, `username`, `encryptedAccessToken`, `status`). Status values: `ACTIVE`, `DISCONNECTED`, `NEEDS_RECONNECT`, `RATE_LIMITED`.
- **Automation**: Tenant workflow rules (`instagramAccountId`, `mediaId`, `triggerType`, `keywords`, `publicReplyText`, `dmMessageText`, `dmLink`, `followRequired`, `status`). Unique on `(instagramAccountId, mediaId)`.
- **WebhookEvent**: Raw comment webhooks (`instagramAccountId`, `commentId`, `mediaId`, `commenterInstagramId`, `commentText`, `eventPayload`). Unique on `(instagramAccountId, commentId)`.
- **MessagingWebhookEvent**: Meta messaging Quick Reply taps (`instagramAccountId`, `providerEventId`, `senderId`, `recipientId`, `payload`, `executionId`). Unique on `(instagramAccountId, providerEventId)` for durable deduplication.
- **AutomationExecution**: Stateful record of an automation invocation (`automationId`, `webhookEventId`, `status`, `publicReplyStatus`, `privateReplyStatus`, `followCheckStatus`, `leaseToken`, `leaseExpiresAt`).
- **AutomationTemplate**: Pre-configured strategy blueprints (`userId` nullable for system templates).

---

## 5. Security & Isolation Model

1. **Token Encryption**: All Meta long-lived user access tokens are encrypted at rest using AES-256-GCM (`packages/shared/src/token-encryption.ts`) with unique initialization vectors (IV) and authentication tags before storing in PostgreSQL.
2. **IDOR Prevention**:
   - Webhook processing verifies that the incoming `entry[].id` matches a valid `InstagramAccount`.
   - Messaging quick reply handlers verify that the referenced `executionId` belongs to the matching `InstagramAccount` and that the sender `igsid` matches the original comment's `commenterInstagramId`.
3. **No Secret Leakage**: Centralized Meta API client and Pino loggers automatically redact access tokens, bearer headers, app secrets, and HMAC signatures from all stdout and error traces.
