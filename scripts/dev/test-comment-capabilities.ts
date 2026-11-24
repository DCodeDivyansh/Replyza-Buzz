import { prisma } from "@replyza/database";
import { decryptToken } from "../src/utils/token-encryption";

async function main() {
  const account = await prisma.instagramAccount.findFirst({
    where: { username: "shre_yadayal" },
    select: { encryptedAccessToken: true },
  });

  if (!account) throw new Error("Instagram account not found");

  const token = decryptToken(account.encryptedAccessToken);
  const commentId = "17948077785383351";

  const url = new URL(
    `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION}/${commentId}`
  );

  url.searchParams.set(
    "fields",
    "id,text,can_comment,can_reply_privately"
  );

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  console.log(JSON.stringify({
    httpStatus: response.status,
    success: response.ok,
    response: response.ok ? data : data.error,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
