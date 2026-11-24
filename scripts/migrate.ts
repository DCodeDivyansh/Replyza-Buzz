import { execSync } from "node:child_process";

function maskDbUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//***:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "INVALID_URL";
  }
}

function verifyHost(url: string, name: string) {
  try {
    const parsed = new URL(url);
    console.log(`[DB Check] ${name}: ${maskDbUrl(url)}`);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      console.error(`[ABORT] ${name} host ${parsed.hostname} is not localhost or 127.0.0.1!`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`[ABORT] Could not parse ${name}:`, e);
    process.exit(1);
  }
}

const mainDbUrl = process.env.DATABASE_URL || "postgresql://postgres:pass@127.0.0.1:5433/replyza";
const testDbUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:pass@127.0.0.1:5433/replyza_test";

verifyHost(mainDbUrl, "DATABASE_URL (main)");
verifyHost(testDbUrl, "DATABASE_URL (test)");

console.log("[Migration] Applying migrations to main database (replyza)...");
execSync("npx prisma migrate deploy", {
  cwd: "packages/database",
  env: { ...process.env, DATABASE_URL: mainDbUrl, DIRECT_URL: mainDbUrl },
  stdio: "inherit",
});

console.log("[Migration] Applying migrations to test database (replyza_test)...");
execSync("npx prisma migrate deploy", {
  cwd: "packages/database",
  env: { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl },
  stdio: "inherit",
});

console.log("[Migration] Generating Prisma Client...");
execSync("npx prisma generate", {
  cwd: "packages/database",
  stdio: "inherit",
});

console.log("[Migration] All migrations deployed and client generated successfully!");
