
import { Worker, Queue } from "bullmq";
import { prisma } from "@replyza/database";
import { redisConnection } from "./config/redis";
import { processAutomationJob } from "./processors/automation.processor";
import { checkTokenExpirations } from "./processors/token-expiry.processor";
import { processFollowCheckJob } from "./processors/follow-check.processor";

const worker = new Worker(
  "automation-processing",
  processAutomationJob,
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

const followCheckWorker = new Worker(
  "follow-check-processing",
  processFollowCheckJob,
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

followCheckWorker.on("completed", (job) => {
  console.log(`[FollowCheckWorker] Job completed: ${job.id}`);
});

followCheckWorker.on("failed", (job, error) => {
  console.error(
    `[FollowCheckWorker] Job failed: ${job?.id ?? "unknown"}`,
    error.message
  );
});

// Token expiry checker queue & repeatable job
const tokenExpiryQueue = new Queue("token-expiry-checker", {
  connection: redisConnection,
});

const tokenExpiryWorker = new Worker(
  "token-expiry-checker",
  async () => {
    console.log("[Token Expiry Checker] Scanning for expiring or expired tokens...");
    const stats = await checkTokenExpirations();
    console.log("[Token Expiry Checker] Scan complete:", stats);
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

// Schedule daily check (every 24 hours) and run once on start
async function initTokenExpirySchedule() {
  try {
    await tokenExpiryQueue.add(
      "daily-token-check",
      {},
      {
        repeat: {
          every: 24 * 60 * 60 * 1000,
        },
        removeOnComplete: true,
        removeOnFail: 10,
      }
    );
    // Initial run
    await checkTokenExpirations();
  } catch (err) {
    console.warn("[Worker] Could not register token expiry repeatable job:", err);
  }
}

initTokenExpirySchedule();

worker.on("ready", () => {
  console.log("[Worker] Ready and waiting for jobs");
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `[Worker] Job failed: ${job?.id ?? "unknown"}`,
    error.message
  );
});

worker.on("error", (error) => {
  console.error("[Worker] Error:", error.message);
});

async function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}; shutting down`);

  await worker.close();
  await followCheckWorker.close();
  await tokenExpiryWorker.close();
  await tokenExpiryQueue.close();
  await redisConnection.quit();
  await prisma.$disconnect();

  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
