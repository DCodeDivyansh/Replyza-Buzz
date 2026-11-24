import { prisma } from "@replyza/database";

/**
 * Token Expiry Checker
 * Periodically scans InstagramAccount records for tokens expiring within 7 days.
 * If expired, marks status as NEEDS_RECONNECT.
 *
 * Meta Documentation Reference:
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram#long-lived-tokens
 */
export async function checkTokenExpirations(): Promise<{
  checked: number;
  expiringSoon: number;
  expired: number;
}> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const accounts = await prisma.instagramAccount.findMany({
    where: {
      tokenExpiresAt: { not: null },
    },
    select: {
      id: true,
      username: true,
      instagramUserId: true,
      tokenExpiresAt: true,
      status: true,
    },
  });

  let expiringSoon = 0;
  let expired = 0;

  for (const account of accounts) {
    if (!account.tokenExpiresAt) continue;

    if (account.tokenExpiresAt <= now) {
      expired++;
      if (account.status !== "NEEDS_RECONNECT") {
        await prisma.instagramAccount.update({
          where: { id: account.id },
          data: { status: "NEEDS_RECONNECT" },
        });
        console.warn(
          `[Token Expiry Checker] Account ${account.username || account.instagramUserId} token has expired. Status updated to NEEDS_RECONNECT.`
        );
      }
    } else if (account.tokenExpiresAt <= sevenDaysFromNow) {
      expiringSoon++;
      console.warn(
        `[Token Expiry Checker] Account ${account.username || account.instagramUserId} token expires on ${account.tokenExpiresAt.toISOString()} (within 7 days).`
      );
    }
  }

  return { checked: accounts.length, expiringSoon, expired };
}
