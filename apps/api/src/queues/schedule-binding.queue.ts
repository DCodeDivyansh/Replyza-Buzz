import { Queue } from "bullmq";
import { redisConnection } from "./automation.queue";

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

export function scheduleBindingJobId(automationId: string): string {
  return `schedule-bind__${automationId}`;
}

/**
 * Schedules (or reschedules) the delayed binding poll job for `scheduledActivateAt - 1 minute`.
 */
export async function scheduleBindingPollJob(
  automationId: string,
  instagramAccountId: string,
  scheduledActivateAt: Date
): Promise<void> {
  await cancelBindingPollJob(automationId);

  const triggerAtMs = scheduledActivateAt.getTime() - 60_000;
  const delay = Math.max(0, triggerAtMs - Date.now());

  await scheduleBindingQueue.add(
    "poll-scheduled-binding",
    {
      automationId,
      instagramAccountId,
      pollCount: 0,
    },
    {
      jobId: scheduleBindingJobId(automationId),
      delay,
    }
  );
}

/**
 * Cancels any pending scheduled-binding poll job for an automation.
 */
export async function cancelBindingPollJob(automationId: string): Promise<void> {
  const baseId = scheduleBindingJobId(automationId);
  const existing = await scheduleBindingQueue.getJob(baseId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "active") {
      await existing.remove().catch(() => {});
    }
  }
}
