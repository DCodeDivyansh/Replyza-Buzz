-- Rollback: 20261124160000_add_product_enhancements

-- DropForeignKey
ALTER TABLE "automation_templates" DROP CONSTRAINT IF EXISTS "automation_templates_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "automation_templates";

-- AlterTable
ALTER TABLE "automations"
DROP COLUMN IF EXISTS "followRequired",
DROP COLUMN IF EXISTS "followInstructionText",
DROP COLUMN IF EXISTS "followSuccessText",
DROP COLUMN IF EXISTS "followFallbackText",
DROP COLUMN IF EXISTS "templateId";
