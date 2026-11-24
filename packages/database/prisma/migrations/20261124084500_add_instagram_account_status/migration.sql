-- CreateEnum
CREATE TYPE "InstagramAccountStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT');

-- AlterTable
ALTER TABLE "instagram_accounts" ADD COLUMN "status" "InstagramAccountStatus" NOT NULL DEFAULT 'ACTIVE';
