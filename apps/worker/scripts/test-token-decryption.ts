import { prisma } from "@replyza/database";
import { decryptToken } from "@replyza/shared";
import { workerEnv } from "../src/config/env";

async function main() {
  const account = await prisma.instagramAccount.findFirst({
    where: { username: "shre_yadayal" },
    select: {
      encryptedAccessToken: true,
      instagramUserId: true,
    },
  });

  if (!account) {
    throw new Error("Instagram account not found.");
  }

  const token = decryptToken(
    account.encryptedAccessToken,
    workerEnv.metaTokenEncryptionKey
  );

  if (!token || token.trim().length === 0) {
    throw new Error("Decrypted token is empty.");
  }

  console.log("Shared token decryption: SUCCESS");
  console.log("Instagram account ID:", account.instagramUserId);
  console.log("Token available:", true);
  console.log("Token length:", token.length);
}

main()
  .catch(error => {
    console.error("Decryption test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
