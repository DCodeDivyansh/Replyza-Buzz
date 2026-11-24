import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { prisma } from "@replyza/database";
import app from "../apps/api/src/app";
import { encryptToken } from "../apps/api/src/utils/token-encryption";
import { automationQueue } from "../apps/api/src/queues/automation.queue";
import { processAutomationJob } from "../apps/worker/src/processors/automation.processor";

function assertSafeLocalTestDb() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.includes("127.0.0.1") && !dbUrl.includes("localhost")) {
    throw new Error("Refusing to run bench-and-soak against non-local database");
  }
  if (!dbUrl.includes("replyza_test")) {
    throw new Error("Refusing to run bench-and-soak: DATABASE_URL must target replyza_test");
  }
  const masked = dbUrl.replace(/:[^:@]+@/, ":***@");
  console.log(`[Bench] Target DB: ${masked}`);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
}

function signWebhook(body: string): string {
  const secret = process.env.META_APP_SECRET || "test_secret_123456";
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function seedRealisticVolume() {
  console.log("[Bench] Cleaning replyza_test and seeding realistic volume...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "delivery_actions",
      "messaging_webhook_events",
      "outbox_events",
      "automation_executions",
      "webhook_events",
      "automations",
      "instagram_accounts",
      "refresh_tokens",
      "users"
    CASCADE;
  `);

  const user = await prisma.user.create({
    data: {
      email: "bench_owner@replyza.buzz",
      passwordHash: "$argon2id$mock",
    },
  });

  const encToken = encryptToken("EAAB_bench_token_123456");

  // 50 Instagram accounts
  const accountsData = Array.from({ length: 50 }, (_, i) => ({
    id: randomUUID(),
    userId: user.id,
    instagramUserId: `ig_bench_acct_${i}`,
    username: `bench_brand_${i}`,
    encryptedAccessToken: encToken,
    status: "ACTIVE" as const,
  }));
  await prisma.instagramAccount.createMany({ data: accountsData });

  // 500 automations (10 per account, 1 all-media + 9 media-specific)
  const automationsData: Array<{
    id: string;
    instagramAccountId: string;
    name: string;
    mediaId: string | null;
    triggerType: "KEYWORD" | "ANY_COMMENT";
    keywords: string[];
    publicReplyText: string;
    dmMessageText: string;
    dmLink: string;
    status: "ACTIVE";
  }> = [];

  for (const acct of accountsData) {
    automationsData.push({
      id: randomUUID(),
      instagramAccountId: acct.id,
      name: "All Media Fallback",
      mediaId: null,
      triggerType: "ANY_COMMENT",
      keywords: [],
      publicReplyText: "Sent!",
      dmMessageText: "Hey {{first_name}}!",
      dmLink: "https://replyza.buzz/go",
      status: "ACTIVE",
    });
    for (let m = 0; m < 9; m++) {
      automationsData.push({
        id: randomUUID(),
        instagramAccountId: acct.id,
        name: `Post Auto ${m}`,
        mediaId: `media_${acct.instagramUserId}_${m}`,
        triggerType: "KEYWORD",
        keywords: ["LINK", "GUIDE", "PRICE"],
        publicReplyText: "Check DMs!",
        dmMessageText: "Here is your link {{first_name}}",
        dmLink: "https://replyza.buzz/go",
        status: "ACTIVE",
      });
    }
  }
  await prisma.automation.createMany({ data: automationsData });

  // 10,000 webhook events + 10,000 executions + 20,000 delivery actions (batched)
  const targetAccount = accountsData[0];
  const targetAutomation = automationsData[1];
  const batchSize = 2000;
  for (let b = 0; b < 5; b++) {
    const whBatch = Array.from({ length: batchSize }, (_, i) => {
      const idx = b * batchSize + i;
      return {
        id: randomUUID(),
        instagramAccountId: targetAccount.id,
        commentId: `seed_comment_${idx}`,
        mediaId: targetAutomation.mediaId!,
        commenterInstagramId: `seed_fan_${idx % 500}`,
        commenterUsername: `seed_fan_${idx % 500}`,
        commentText: "LINK please",
        eventPayload: {},
        status: "PROCESSED" as const,
      };
    });
    await prisma.webhookEvent.createMany({ data: whBatch });

    const execBatch = whBatch.map((wh) => ({
      id: randomUUID(),
      automationId: targetAutomation.id,
      webhookEventId: wh.id,
      status: "COMPLETED" as const,
      publicReplyStatus: "SUCCESS" as const,
      privateReplyStatus: "SUCCESS" as const,
      conversationState: "COMPLETED" as const,
      commenterIgsid: wh.commenterInstagramId,
    }));
    await prisma.automationExecution.createMany({ data: execBatch });

    const daBatch = execBatch.flatMap((ex) => [
      {
        id: randomUUID(),
        executionId: ex.id,
        actionType: "PUBLIC_REPLY" as const,
        status: "SENT" as const,
        attempts: 1,
        metaId: `pub_${ex.id}`,
      },
      {
        id: randomUUID(),
        executionId: ex.id,
        actionType: "HOOK_DM" as const,
        status: "SENT" as const,
        attempts: 1,
        metaId: `dm_${ex.id}`,
      },
    ]);
    await prisma.deliveryAction.createMany({ data: daBatch });
  }

  console.log("[Bench] Seeded: 50 accounts, 500 automations, 10,000 webhook_events, 10,000 executions, 20,000 delivery_actions.");
  return { user, targetAccount, targetAutomation };
}

async function runExplainQueries(accountId: string, automationId: string, mediaId: string) {
  console.log("\n[Bench] Running EXPLAIN ANALYZE on hot queries...");

  const q1 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT "id", "mediaId", "triggerType", "keywordMatchMode", "keywords"
     FROM "automations"
     WHERE "instagramAccountId" = $1::uuid
       AND "status" = 'ACTIVE'
       AND ("mediaId" = $2 OR "mediaId" IS NULL)
     ORDER BY "createdAt" ASC;`,
    accountId,
    mediaId
  );

  const q2 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT ae."id"
     FROM "automation_executions" ae
     JOIN "webhook_events" we ON we."id" = ae."webhookEventId"
     WHERE ae."automationId" = $1::uuid
       AND we."commenterInstagramId" = 'seed_fan_1'
       AND ae."createdAt" >= NOW() - INTERVAL '1 hour'
     LIMIT 1;`,
    automationId
  );

  const q3 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT ae."id", ae."status", ae."conversationState", ae."createdAt"
     FROM "automation_executions" ae
     JOIN "automations" a ON a."id" = ae."automationId"
     WHERE a."instagramAccountId" = $1::uuid
     ORDER BY ae."createdAt" DESC
     LIMIT 25;`,
    accountId
  );

  const extractTime = (rows: Array<{ "QUERY PLAN": string }>) =>
    rows.find((r) => r["QUERY PLAN"].includes("Execution Time"))?.["QUERY PLAN"] ?? "N/A";

  console.log("  Q1 (Active automation match):", extractTime(q1));
  console.log("  Q2 (Cooldown check):         ", extractTime(q2));
  console.log("  Q3 (Activity list 25 rows):  ", extractTime(q3));
}

