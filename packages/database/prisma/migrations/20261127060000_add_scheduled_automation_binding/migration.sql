-- AlterEnum
ALTER TYPE "AutomationStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "AutomationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- CreateEnum
CREATE TYPE "TargetMode" AS ENUM ('SPECIFIC_POST', 'ALL_POSTS', 'NEXT_POST', 'SCHEDULED_TIME');

-- CreateEnum
CREATE TYPE "MediaTypeFilter" AS ENUM ('ANY', 'REELS', 'FEED');

-- AlterTable
ALTER TABLE "automations"
ADD COLUMN "targetMode" "TargetMode" NOT NULL DEFAULT 'SPECIFIC_POST',
ADD COLUMN "scheduledActivateAt" TIMESTAMP(3),
ADD COLUMN "bindingWindowEndAt" TIMESTAMP(3),
ADD COLUMN "mediaTypeFilter" "MediaTypeFilter" NOT NULL DEFAULT 'ANY',
ADD COLUMN "captionKeywordFilter" TEXT;

-- Backfill existing all-media automations safely
UPDATE "automations"
SET "targetMode" = 'ALL_POSTS'
WHERE "mediaId" IS NULL;

-- CreateIndex
CREATE INDEX "automations_instagramAccountId_status_targetMode_idx"
ON "automations"("instagramAccountId", "status", "targetMode");
