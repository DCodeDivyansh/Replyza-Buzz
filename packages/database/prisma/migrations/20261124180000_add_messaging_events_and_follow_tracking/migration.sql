-- AlterTable
ALTER TABLE "automation_executions" ADD COLUMN "followCheckStatus" "ActionStatus" DEFAULT 'PENDING',
ADD COLUMN "followCheckSentAt" TIMESTAMP(3),
ADD COLUMN "followCheckVerifiedAt" TIMESTAMP(3),
ADD COLUMN "followCheckRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "metaFollowCheckReplyId" TEXT;

-- CreateTable
CREATE TABLE "messaging_webhook_events" (
    "id" UUID NOT NULL,
    "instagramAccountId" UUID NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "payload" TEXT,
    "executionId" UUID,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "messaging_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "messaging_webhook_events_instagramAccountId_providerEventId_key" ON "messaging_webhook_events"("instagramAccountId", "providerEventId");

-- CreateIndex
CREATE INDEX "messaging_webhook_events_executionId_idx" ON "messaging_webhook_events"("executionId");

-- CreateIndex
CREATE INDEX "messaging_webhook_events_status_receivedAt_idx" ON "messaging_webhook_events"("status", "receivedAt");

-- AddForeignKey
ALTER TABLE "messaging_webhook_events" ADD CONSTRAINT "messaging_webhook_events_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_webhook_events" ADD CONSTRAINT "messaging_webhook_events_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "automation_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
