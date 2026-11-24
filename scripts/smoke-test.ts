/**
 * End-to-End Smoke Test for Replyza Monorepo
 *
 * Requirements:
 * 1. Verify masked database host is localhost/127.0.0.1 (Hard Rule 1).
 * 2. Start mock Meta server to intercept Graph API calls (Hard Rule 3 - no real Meta calls).
 * 3. Start real API and Worker against local test stack (Postgres 127.0.0.1:5433/replyza_test, Redis 127.0.0.1:6379).
 * 4. Wait for readiness endpoint (GET /api/v1/ready).
 * 5. Register user via API, insert fake IG account with encrypted fake token.
 * 6. Create automation through API, set it ACTIVE.
 * 7. Synthesize signed Instagram comment webhook POST (HMAC-SHA256).
 * 8. Poll until automation execution reaches COMPLETED (or timeout after 15s).
 * 9. Assert: public reply called with expected text; private reply called with expected message + link;
 *    execution row has COMPLETED, correct IDs and timestamps; webhook_event row has PROCESSED.
 * 10. Send duplicate webhook -> assert no 2nd execution created.
 * 11. Send non-matching comment -> assert no execution created.
 * 12. Pause automation, send matching comment -> assert no execution created.
 * 13. Clean up database and terminate child processes cleanly.
 */

const TEST_DB_URL = "postgresql://postgres:pass@127.0.0.1:5433/replyza_test";
const REDIS_URL = "redis://127.0.0.1:6379";
process.env.DATABASE_URL = TEST_DB_URL;
process.env.DIRECT_URL = TEST_DB_URL;

import http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import path from "node:path";
import { encryptToken } from "../packages/shared/dist/index.js";
const API_PORT = 4004;
const MOCK_META_PORT = 4005;
const META_APP_SECRET = "smoke_meta_app_secret_abc12345";
const META_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function maskDbUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//***:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "***masked***";
  }
}

function verifyDatabaseHost(urlStr: string, name: string): void {
  const parsed = new URL(urlStr);
  const host = parsed.hostname;
  console.log(`[Smoke Host Check] ${name}: ${maskDbUrl(urlStr)}`);
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.error(`[ABORT] Non-local database host detected: ${host}`);
    process.exit(1);
  }
}

interface RecordedMetaCall {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const recordedCalls: RecordedMetaCall[] = [];

// Start Local Mock Meta Server
function startMockMetaServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        recordedCalls.push({
          method: req.method ?? "UNKNOWN",
          url: req.url ?? "",
          headers: req.headers,
          body,
        });

        // Instagram Comment Reply endpoint: /{commentId}/replies
        if (req.url?.includes("/replies")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: "mock_reply_id_smoke_999" }));
          return;
        }

        // Instagram Private Message endpoint: /{pageOrUserId}/messages
        if (req.url?.includes("/messages")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message_id: "mock_message_id_smoke_888" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      });
    });

    server.listen(MOCK_META_PORT, "127.0.0.1", () => {
      console.log(`[Smoke Test] Mock Meta server listening on 127.0.0.1:${MOCK_META_PORT}`);
      resolve(server);
    });
  });
}

const sharedEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: TEST_DB_URL,
  DIRECT_URL: TEST_DB_URL,
  REDIS_URL,
  PORT: String(API_PORT),
  FRONTEND_URL: "http://localhost:3000",
  JWT_SECRET: "smoke_test_jwt_secret_32_characters_minimum!!",
  SESSION_SECRET: "smoke_test_session_secret_32_characters_minimum!!",
  META_APP_SECRET,
  META_WEBHOOK_VERIFY_TOKEN: "smoke_test_webhook_verify_token_32_chars!!",
  META_APP_ID: "123456789012345",
  META_LOGIN_CONFIG_ID: "987654321098765",
  META_REDIRECT_URI: `http://localhost:${API_PORT}/api/v1/instagram/oauth/callback`,
  META_GRAPH_API_VERSION: "v21.0",
  META_TOKEN_ENCRYPTION_KEY: META_ENCRYPTION_KEY,
  META_GRAPH_BASE_URL: `http://127.0.0.1:${MOCK_META_PORT}`,
};

