import { Job } from "bullmq";
import { prisma } from "@replyza/database";
import {
  decryptToken,
  defaultMetaGraphClient,
  matchesScheduledMediaFilters,
  type BindableMediaCandidate,
} from "@replyza/shared";
import { workerEnv } from "../config/env";
import {
  scheduleBindingQueue,
  type ScheduleBindingJobData,
} from "../queues/schedule-binding.queue";

const POLL_INTERVAL_MS = 30_000;

interface RecentMediaItem extends BindableMediaCandidate {
  permalink?: string;
}

export async function processScheduleBindingJob(
  job: Job<ScheduleBindingJobData>
): Promise<"BOUND" | "EXPIRED" | "RESCHEDULED" | "SKIPPED"> {
  const { automationId } = job.data;
  const now = new Date();

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: {
      instagramAccount: {
        select: {
          id: true,
          instagramUserId: true,
          encryptedAccessToken: true,
          status: true,
        },
      },
    },
  });

  if (
    !automation ||
    automation.status !== "SCHEDULED" ||
    automation.mediaId !== null ||
    automation.targetMode !== "SCHEDULED_TIME"
  ) {
    return "SKIPPED";
  }

  const activateAt = automation.scheduledActivateAt;
  if (!activateAt) {
    return "SKIPPED";
  }

  const windowEnd =
    automation.bindingWindowEndAt ??
    new Date(activateAt.getTime() + 30 * 60 * 1000);

  // If binding window has elapsed, mark EXPIRED so it never binds to an unrelated future post.
  if (now.getTime() > windowEnd.getTime()) {
    await prisma.automation.updateMany({
      where: {
        id: automation.id,
        status: "SCHEDULED",
        mediaId: null,
      },
      data: {
        status: "EXPIRED",
      },
    });
    return "EXPIRED";
  }

  const account = automation.instagramAccount;
  if (account.status === "NEEDS_RECONNECT") {
    return "SKIPPED";
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(
      account.encryptedAccessToken,
      workerEnv.metaTokenEncryptionKey
    );
  } catch {
    return "SKIPPED";
  }

  const res = await defaultMetaGraphClient.get<{ data?: RecentMediaItem[] }>(
    `${encodeURIComponent(account.instagramUserId)}/media`,
    {
      fields: "id,media_product_type,media_type,permalink,timestamp,caption",
      limit: 5,
    },
    accessToken
  );

  const candidates = res.data ?? [];
  const matched = candidates.find((item) =>
    matchesScheduledMediaFilters(item, automation, now)
  );

  if (matched) {
    const resolvedMediaType =
      matched.media_product_type === "REELS"
        ? "REELS"
        : matched.media_type ?? null;

    const bound = await prisma.automation.updateMany({
      where: {
        id: automation.id,
        status: "SCHEDULED",
        mediaId: null,
      },
      data: {
        mediaId: matched.id,
        mediaPermalink: matched.permalink ?? null,
        mediaType: resolvedMediaType,
        status: "ACTIVE",
      },
    });

    return bound.count === 1 ? "BOUND" : "SKIPPED";
  }

  // Not published yet — schedule next short-window poll if time remains.
  const remainingMs = windowEnd.getTime() - now.getTime();
  if (remainingMs <= 1_000) {
    await prisma.automation.updateMany({
      where: {
        id: automation.id,
        status: "SCHEDULED",
        mediaId: null,
      },
      data: {
        status: "EXPIRED",
      },
    });
    return "EXPIRED";
  }

  const nextPollCount = (job.data.pollCount ?? 0) + 1;
  const nextDelay = Math.min(POLL_INTERVAL_MS, remainingMs);

  await scheduleBindingQueue.add(
    "poll-scheduled-binding",
    {
      automationId: automation.id,
      instagramAccountId: automation.instagramAccountId,
      pollCount: nextPollCount,
    },
    {
      jobId: `schedule-bind__${automation.id}__p${nextPollCount}`,
      delay: nextDelay,
    }
  );

  return "RESCHEDULED";
}
