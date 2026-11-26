import { Queue } from "bullmq";
import { redisConnection } from "./automation.queue";

export interface FollowCheckJobData {
  executionId: string;
  igsid: string;
  instagramUserId: string;
  providerEventId?: string;
  selectedProductIndex?: number;
}

export const followCheckQueue = new Queue<FollowCheckJobData>(
  "follow-check-processing",
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

export async function enqueueFollowCheck(
  data: FollowCheckJobData
): Promise<void> {
  const jobId = data.providerEventId
    ? `follow-check__${data.executionId}__${data.providerEventId}`
    : `follow-check__${data.executionId}__${data.igsid}`;

  await followCheckQueue.add(
    "follow-check",
    data,
    {
      jobId,
    }
  );
}
