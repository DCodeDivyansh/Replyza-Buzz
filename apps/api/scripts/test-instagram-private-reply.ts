import { prisma } from "@replyza/database";
import { decryptToken } from "../src/utils/token-encryption";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const COMMENT_ID = "17948077785383351";
const EXPECTED_COMMENT = "Replyza dry run test 02";

const MESSAGE =
  "Thanks for commenting! Here is the link you requested: https://replyza.buzz";

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

  const token = decryptToken(account.encryptedAccessToken);
  const version = process.env.META_GRAPH_API_VERSION;

  if (!version) {
    throw new Error("META_GRAPH_API_VERSION is missing.");
  }

  // Verify the target comment before sending.
  const commentResponse = await fetch(
    `https://graph.facebook.com/${version}/${COMMENT_ID}?fields=id,text`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const comment = await commentResponse.json();

  if (!commentResponse.ok) {
    throw new Error(
      `Comment verification failed: ${JSON.stringify(comment.error)}`
    );
  }

  if (comment.text !== EXPECTED_COMMENT) {
    throw new Error("Comment text mismatch. No DM sent.");
  }

  console.log("\nVerified target:");
  console.log("Account: shre_yadayal");
  console.log("Comment:", comment.text);
  console.log("Private message:", MESSAGE);

  const readline = createInterface({ input: stdin, output: stdout });

  try {
    const confirmation = await readline.question(
      "\nThis sends ONE REAL private Instagram message. Type SEND-DM to continue: "
    );

    if (confirmation !== "SEND-DM") {
      console.log("Cancelled. No message sent.");
      return;
    }
  } finally {
    readline.close();
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${account.instagramUserId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          comment_id: COMMENT_ID,
        },
        message: {
          text: MESSAGE,
        },
      }),
    }
  );

  const result = await response.json();

  console.log("\n--- Meta Private Reply Result ---");
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
