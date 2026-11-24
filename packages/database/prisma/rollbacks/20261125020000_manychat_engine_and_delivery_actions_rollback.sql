-- Safe Rollback for 20261125020000_manychat_engine_and_delivery_actions
-- Preserves any all-media automations (mediaId IS NULL) by pausing & assigning a unique sentinel ID
-- before restoring NOT NULL and the original unique constraint.

DROP TABLE IF EXISTS "delivery_actions";

DROP INDEX IF EXISTS "automation_executions_tapEventMid_key";
DROP INDEX IF EXISTS "automation_executions_commenterIgsid_createdAt_idx";
ALTER TABLE "automation_executions"
DROP COLUMN IF EXISTS "conversationState",
DROP COLUMN IF EXISTS "commenterIgsid",
DROP COLUMN IF EXISTS "tapEventMid";

ALTER TABLE "automation_templates" DROP CONSTRAINT IF EXISTS "automation_templates_system_user_check";
ALTER TABLE "automations" DROP CONSTRAINT IF EXISTS "automations_templateId_fkey";

DROP INDEX IF EXISTS "automations_account_all_media_active_idx";
DROP INDEX IF EXISTS "automations_account_media_unique_idx";
DROP INDEX IF EXISTS "automations_instagramAccountId_mediaId_idx";

UPDATE "automations"
SET "mediaId" = '__ALL_MEDIA__' || "id"::text,
    "status" = 'PAUSED'
WHERE "mediaId" IS NULL;

ALTER TABLE "automations"
ALTER COLUMN "mediaId" SET NOT NULL,
DROP COLUMN IF EXISTS "keywordMatchMode",
DROP COLUMN IF EXISTS "deliveryMode",
DROP COLUMN IF EXISTS "buttonLabel",
DROP COLUMN IF EXISTS "publicReplyVariations",
DROP COLUMN IF EXISTS "cooldownSeconds",
DROP COLUMN IF EXISTS "dmMeFallbackEnabled";

CREATE UNIQUE INDEX IF NOT EXISTS "automations_instagramAccountId_mediaId_key" ON "automations"("instagramAccountId", "mediaId");

DROP TYPE IF EXISTS "ConversationState";
DROP TYPE IF EXISTS "DeliveryActionStatus";
DROP TYPE IF EXISTS "DeliveryActionType";
DROP TYPE IF EXISTS "DeliveryMode";
DROP TYPE IF EXISTS "KeywordMatchMode";
