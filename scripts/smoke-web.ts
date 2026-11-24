/**
 * Playwright Web Smoke Test Orchestrator
 *
 * Runs against the local test stack:
 * 1. Verifies masked DB host is 127.0.0.1 (Hard Rule 1).
 * 2. Starts mock Meta server on port 4005 (Hard Rule 3).
 * 3. Starts API server on port 4000 targeting replyza_test.
 * 4. Starts Next.js web application on port 3000.
 * 5. Waits for services to be ready.
 * 6. Executes Playwright test suite (register -> login -> reload -> connect IG -> create auto -> pause -> logout).
 * 7. Shuts down child processes cleanly.
 */

import http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";

const TEST_DB_URL = "postgresql://postgres:pass@127.0.0.1:5433/replyza_test";
const REDIS_URL = "redis://127.0.0.1:6379";
const API_PORT = 4000;
const WEB_PORT = 3000;
const MOCK_META_PORT = 4005;

function maskDbUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//***:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "***masked***";
  }
}

function verifyDatabaseHost(urlStr: string): void {
  const parsed = new URL(urlStr);
  console.log(`[Web Smoke Host Check] DATABASE_URL: ${maskDbUrl(urlStr)}`);
  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    console.error(`[ABORT] Non-local database host detected: ${parsed.hostname}`);
    process.exit(1);
  }
}

function startMockMetaServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        // OAuth code exchange
        if (req.url?.includes("/oauth/access_token")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              access_token: "mock_playwright_token_12345",
              token_type: "bearer",
              expires_in: 5184000,
            })
          );
          return;
        }

        // Assigned Instagram accounts
        if (req.url?.includes("/me/assigned_instagram_accounts")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: [
                {
                  id: "ig_pw_account_777",
                  username: "playwright_store",
                },
              ],
            })
          );
          return;
        }

        // Instagram Media listing
        if (req.url?.includes("/media")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: [
                {
                  id: "media_pw_999",
                  caption: "Exclusive launch discount! Comment DEAL to claim your coupon code #launch",
                  media_type: "IMAGE",
                  media_product_type: "FEED",
                  permalink: "https://www.instagram.com/p/smoke_deal_777/",
                  timestamp: "2026-11-24T12:00:00+0000",
                },
              ],
              paging: {
                cursors: {
                  after: "mock_cursor_after_123",
                },
              },
            })
          );
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      });
    });

    server.listen(MOCK_META_PORT, "127.0.0.1", () => {
      console.log(`[Web Smoke] Mock Meta server listening on 127.0.0.1:${MOCK_META_PORT}`);
      resolve(server);
    });
  });
}

async function waitForUrl(url: string, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status >= 200 && res.status < 400) {
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url} after ${timeoutMs}ms`);
}

async function run(): Promise<void> {
  verifyDatabaseHost(TEST_DB_URL);

  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.DIRECT_URL = TEST_DB_URL;
  const { prisma } = await import("../packages/database/dist/src/index.js");

  console.log("[Web Smoke] Cleaning replyza_test database...");
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

  let mockMetaServer: http.Server | null = null;
  let apiProcess: ChildProcess | null = null;
  let webProcess: ChildProcess | null = null;

  try {
    mockMetaServer = await startMockMetaServer();

    console.log("[Web Smoke] Starting API server on port 4000...");
    apiProcess = spawn(
      process.execPath,
      [path.resolve(__dirname, "../apps/api/dist/server.js")],
      {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(API_PORT),
          DATABASE_URL: TEST_DB_URL,
          DIRECT_URL: TEST_DB_URL,
          REDIS_URL,
          FRONTEND_URL: `http://localhost:${WEB_PORT}`,
          JWT_SECRET: "smoke_test_jwt_secret_32_characters_minimum!!",
          SESSION_SECRET: "smoke_test_session_secret_32_characters_minimum!!",
          META_APP_SECRET: "smoke_meta_app_secret_abc12345",
          META_WEBHOOK_VERIFY_TOKEN: "smoke_test_webhook_verify_token_32_chars!!",
          META_APP_ID: "123456789012345",
          META_LOGIN_CONFIG_ID: "987654321098765",
          META_REDIRECT_URI: `http://localhost:${API_PORT}/api/v1/instagram/oauth/callback`,
          META_GRAPH_API_VERSION: "v21.0",
          META_TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          META_GRAPH_BASE_URL: `http://127.0.0.1:${MOCK_META_PORT}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    apiProcess.stdout?.on("data", (d) => {
      const line = d.toString().trim();
      if (line) console.log("[API]", line);
    });
    apiProcess.stderr?.on("data", (d) => {
      const line = d.toString().trim();
      if (line) console.error("[API Err]", line);
    });

    console.log("[Web Smoke] Starting Next.js web application on port 3000...");
    const isWindows = process.platform === "win32";
    const pnpmCmd = isWindows ? "pnpm.cmd" : "pnpm";

    webProcess = spawn(pnpmCmd, ["start", "-p", String(WEB_PORT)], {
      cwd: path.resolve(__dirname, "../apps/web"),
      env: {
        ...process.env,
        INTERNAL_API_URL: `http://localhost:${API_PORT}`,
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    console.log("[Web Smoke] Waiting for API readiness...");
    await waitForUrl(`http://127.0.0.1:${API_PORT}/api/v1/ready`);
    console.log("[Web Smoke] API is ready!");

    console.log("[Web Smoke] Waiting for Next.js web readiness...");
    await waitForUrl(`http://localhost:${WEB_PORT}/login`);
    console.log("[Web Smoke] Web application is ready!");

    console.log("[Web Smoke] Executing Playwright smoke tests...");
    const playwright = spawn(pnpmCmd, ["exec", "playwright", "test"], {
      cwd: path.resolve(__dirname, "../apps/web"),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: `http://localhost:${WEB_PORT}`,
      },
      stdio: "inherit",
      shell: true,
    });

    const exitCode = await new Promise<number>((resolve) => {
      playwright.on("close", resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Playwright tests exited with code ${exitCode}`);
    }

    console.log("\n========================================================");
    console.log("WEB SMOKE TEST SUCCESSFUL: All Playwright flows passed!");
    console.log("========================================================\n");
  } finally {
    console.log("[Web Smoke] Stopping child servers...");
    if (mockMetaServer) {
      mockMetaServer.close();
    }
    if (apiProcess) {
      apiProcess.kill("SIGTERM");
    }
    if (webProcess) {
      if (process.platform === "win32" && webProcess.pid) {
        spawn("taskkill", ["/pid", String(webProcess.pid), "/f", "/t"], { shell: true });
      } else {
        webProcess.kill("SIGTERM");
      }
    }
  }
}

run().catch((err) => {
  console.error("\n[WEB SMOKE TEST FAILED]", err);
  process.exit(1);
});