function spawnService(name: string, scriptPath: string): ChildProcess {
  const child = spawn(process.execPath, [scriptPath], {
    env: sharedEnv as NodeJS.ProcessEnv,
    cwd: path.resolve(__dirname, ".."),
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data) => {
    // optional debug logging
  });

  child.stderr?.on("data", (data) => {
    const msg = data.toString();
    if (!msg.includes("ExperimentalWarning") && !msg.includes("injected env")) {
      console.error(`[${name} Error]`, msg.trim());
    }
  });

  return child;
}

async function waitForReadiness(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  console.log(`[Smoke Test] Polling API readiness at http://127.0.0.1:${API_PORT}/api/v1/ready...`);

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/ready`);
      if (res.status === 200) {
        const json = await res.json() as any;
        if (json.status === "ready" && json.db === "ok" && json.redis === "ok") {
          console.log("[Smoke Test] API & Worker readiness confirmed (DB ok, Redis ok)!");
          return;
        }
      }
    } catch {
      // API not up yet, retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Timeout waiting for API readiness after ${timeoutMs}ms`);
}

async function runSmoke(): Promise<void> {
  verifyDatabaseHost(TEST_DB_URL, "DATABASE_URL");
  verifyDatabaseHost(TEST_DB_URL, "DIRECT_URL");

  const { prisma } = await import("../packages/database/dist/src/index.js");

  let mockMetaServer: http.Server | null = null;
  let apiProcess: ChildProcess | null = null;
  let workerProcess: ChildProcess | null = null;

  try {
    // Clean test database first
    console.log("[Smoke Test] Cleaning replyza_test database...");
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "automation_executions",
        "webhook_events",
        "automations",
        "instagram_accounts",
        "refresh_tokens",
        "users"
      CASCADE;
    `);

    // 1. Start Mock Meta Server
    mockMetaServer = await startMockMetaServer();

    // 2. Start API and Worker
    console.log("[Smoke Test] Starting API process...");
    apiProcess = spawnService("API", path.resolve(__dirname, "../apps/api/dist/server.js"));

    console.log("[Smoke Test] Starting Worker process...");
    workerProcess = spawnService("Worker", path.resolve(__dirname, "../apps/worker/dist/index.js"));

    // 3. Wait for Readiness
    await waitForReadiness();

    // 4. Register a user via the API and log in
    console.log("[Smoke Test] Registering test user via API...");
    const regRes = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "smoke_tester@replyza.com",
        password: "SuperSecretPassword123!",
        confirmPassword: "SuperSecretPassword123!",
      }),
    });

    if (!regRes.ok) {
      throw new Error(`User registration failed: HTTP ${regRes.status} ${await regRes.text()}`);
    }
    const regData = (await regRes.json()) as any;
    const userId = regData.data.user.id;
    console.log(`[Smoke Test] Registered user ${userId}`);

    console.log("[Smoke Test] Logging in to retrieve access token...");
    const loginRes = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "smoke_tester@replyza.com",
        password: "SuperSecretPassword123!",
      }),
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed: HTTP ${loginRes.status} ${await loginRes.text()}`);
    }
    const loginData = (await loginRes.json()) as any;
    const token = loginData.data.accessToken;
    console.log("[Smoke Test] Successfully authenticated via API");

    // 5. Insert a fake IG account into the DB with an encrypted fake token
    const igUserId = "smoke_ig_user_1001";
    const encryptedToken = encryptToken("smoke_meta_access_token_12345", META_ENCRYPTION_KEY);

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        instagramUserId: igUserId,
        username: "smoke_shop_official",
        encryptedAccessToken: encryptedToken,
      },
    });
    console.log(`[Smoke Test] Connected Instagram account: ${account.id} (@${account.username})`);

    // 6. Create an automation through the API, set it ACTIVE
    console.log("[Smoke Test] Creating automation via API...");
    const createAutoRes = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/automations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        instagramAccountId: account.id,
        name: "Smoke Deal Promotion",
        mediaId: "smoke_media_post_777",
        triggerType: "KEYWORD",
        keywords: ["deal", "discount"],
        publicReplyText: "Thanks for commenting! Check your DM for the code.",
        dmMessageText: "Here is your 50% discount voucher code: SAVE50",
        dmLink: "https://shop.example.com/promo",
      }),
    });

    if (!createAutoRes.ok) {
      throw new Error(`Create automation failed: HTTP ${createAutoRes.status} ${await createAutoRes.text()}`);
    }
    const autoData = (await createAutoRes.json()) as any;
    const automationId = autoData.data.id;

    // Activate the automation
    const activateRes = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/automations/${automationId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    if (!activateRes.ok) {
      throw new Error(`Activate automation failed: HTTP ${activateRes.status}`);
    }
    console.log(`[Smoke Test] Automation ${automationId} created and activated!`);

    // Helper to send signed webhook
    async function sendSignedWebhook(commentId: string, mediaId: string, text: string) {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: igUserId,
            time: Date.now(),
            changes: [
              {
                field: "comments",
                value: {
                  id: commentId,
                  text,
                  media: { id: mediaId },
                  from: { id: "fan_customer_50", username: "fan_alex" },
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex")}`;

      const res = await fetch(`http://127.0.0.1:${API_PORT}/api/v1/webhooks/instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: rawBody,
      });

      return { status: res.status, body: await res.text() };
    }

    // 7. Synthesize a signed Instagram comment webhook POST matching the automation
    console.log("[Smoke Test] Sending signed webhook with matching keyword comment...");
    const hook1 = await sendSignedWebhook("smoke_c_001", "smoke_media_post_777", "Can I get that DISCOUNT deal please?");
    if (hook1.status !== 200) {
      throw new Error(`Webhook failed: HTTP ${hook1.status} ${hook1.body}`);
    }

    // 8. Poll until the automation execution record reaches COMPLETED (or timeout after 15s)
    console.log("[Smoke Test] Polling execution status until COMPLETED...");
    const pollStart = Date.now();
    let completedExecution: any = null;

    while (Date.now() - pollStart < 15000) {
      const exec = await prisma.automationExecution.findFirst({
        where: { automationId },
        include: { webhookEvent: true },
      });

      if (exec?.status === "COMPLETED") {
        completedExecution = exec;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!completedExecution) {
      throw new Error("Timeout: Automation execution did not reach COMPLETED within 15 seconds!");
    }
    console.log("[Smoke Test] Execution reached COMPLETED!");

    // 9. Assertions
    // - Public reply called with expected text
    const publicCall = recordedCalls.find((c) => c.url.includes("/replies"));
    if (!publicCall) {
      throw new Error("Assertion failed: No public comment reply request was sent to Meta!");
    }
    const publicParams = new URLSearchParams(publicCall.body);
    if (publicParams.get("message") !== "Thanks for commenting! Check your DM for the code.") {
      throw new Error(`Assertion failed: Incorrect public reply text: ${publicParams.get("message")}`);
    }
    console.log("[Smoke Test] Assertion passed: Public reply called with expected text.");

    // - Private reply called with expected message + link
    const privateCall = recordedCalls.find((c) => c.url.includes("/messages"));
    if (!privateCall) {
      throw new Error("Assertion failed: No private DM request was sent to Meta!");
    }
    const privateParams = new URLSearchParams(privateCall.body);
    const privateMsg = privateParams.get("message");
    if (!privateMsg?.includes("SAVE50") || !privateMsg?.includes("https://shop.example.com/promo")) {
      throw new Error(`Assertion failed: Incorrect private DM message: ${privateMsg}`);
    }
    console.log("[Smoke Test] Assertion passed: Private reply called with expected message + link.");

    // - execution row has COMPLETED, correct IDs and timestamps; webhook_event row has PROCESSED
    if (
      completedExecution.publicReplyStatus !== "SUCCESS" ||
      completedExecution.privateReplyStatus !== "SUCCESS" ||
      !completedExecution.metaReplyId ||
      !completedExecution.metaPrivateReplyId ||
      !completedExecution.completedAt ||
      completedExecution.webhookEvent.status !== "PROCESSED"
    ) {
      throw new Error("Assertion failed: Execution / WebhookEvent record fields are incomplete or invalid!");
    }
    console.log("[Smoke Test] Assertion passed: Execution and WebhookEvent rows verified.");

    // 10. Send a duplicate webhook -> assert no second execution created
    console.log("[Smoke Test] Sending duplicate webhook...");
    await sendSignedWebhook("smoke_c_001", "smoke_media_post_777", "Can I get that DISCOUNT deal please?");
    const execCountAfterDup = await prisma.automationExecution.count({ where: { automationId } });
    if (execCountAfterDup !== 1) {
      throw new Error(`Assertion failed: Duplicate webhook created second execution! Total: ${execCountAfterDup}`);
    }
    console.log("[Smoke Test] Assertion passed: Duplicate webhook created no second execution.");

    // 11. Send a non-matching comment -> assert no execution created
    console.log("[Smoke Test] Sending non-matching comment...");
    await sendSignedWebhook("smoke_c_002", "smoke_media_post_777", "Just a regular comment without any keywords");
    await new Promise((r) => setTimeout(r, 1000));
    const execCountAfterNonMatch = await prisma.automationExecution.count({ where: { automationId } });
    if (execCountAfterNonMatch !== 1) {
      throw new Error(`Assertion failed: Non-matching comment created an execution! Total: ${execCountAfterNonMatch}`);
    }
    console.log("[Smoke Test] Assertion passed: Non-matching comment created no execution.");

    // 12. Pause the automation, send matching comment -> assert no execution created
    console.log("[Smoke Test] Pausing automation and sending matching comment...");
    await fetch(`http://127.0.0.1:${API_PORT}/api/v1/automations/${automationId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "PAUSED" }),
    });

    await sendSignedWebhook("smoke_c_003", "smoke_media_post_777", "I want the DISCOUNT deal!");
    await new Promise((r) => setTimeout(r, 1000));
    const execCountAfterPaused = await prisma.automationExecution.count({ where: { automationId } });
    if (execCountAfterPaused !== 1) {
      throw new Error(`Assertion failed: Paused automation created an execution! Total: ${execCountAfterPaused}`);
    }
    console.log("[Smoke Test] Assertion passed: Paused automation created no execution.");

    console.log("\n========================================================");
    console.log("SMOKE TEST SUCCESSFUL: All 12 verification gates passed!");
    console.log("========================================================\n");
  } finally {
    // 13. Clean up database and terminate child processes cleanly
    console.log("[Smoke Test] Cleaning up resources...");
    try {
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          "automation_executions",
          "webhook_events",
          "automations",
          "instagram_accounts",
          "refresh_tokens",
          "users"
        CASCADE;
      `);
      await prisma.$disconnect();
    } catch (e) {
      console.error("[Smoke Test] DB cleanup error:", e);
    }

    if (apiProcess) {
      apiProcess.kill("SIGTERM");
    }
    if (workerProcess) {
      workerProcess.kill("SIGTERM");
    }
    if (mockMetaServer) {
      mockMetaServer.close();
    }
  }
}

runSmoke().catch((err) => {
  console.error("\n[SMOKE TEST FAILED]", err);
  process.exit(1);
});
