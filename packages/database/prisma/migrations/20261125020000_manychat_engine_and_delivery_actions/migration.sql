-- CreateEnum
CREATE TYPE "KeywordMatchMode" AS ENUM ('CONTAINS', 'EXACT', 'ANY');
CREATE TYPE "DeliveryMode" AS ENUM ('DIRECT', 'BUTTON');
CREATE TYPE "DeliveryActionType" AS ENUM ('PUBLIC_REPLY', 'HOOK_DM', 'LINK_DM', 'FOLLOW_FALLBACK_DM');
CREATE TYPE "DeliveryActionStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'NEEDS_REVIEW');
CREATE TYPE "ConversationState" AS ENUM ('HOOK_SENT', 'AWAITING_TAP', 'TAPPED', 'FOLLOW_CHECKING', 'AWAITING_FOLLOW', 'COMPLETED', 'EXPIRED_WINDOW', 'FAILED', 'NEEDS_RECONNECT');

-- AlterTable: automations (nullable mediaId + ManyChat fields)
ALTER TABLE "automations"
ALTER COLUMN "mediaId" DROP NOT NULL,
ADD COLUMN "keywordMatchMode" "KeywordMatchMode" NOT NULL DEFAULT 'CONTAINS',
ADD COLUMN "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "buttonLabel" TEXT,
ADD COLUMN "publicReplyVariations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dmMeFallbackEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Replace strict unique index with partial unique indexes supporting all-media (mediaId IS NULL)
DROP INDEX IF EXISTS "automations_instagramAccountId_mediaId_key";
CREATE INDEX IF NOT EXISTS "automations_instagramAccountId_mediaId_idx" ON "automations"("instagramAccountId", "mediaId");
CREATE UNIQUE INDEX IF NOT EXISTS "automations_account_media_unique_idx" ON "automations"("instagramAccountId", "mediaId") WHERE "mediaId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "automations_account_all_media_active_idx" ON "automations"("instagramAccountId") WHERE "mediaId" IS NULL AND "status" = 'ACTIVE';

-- Idempotent seed of system templates before adding FK
INSERT INTO "automation_templates" (
  "id", "userId", "name", "category", "description", "triggerType", "keywords",
  "publicReplyText", "dmMessageText", "dmLink", "followRequired",
  "followInstructionText", "followSuccessText", "followFallbackText", "isSystem", "createdAt", "updatedAt"
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001', NULL, 'Get Link', 'Lead Generation',
    'Deliver a link immediately when someone comments a keyword.', 'KEYWORD', ARRAY['LINK', 'SEND'],
    'Just sent the link to your DMs! 📩', 'Hey {{first_name}}! Here is the link you requested:', 'https://replyza.buzz/example-link',
    false, NULL, NULL, NULL, true, NOW(), NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000002', NULL, 'Product Promotion', 'E-commerce',
    'Share a product link and promo code automatically on comment.', 'KEYWORD', ARRAY['PRICE', 'BUY', 'SHOP'],
    'Sent product details to your DMs! 🛍️', 'Hey {{first_name}}! Thanks for asking about this product. Grab it here with 15% off:', 'https://replyza.buzz/shop',
    false, NULL, NULL, NULL, true, NOW(), NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000003', NULL, 'Free Resource Guide', 'Creator Growth',
    'Gate a free PDF, checklist, or Notion template behind a quick follow check.', 'KEYWORD', ARRAY['GUIDE', 'FREE', 'PDF'],
    'Check your DMs {{username}}! 👇', 'Hey {{first_name}}! Thanks for commenting.', 'https://replyza.buzz/free-guide',
    true, 'Follow our page first, then tap the button below to unlock your free guide! 👇',
    'Awesome, thanks for following {{first_name}}! Here is your free guide:',
    'Looks like you are not following yet! Follow our profile and tap again to unlock your guide.',
    true, NOW(), NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000004', NULL, 'Lead Generation', 'Marketing',
    'Engage every commenter and start a conversation in DMs.', 'ANY_COMMENT', ARRAY[]::TEXT[],
    'Thanks for the comment {{username}}! Sent you a quick message 💬', 'Hey {{first_name}}! Thanks for engaging. Here is our resource link:', 'https://replyza.buzz/start',
    false, NULL, NULL, NULL, true, NOW(), NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000005', NULL, 'Custom Flow', 'Custom',
    'Blank starting point for any custom comment-to-DM workflow.', 'KEYWORD', ARRAY['INFO'],
    'Sent you a DM!', 'Hey {{first_name}}! Thanks for reaching out:', NULL,
    false, NULL, NULL, NULL, true, NOW(), NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- Nullify any orphaned templateId references before adding FK constraint
UPDATE "automations" a
SET "templateId" = NULL
WHERE a."templateId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "automation_templates" t WHERE t."id" = a."templateId");

-- Add ForeignKey & CHECK constraint on automation_templates
ALTER TABLE "automations"
ADD CONSTRAINT "automations_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "automation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "automation_templates"
ADD CONSTRAINT "automation_templates_system_user_check"
CHECK ("isSystem" = ("userId" IS NULL));

-- AlterTable: automation_executions
ALTER TABLE "automation_executions"
ADD COLUMN "conversationState" "ConversationState",
ADD COLUMN "commenterIgsid" TEXT,
ADD COLUMN "tapEventMid" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "automation_executions_tapEventMid_key" ON "automation_executions"("tapEventMid");
CREATE INDEX IF NOT EXISTS "automation_executions_commenterIgsid_createdAt_idx" ON "automation_executions"("commenterIgsid", "createdAt");

-- CreateTable: delivery_actions
CREATE TABLE "delivery_actions" (
    "id" UUID NOT NULL,
    "executionId" UUID NOT NULL,
    "actionType" "DeliveryActionType" NOT NULL,
    "status" "DeliveryActionStatus" NOT NULL DEFAULT 'PENDING',
    "metaId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_actions_executionId_actionType_key" ON "delivery_actions"("executionId", "actionType");
CREATE INDEX "delivery_actions_status_createdAt_idx" ON "delivery_actions"("status", "createdAt");

ALTER TABLE "delivery_actions"
ADD CONSTRAINT "delivery_actions_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "automation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
