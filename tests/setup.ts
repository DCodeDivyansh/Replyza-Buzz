import { beforeAll, afterAll } from "vitest";

// Configure test environment variables BEFORE any application module loads
process.env.NODE_ENV = "test";
process.env.PORT = "4001";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://postgres:pass@127.0.0.1:5433/replyza_test";
process.env.DIRECT_URL = "postgresql://postgres:pass@127.0.0.1:5433/replyza_test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.JWT_SECRET = "test_jwt_secret_must_be_at_least_32_characters_long_for_zod";
process.env.SESSION_SECRET = "test_session_secret_must_be_at_least_32_characters_long";
process.env.META_APP_ID = "test_meta_app_id";
process.env.META_APP_SECRET = "test_meta_app_secret";
process.env.META_WEBHOOK_VERIFY_TOKEN = "test_webhook_verify_token_32_chars_long!!";
process.env.META_LOGIN_CONFIG_ID = "test_config_id";
process.env.META_REDIRECT_URI = "https://api.replyza.buzz/api/v1/instagram/oauth/callback";
process.env.META_GRAPH_API_VERSION = "v27.0";
process.env.META_TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// HARD RULE 1: Verify database host is localhost/127.0.0.1 and database is replyza_test
const dbUrl = new URL(process.env.DATABASE_URL);
const directUrl = new URL(process.env.DIRECT_URL);

const maskedDbUrl = `${dbUrl.protocol}//***:***@${dbUrl.host}${dbUrl.pathname}`;
const maskedDirectUrl = `${directUrl.protocol}//***:***@${directUrl.host}${directUrl.pathname}`;

console.log(`[Test Setup] DATABASE_URL: ${maskedDbUrl}`);
console.log(`[Test Setup] DIRECT_URL:   ${maskedDirectUrl}`);

const validHosts = new Set(["localhost", "127.0.0.1"]);
if (!validHosts.has(dbUrl.hostname) || !validHosts.has(directUrl.hostname)) {
  throw new Error(`CRITICAL: Automated tests must run against localhost/127.0.0.1! Aborting. Host was ${dbUrl.hostname}`);
}

if (!dbUrl.pathname.includes("replyza_test") || !directUrl.pathname.includes("replyza_test")) {
  throw new Error(`CRITICAL: Automated tests must run against database 'replyza_test'! Aborting. Database was ${dbUrl.pathname}`);
}

// Helper to clean tables
export async function cleanDatabase() {
  const { prisma } = await import("@replyza/database");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      automation_executions,
      webhook_events,
      automations,
      automation_templates,
      instagram_accounts,
      refresh_tokens,
      users
    CASCADE;
  `);
}

afterAll(async () => {
  const { prisma } = await import("@replyza/database");
  await prisma.$disconnect();
});
