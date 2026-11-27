import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface ScheduleBindingJobData {
  automationId: string;
  instagramAccountId: string;
  pollCount?: number;
}

export const scheduleBindingQueue = new Queue<ScheduleBindingJobData>(
  "schedule-binding",
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600,
        count: 500,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  }
);
