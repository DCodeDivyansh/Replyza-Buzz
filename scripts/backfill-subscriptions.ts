/**
 * Backfill Script: Re-subscribe existing ACTIVE Instagram accounts to
 * feed,comments,messages,messaging_postbacks webhooks.
 *
 * Safe by default (dry-run). Pass `--apply` to execute against Meta Graph API.
 */
import "dotenv/config";
import { prisma } from "@replyza/database";
import { decryptToken } from "../apps/api/src/utils/token-encryption";
import { subscribeInstagramAccount } from "../apps/api/src/services/instagram-oauth.service";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`[Backfill Subscriptions] Mode: ${apply ? "APPLY" : "DRY-RUN"}`);

  const accounts = await prisma.instagramAccount.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      instagramUserId: true,
      username: true,
      encryptedAccessToken: true,
      webhookSubscribed: true,
    },
  });

  console.log(`Found ${accounts.length} ACTIVE Instagram account(s).`);

  for (const acc of accounts) {
    const label = acc.username ? `@${acc.username}` : acc.instagramUserId;
    if (!apply) {
      console.log(`[DRY-RUN] Would re-subscribe ${label} (${acc.instagramUserId}) to feed,comments,messages,messaging_postbacks`);
      continue;
    }

    try {
      const token = decryptToken(acc.encryptedAccessToken);
      const res = await subscribeInstagramAccount(acc.instagramUserId, token);
      await prisma.instagramAccount.update({
        where: { id: acc.id },
        data: {
          webhookSubscribed: res.success,
          webhookSubscribedAt: res.success ? new Date() : null,
          webhookSubscriptionError: res.success ? null : (res.error ?? "Subscription failed"),
        },
      });
      console.log(`[APPLY] ${label}: success=${res.success}${res.error ? ` error=${res.error}` : ""}`);
    } catch (err) {
      console.error(`[APPLY] ${label}: error=${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
