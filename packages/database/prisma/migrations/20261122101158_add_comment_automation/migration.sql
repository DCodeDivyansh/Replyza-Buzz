-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('ANY_COMMENT', 'KEYWORD');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "automations" (
    "id" UUID NOT NULL,
    "instagramAccountId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "mediaPermalink" TEXT,
    "mediaType" TEXT,
    "triggerType" "AutomationTrigger" NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicReplyText" TEXT NOT NULL,
    "dmMessageText" TEXT NOT NULL,
    "dmLink" TEXT,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "instagramAccountId" UUID NOT NULL,
    "commentId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "commenterInstagramId" TEXT NOT NULL,
    "commenterUsername" TEXT,
    "commentText" TEXT NOT NULL,
    "eventPayload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "webhookEventId" UUID NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "publicReplyStatus" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "privateReplyStatus" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "metaReplyId" TEXT,
    "metaPrivateReplyId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automations_instagramAccountId_status_idx" ON "automations"("instagramAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "automations_instagramAccountId_mediaId_key" ON "automations"("instagramAccountId", "mediaId");

-- CreateIndex
CREATE INDEX "webhook_events_status_receivedAt_idx" ON "webhook_events"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_events_mediaId_idx" ON "webhook_events"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_instagramAccountId_commentId_key" ON "webhook_events"("instagramAccountId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "automation_executions_webhookEventId_key" ON "automation_executions"("webhookEventId");

-- CreateIndex
CREATE INDEX "automation_executions_automationId_createdAt_idx" ON "automation_executions"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "automation_executions_status_idx" ON "automation_executions"("status");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "webhook_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
