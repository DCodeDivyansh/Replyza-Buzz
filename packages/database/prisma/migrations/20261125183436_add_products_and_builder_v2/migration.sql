-- CreateEnum
CREATE TYPE "KeywordMatchLogic" AS ENUM ('ANY_KEYWORD', 'ALL_KEYWORDS');

-- CreateEnum
CREATE TYPE "ProductDeliveryMode" AS ENUM ('SINGLE_MESSAGE', 'SEPARATE_MESSAGES', 'GENERIC_CARDS', 'SELECTION_PROMPT');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpText" TEXT,
ADD COLUMN     "keywordMatchLogic" "KeywordMatchLogic" NOT NULL DEFAULT 'ANY_KEYWORD',
ADD COLUMN     "productClosingText" TEXT,
ADD COLUMN     "productDeliveryMode" "ProductDeliveryMode" NOT NULL DEFAULT 'SINGLE_MESSAGE',
ADD COLUMN     "productIntroText" TEXT,
ADD COLUMN     "publicReplyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "affiliate_products" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "affiliateUrl" TEXT NOT NULL,
    "originalUrl" TEXT,
    "price" TEXT,
    "discountPrice" TEXT,
    "discountInfo" TEXT,
    "couponCode" TEXT,
    "affiliatePartner" TEXT,
    "category" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Shop Now',
    "notes" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_products" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "affiliateProductId" UUID,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "productUrl" TEXT,
    "affiliateUrl" TEXT NOT NULL,
    "originalUrl" TEXT,
    "price" TEXT,
    "discountPrice" TEXT,
    "category" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Shop Now',
    "customMessage" TEXT,
    "couponCode" TEXT,
    "brand" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_products_userId_status_idx" ON "affiliate_products"("userId", "status");

-- CreateIndex
CREATE INDEX "affiliate_products_userId_category_idx" ON "affiliate_products"("userId", "category");

-- CreateIndex
CREATE INDEX "affiliate_products_userId_brand_idx" ON "affiliate_products"("userId", "brand");

-- CreateIndex
CREATE INDEX "automation_products_automationId_sortOrder_idx" ON "automation_products"("automationId", "sortOrder");

-- AddForeignKey
ALTER TABLE "affiliate_products" ADD CONSTRAINT "affiliate_products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_products" ADD CONSTRAINT "automation_products_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_products" ADD CONSTRAINT "automation_products_affiliateProductId_fkey" FOREIGN KEY ("affiliateProductId") REFERENCES "affiliate_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
