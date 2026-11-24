-- Rollback for 20261124180000_add_messaging_events_and_follow_tracking

-- Drop foreign keys
ALTER TABLE "messaging_webhook_events" DROP CONSTRAINT IF EXISTS "messaging_webhook_events_executionId_fkey";
ALTER TABLE "messaging_webhook_events" DROP CONSTRAINT IF EXISTS "messaging_webhook_events_instagramAccountId_fkey";

-- Drop table
DROP TABLE IF EXISTS "messaging_webhook_events";

-- Drop columns on automation_executions
ALTER TABLE "automation_executions"
DROP COLUMN IF EXISTS "metaFollowCheckReplyId",
DROP COLUMN IF EXISTS "followCheckRetryCount",
DROP COLUMN IF EXISTS "followCheckVerifiedAt",
DROP COLUMN IF EXISTS "followCheckSentAt",
DROP COLUMN IF EXISTS "followCheckStatus";
