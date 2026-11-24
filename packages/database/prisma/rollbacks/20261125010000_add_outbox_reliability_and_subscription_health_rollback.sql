-- Rollback for 20261125010000_add_outbox_reliability_and_subscription_health
-- Note: PostgreSQL does not support dropping enum values directly; enum additions are backward-compatible.

DROP TABLE IF EXISTS "outbox_events";
DROP TYPE IF EXISTS "OutboxStatus";

ALTER TABLE "automation_executions"
DROP COLUMN IF EXISTS "retryCount",
DROP COLUMN IF EXISTS "lastAttemptAt",
DROP COLUMN IF EXISTS "followVerificationOutcome",
DROP COLUMN IF EXISTS "followCheckError";

ALTER TABLE "instagram_accounts"
DROP COLUMN IF EXISTS "webhookSubscribed",
DROP COLUMN IF EXISTS "webhookSubscribedAt",
DROP COLUMN IF EXISTS "webhookSubscriptionError";
