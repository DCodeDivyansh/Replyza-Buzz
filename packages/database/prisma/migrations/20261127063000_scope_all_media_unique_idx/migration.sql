-- Scope all-media active unique index to ALL_POSTS so NEXT_POST automations can coexist safely
DROP INDEX IF EXISTS "automations_account_all_media_active_idx";

CREATE UNIQUE INDEX "automations_account_all_media_active_idx"
ON "automations"("instagramAccountId")
WHERE ("mediaId" IS NULL AND "status" = 'ACTIVE'::"AutomationStatus" AND "targetMode" = 'ALL_POSTS'::"TargetMode");
