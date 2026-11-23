
import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface AutomationJobData {
  executionId: string;
  automationId: string;
  webhookEventId: string;
}

const redisConnection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  }
);

redisConnection.on("error", (error) => {
  console.error("[API Redis] Connection error:", error.message);
});

export const automationQueue = new Queue<AutomationJobData>(
  "automation-processing",
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400,
        count: 1000,
      },
      removeOnFail: {
        age: 604800,
      },
    },
  }
);
