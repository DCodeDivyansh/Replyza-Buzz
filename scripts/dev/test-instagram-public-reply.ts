import { prisma } from "@replyza/database";
import { decryptToken } from "../src/utils/token-encryption";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const COMMENT_ID = "17948077785383351";
const EXPECTED_COMMENT = "Replyza dry run test 02";
const REPLY_MESSAGE =
  "Replyza public reply API test — please ignore.";

async function main() {
  const account = await prisma.instagramAccount.findFirst({
    where: { username: "shre_yadayal" },
    select: {
      encryptedAccessToken: true,
      instagramUserId: true,
    },
  });

  if (!account) {
    throw new Error("Instagram account shre_yadayal not found.");
  }

  const token = decryptToken(account.encryptedAccessToken);
  const version = process.env.META_GRAPH_API_VERSION;

  if (!version) {
    throw new Error("META_GRAPH_API_VERSION is missing.");
  }

  const commentUrl =
    `https://graph.facebook.com/${version}/${COMMENT_ID}`;

  // Verify the exact target comment before publishing.
  const commentResponse = await fetch(
    `${commentUrl}?fields=id,text`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const commentData = await commentResponse.json();

  if (!commentResponse.ok) {
    console.error("Comment verification failed:", commentData.error);
    throw new Error("Cannot verify target comment. No reply was sent.");
  }

  if (commentData.text !== EXPECTED_COMMENT) {
    throw new Error(
      `Unexpected comment text: ${JSON.stringify(commentData.text)}. No reply was sent.`
    );
  }

  console.log("\nTarget verified:");
  console.log("Instagram account: shre_yadayal");
  console.log("Comment:", commentData.text);
  console.log("Reply:", REPLY_MESSAGE);

  const readline = createInterface({ input: stdin, output: stdout });

  try {
    const confirmation = await readline.question(
      "\nThis will publish a REAL public reply. Type PUBLISH to continue: "
    );

    if (confirmation !== "PUBLISH") {
      console.log("Cancelled. No reply was sent.");
      return;
    }
  } finally {
    readline.close();
  }

  const body = new URLSearchParams({
    message: REPLY_MESSAGE,
  });

  const response = await fetch(`${commentUrl}/replies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const result = await response.json();

  console.log("\n--- Meta Public Reply Result ---");
  console.log(JSON.stringify({
    httpStatus: response.status,
    success: response.ok,
    response: result,
  }, null, 2));
}

main()
  .catch(error => {
    console.error("Test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