async function runSoakAndLatencyTest(igUserId: string, mediaId: string, automationId: string) {
  console.log("\n[Bench] Running 100-comment burst + 20 duplicate retries soak test...");
  await automationQueue.drain();

  const originalFetch = global.fetch;
  let pubCalls = 0;
  let dmCalls = 0;

  global.fetch = (async (url: string | URL) => {
    const u = url.toString();
    if (u.includes("/replies")) {
      pubCalls++;
      return { ok: true, status: 200, json: async () => ({ id: `pub_${pubCalls}` }) } as Response;
    }
    if (u.includes("/messages")) {
      dmCalls++;
      return { ok: true, status: 200, json: async () => ({ message_id: `dm_${dmCalls}` }) } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  }) as typeof fetch;

  const webhookLatencies: number[] = [];
  const baseTs = Date.now();
  const commentIds = Array.from({ length: 100 }, (_, i) => `soak_c_${baseTs}_${i}`);

  // Send 100 unique comments in concurrent batches of 20 + 20 duplicate retries
  for (let offset = 0; offset < 100; offset += 20) {
    const batch = commentIds.slice(offset, offset + 20).map((cid, idx) => {
      const i = offset + idx;
      const body = JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: igUserId,
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: "comments",
                value: {
                  id: cid,
                  text: "LINK please!",
                  from: { id: `soak_fan_${i}`, username: `soak_fan_${i}` },
                  media: { id: mediaId, media_product_type: "REELS" },
                },
              },
            ],
          },
        ],
      });
      const sig = signWebhook(body);
      const t0 = performance.now();
      return request(app)
        .post("/api/v1/webhooks/instagram")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", sig)
        .send(body)
        .then((res) => {
          webhookLatencies.push(performance.now() - t0);
          return res;
        });
    });
    await Promise.all(batch);
  }

  // Send 20 duplicate retries of the first 20 comments
  await Promise.all(
    commentIds.slice(0, 20).map((cid, i) => {
      const body = JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: igUserId,
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: "comments",
                value: {
                  id: cid,
                  text: "LINK please!",
                  from: { id: `soak_fan_${i}`, username: `soak_fan_${i}` },
                  media: { id: mediaId, media_product_type: "REELS" },
                },
              },
            ],
          },
        ],
      });
      return request(app)
        .post("/api/v1/webhooks/instagram")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", signWebhook(body))
        .send(body);
    })
  );

  const jobs = await automationQueue.getJobs(["waiting", "delayed", "active"]);
  const pubJobLatencies: number[] = [];
  const dmJobLatencies: number[] = [];

  for (const job of jobs) {
    const t0 = performance.now();
    await processAutomationJob(job as any);
    const dt = performance.now() - t0;
    if (job.data.actionType === "PUBLIC_REPLY") pubJobLatencies.push(dt);
    else dmJobLatencies.push(dt);
  }

  global.fetch = originalFetch;

  const soakExecs = await prisma.automationExecution.findMany({
    where: {
      automationId,
      webhookEvent: { commentId: { in: commentIds } },
    },
  });

  webhookLatencies.sort((a, b) => a - b);
  pubJobLatencies.sort((a, b) => a - b);
  dmJobLatencies.sort((a, b) => a - b);

  console.log(`  Webhook HTTP p50=${percentile(webhookLatencies, 50)}ms p95=${percentile(webhookLatencies, 95)}ms max=${percentile(webhookLatencies, 100)}ms`);
  console.log(`  Worker PUBLIC_REPLY p50=${percentile(pubJobLatencies, 50)}ms p95=${percentile(pubJobLatencies, 95)}ms (calls=${pubCalls})`);
  console.log(`  Worker HOOK_DM      p50=${percentile(dmJobLatencies, 50)}ms p95=${percentile(dmJobLatencies, 95)}ms (calls=${dmCalls})`);
  console.log(`  Executions created=${soakExecs.length}/100, Completed=${soakExecs.filter((e) => e.status === "COMPLETED").length}/100`);

  if (soakExecs.length !== 100 || pubCalls !== 100 || dmCalls !== 100) {
    throw new Error(`Soak invariants failed: execs=${soakExecs.length}, pubCalls=${pubCalls}, dmCalls=${dmCalls}`);
  }
}

async function main() {
  assertSafeLocalTestDb();
  const { targetAccount, targetAutomation } = await seedRealisticVolume();
  await runExplainQueries(targetAccount.id, targetAutomation.id, targetAutomation.mediaId!);
  await runSoakAndLatencyTest(
    targetAccount.instagramUserId,
    targetAutomation.mediaId!,
    targetAutomation.id
  );
  await prisma.$disconnect();
  console.log("\n[Bench] All benchmarks and soak invariants PASSED.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
