import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface FollowCheckJobData {
  executionId: string;
  igsid: string;
  instagramUserId: string;
  providerEventId?: string;
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
