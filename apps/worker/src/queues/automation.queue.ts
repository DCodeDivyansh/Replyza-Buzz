import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface AutomationJobData {
  executionId: string;
  automationId: string;
  webhookEventId: string;
  actionType?: "PUBLIC_REPLY" | "HOOK_DM";
}

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