-- AlterTable
ALTER TABLE "automations" ADD COLUMN "followRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "followInstructionText" TEXT,
ADD COLUMN "followSuccessText" TEXT,
ADD COLUMN "followFallbackText" TEXT,
ADD COLUMN "templateId" UUID;

-- CreateTable
CREATE TABLE "automation_templates" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "AutomationTrigger" NOT NULL DEFAULT 'KEYWORD',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicReplyText" TEXT NOT NULL,
    "dmMessageText" TEXT NOT NULL,
    "dmLink" TEXT,
    "followRequired" BOOLEAN NOT NULL DEFAULT false,
    "followInstructionText" TEXT,
    "followSuccessText" TEXT,
    "followFallbackText" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_templates_userId_idx" ON "automation_templates"("userId");

-- CreateIndex
CREATE INDEX "automation_templates_isSystem_idx" ON "automation_templates"("isSystem");

-- AddForeignKey
ALTER TABLE "automation_templates" ADD CONSTRAINT "automation_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
