import { prisma } from "@replyza/database";
import { decryptToken } from "../src/utils/token-encryption";

async function main() {
  const account = await prisma.instagramAccount.findFirst({
    where: { username: "shre_yadayal" },
    select: { encryptedAccessToken: true },
  });

  if (!account) throw new Error("Instagram account not found");

  const token = decryptToken(account.encryptedAccessToken);
  const appAccessToken =
    `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;

  const version = process.env.META_GRAPH_API_VERSION;

  const debugUrl = new URL(
    `https://graph.facebook.com/${version}/debug_token`
  );

  debugUrl.searchParams.set("input_token", token);

  const debugResponse = await fetch(debugUrl, {
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
    },
  });

  const debugData = await debugResponse.json();

  console.log("\n--- TOKEN DEBUG ---");
  console.log(JSON.stringify({
    httpStatus: debugResponse.status,
    data: debugData.data ? {
      app_id: debugData.data.app_id,
      type: debugData.data.type,
      application: debugData.data.application,
      is_valid: debugData.data.is_valid,
      expires_at: debugData.data.expires_at,
      scopes: debugData.data.scopes,
      granular_scopes: debugData.data.granular_scopes,
    } : debugData.error,
  }, null, 2));

  const permissionsUrl = new URL(
    `https://graph.facebook.com/${version}/me/permissions`
  );

  const permissionsResponse = await fetch(permissionsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const permissionsData = await permissionsResponse.json();

  console.log("\n--- GRANTED PERMISSIONS ---");
  console.log(JSON.stringify({
    httpStatus: permissionsResponse.status,
    response: permissionsData,
  }, null, 2));
}

main()
  .catch(error => {
    console.error("Diagnostic failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
