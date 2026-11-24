-- AlterEnum
ALTER TYPE "ExecutionStatus" ADD VALUE IF NOT EXISTS 'RETRY_PENDING';
ALTER TYPE "ExecutionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterEnum
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'RETRY_PENDING';
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- AlterTable
ALTER TABLE "instagram_accounts"
ADD COLUMN "webhookSubscribed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "webhookSubscribedAt" TIMESTAMP(3),
ADD COLUMN "webhookSubscriptionError" TEXT;

-- AlterTable
ALTER TABLE "automation_executions"
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "followVerificationOutcome" TEXT,
ADD COLUMN "followCheckError" TEXT;

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_eventType_aggregateId_key" ON "outbox_events"("eventType", "aggregateId");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextAttemptAt_idx" ON "outbox_events"("status", "nextAttemptAt");
