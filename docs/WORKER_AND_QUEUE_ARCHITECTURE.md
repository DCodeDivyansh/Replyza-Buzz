# Worker & Queue Architecture

## 1. Overview

Replyza uses **BullMQ** backed by **Redis 7** for reliable, distributed background job processing. All asynchronous work is decoupled from the Express API to guarantee instantaneous webhook responses and robust fault tolerance.

---

## 2. Queue Topology

```
                  ┌──────────────────────┐
                  │   Express Webhook    │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│  automation-processing  │       │ follow-check-processing │
└───────────┬─────────────┘       └───────────┬─────────────┘
            ▼                                 ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│   Automation Processor  │       │  Follow-Check Processor │
│ - Distributed Leasing   │       │ - Cross-Tenant Security │
│ - Keyword Matching      │       │ - Follow Status Query   │
│ - Public Reply (Post)   │       │ - Final Link Delivery   │
│ - Private Reply (DM)    │       │ - Fallback Retry DM     │
└─────────────────────────┘       └─────────────────────────┘
```

### Queue Specifications

| Parameter | `automation-processing` | `follow-check-processing` |
| :--- | :--- | :--- |
| **Concurrency** | 5 workers per process | 5 workers per process |
| **Max Attempts** | 3 attempts | 3 attempts |
| **Backoff Strategy** | Exponential (2000ms delay) | Exponential (2000ms delay) |
| **Job Deduplication** | `jobId: automation:${executionId}` | `jobId: follow-check:${executionId}:${providerEventId}` |
| **Completed Retention** | 24 hours (up to 1,000 jobs) | 24 hours (up to 1,000 jobs) |
| **Failed Retention** | 7 days (unlimited for audit) | 7 days (unlimited for audit) |

---

## 3. Distributed Database Leasing & Concurrency Control

To prevent race conditions, duplicate execution, or split-brain processing during worker crashes, Replyza implements a pessimistic lease locking mechanism directly in PostgreSQL:

### 3.1 Lease Acquisition
```sql
UPDATE automation_executions
SET status = 'PROCESSING',
    lease_token = :leaseToken,
    lease_expires_at = NOW() + INTERVAL '60 SECONDS',
    started_at = NOW()
WHERE id = :executionId
  AND (status = 'PENDING' OR lease_expires_at < NOW());
```
If another worker holds an active, non-expired lease, the query returns 0 rows and the candidate worker aborts.

### 3.2 Heartbeat Renewal
A 30-second interval timer continuously extends the lease (`lease_expires_at = NOW() + 60s`) while actions are in-flight. If the worker encounters an unhandled crash or server reboot, the lease automatically expires within 60 seconds, allowing dead-letter recovery.

### 3.3 Safe Release
Upon completing all actions or encountering an unrecoverable failure, the worker releases the lease (`lease_token = null`, `lease_expires_at = null`).

---

## 4. Execution State Machine

Each `AutomationExecution` progresses through a strictly defined state machine:

```
[PENDING]
    │
    ▼ (Lease Acquired)
[PROCESSING]
    │
    ├── Public Reply: [PENDING] ──► [PROCESSING] ──► [SUCCESS / FAILED / BLOCKED]
    │
    ├── Private Reply: [PENDING] ──► [PROCESSING] ──► [SUCCESS / FAILED / BLOCKED]
    │
    ▼ (Finalize Execution)
[COMPLETED] (Both Public & Private SUCCESS)
    │
    OR [PARTIAL] (At least one SUCCESS or recoverable UNKNOWN)
    │
    OR [FAILED] (Permanent Meta error, token revoked, or both FAILED)
```

For **Follow-Gated Automations**:
1. Initial run completes Public Reply and sends Private DM with Quick Reply. `privateReplyStatus = 'SUCCESS'`, `followCheckStatus = 'PENDING'`.
2. When the user taps "I've followed!", `follow-check-processing` claims the job.
3. If user is following: Sends DM with link, marks `followCheckStatus = 'SUCCESS'`, `status = 'COMPLETED'`.
4. If user is not following: Sends fallback DM with retry button, marks `followCheckStatus = 'FAILED'`, increments `followCheckRetryCount`.
