
import { Worker } from "bullmq";
import { prisma } from "@replyza/database";
import { redisConnection } from "./config/redis";
import { processAutomationJob } from "./processors/automation.processor";

const worker = new Worker(
  "automation-processing",
  processAutomationJob,
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

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
  await redisConnection.quit();
  await prisma.$disconnect();

  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
