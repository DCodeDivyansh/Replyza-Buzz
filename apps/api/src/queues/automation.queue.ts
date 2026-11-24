
import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface AutomationJobData {
  executionId: string;
  automationId: string;
  webhookEventId: string;
  actionType?: "PUBLIC_REPLY" | "HOOK_DM";
}

export const redisConnection = new IORedis(
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

export async function enqueueAutomationExecution(
  data: AutomationJobData
): Promise<"QUEUED" | "ALREADY_QUEUED"> {
  const jobId = data.actionType
    ? `${data.executionId}:${data.actionType}`
    : data.executionId;
  const existingJob = await automationQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    if (state !== "completed" && state !== "failed") {
      return "ALREADY_QUEUED";
    }

    // Remove an old terminal BullMQ job before re-enqueueing.
    await existingJob.remove();
  }

  await automationQueue.add(
    data.actionType ? `process-${data.actionType.toLowerCase()}` : "process-automation",
    data,
    {
      jobId,
    }
  );

  return "QUEUED";
}
