# Webhook Processing & Deduplication Architecture

## 1. Webhook Ingestion Flow

Meta delivers webhook events as HTTP POST requests with a raw JSON payload and an HMAC-SHA256 signature in the `x-hub-signature-256` header.

```
Meta Webhook Server
        │
        │ HTTP POST /api/v1/webhooks/instagram
        ▼
Express Raw Body Capture (`req.rawBody`)
        │
        ▼
Cryptographic Signature Verification (`timingSafeEqual`)
        │
        ├─► Invalid Signature ──► Return 401 Unauthorized
        │
        ▼ Valid
Extract Object & Entries (`payload.object === 'instagram'`)
        │
        ├──► Comment Changes (`entry[].changes[].field === 'comments'`)
        │       │
        │       ▼
        │    Durable Insert into `webhook_events`
        │    Unique Constraint: `(instagramAccountId, commentId)`
        │       │
        │       ├─► P2002 Duplicate ──► Ignore duplicate webhook
        │       │
        │       └─► New Event ──► Enqueue BullMQ Job in `automation-processing`
        │
        └──► Messaging Events (`entry[].messaging[]`)
                │
                ▼
             Derive `providerEventId` (`mid` / hash)
             Durable Insert into `messaging_webhook_events`
             Unique Constraint: `(instagramAccountId, providerEventId)`
                │
                ├─► P2002 Duplicate ──► Log & return (Deduplicated)
                │
                └─► New Event ──► Validate Account & Enqueue `follow-check-processing`
```

---

## 2. Cryptographic Signature Validation

Signature validation uses constant-time string comparison to prevent timing side-channel attacks:

```typescript
function verifyMetaSignature(rawBody: Buffer, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;
  const match = signatureHeader.match(/^sha256=([a-f0-9]{64})$/i);
  if (!match) return false;

  const expected = createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest();
  const received = Buffer.from(match[1], "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

---

## 3. Durable Deduplication Strategy

Meta guarantees **at-least-once** delivery for webhooks and regularly retries when networks fluctuate or latency exceeds 5 seconds. To ensure exactly-once processing, Replyza enforces durable PostgreSQL unique constraints:

### 3.1 Comment Webhooks
- Table: `webhook_events`
- Unique Index: `@@unique([instagramAccountId, commentId])`
- Deduplication: When a duplicate comment event arrives, Prisma throws a `P2002` error. The service catches the error, increments `duplicates`, and safely returns `200 EVENT_RECEIVED` without spawning duplicate processing jobs.

### 3.2 Messaging Webhooks (Quick Reply Clicks)
- Table: `messaging_webhook_events`
- Unique Index: `@@unique([instagramAccountId, providerEventId])`
- Deduplication: When a user taps the Quick Reply button ("I've followed!"), Meta assigns a unique message ID (`mid`). Repeated deliveries of the same webhook are caught by `P2002` and ignored. Subsequent new button clicks produce a new `mid`, which are permitted and processed.

---

## 4. Multi-Tenant Verification & IDOR Protection

When a messaging event arrives with a `FOLLOW_CHECK:<executionId>` payload:
1. **Account Isolation**: The webhook processor queries `AutomationExecution` where `id = executionId` AND `automation.instagramAccountId = currentAccount.id`. If the execution does not belong to the connected Instagram account receiving the webhook, the execution ID is rejected.
2. **Commenter Verification**: The worker verifies that the incoming messaging `sender.id` matches the original comment's `commenterInstagramId`. If a malicious actor sends a spoofed payload referencing another user's execution, the worker throws an `UnrecoverableError` and immediately aborts without sending any link.
