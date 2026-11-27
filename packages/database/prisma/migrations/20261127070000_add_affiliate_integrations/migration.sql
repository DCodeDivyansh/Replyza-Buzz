-- CreateEnum
CREATE TYPE "AffiliateProvider" AS ENUM ('CUELINKS');

-- CreateTable
CREATE TABLE "affiliate_integrations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AffiliateProvider" NOT NULL,
    "publisherId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_integrations_userId_idx" ON "affiliate_integrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_integrations_userId_provider_key" ON "affiliate_integrations"("userId", "provider");

-- AddForeignKey
ALTER TABLE "affiliate_integrations" ADD CONSTRAINT "affiliate_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
