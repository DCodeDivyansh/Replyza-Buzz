import { prisma } from "@replyza/database";
import { decryptToken } from "../src/utils/token-encryption";

async function main() {
  const account = await prisma.instagramAccount.findFirst({
    where: { username: "shre_yadayal" },
    select: {
      encryptedAccessToken: true,
      instagramUserId: true,
    },
  });

  if (!account) throw new Error("Instagram account not found");

  const token = decryptToken(account.encryptedAccessToken);
  const version = process.env.META_GRAPH_API_VERSION;

  const requests = [
    {
      name: "Instagram account",
      path: account.instagramUserId,
      fields: "id,username",
    },
    {
      name: "Instagram media",
      path: "18654977893029688",
      fields: "id,media_type,comments_count",
    },
    {
      name: "Media comments",
      path: "18654977893029688/comments",
      fields: "id,text",
    },
  ];

  for (const request of requests) {
    const url = new URL(
      `https://graph.facebook.com/${version}/${request.path}`
    );

    url.searchParams.set("fields", request.fields);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    console.log(`\n--- ${request.name} ---`);
    console.log(JSON.stringify({
      httpStatus: response.status,
      success: response.ok,
      response: response.ok ? data : data.error,
    }, null, 2));
  }
}

main()
  .catch(error => {
    console.error("Test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
