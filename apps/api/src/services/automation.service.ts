
import { prisma } from "@replyza/database";
import {
  scheduleBindingPollJob,
  cancelBindingPollJob,
} from "../queues/schedule-binding.queue";
import type {
  AutomationProductInput,
  CreateAutomationInput,
  UpdateAutomationInput
} from "../validators/automation.validator";

async function validateProductOwnership(
  userId: string,
  products: AutomationProductInput[]
) {
  const ids = products
    .map((p) => p.affiliateProductId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;

  const uniqueIds = Array.from(new Set(ids));
  const owned = await prisma.affiliateProduct.findMany({
    where: { id: { in: uniqueIds }, userId },
    select: { id: true },
  });

  if (owned.length !== uniqueIds.length) {
    throw new AutomationError(
      "One or more selected affiliate products were not found",
      404
    );
  }
}

function mapProductCreateData(products: AutomationProductInput[]) {
  return products.map((p, index) => ({
    affiliateProductId: p.affiliateProductId ?? null,
    name: p.name,
    imageUrl: p.imageUrl ?? null,
    description: p.description ?? null,
    productUrl: p.productUrl ?? null,
    affiliateUrl: p.affiliateUrl,
    originalUrl: p.originalUrl ?? null,
    price: p.price ?? null,
    discountPrice: p.discountPrice ?? null,
    category: p.category ?? null,
    ctaLabel: p.ctaLabel || "Shop Now",
    customMessage: p.customMessage ?? null,
    couponCode: p.couponCode ?? null,
    brand: p.brand ?? null,
    sortOrder: p.sortOrder ?? index,
  }));
}

export class AutomationError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AutomationError";
  }
}

// Create an automation.
export async function createAutomation(
  userId: string,
  input: CreateAutomationInput
) {
  // Verify that the Instagram account belongs to this user.
  const account = await prisma.instagramAccount.findFirst({
    where: {
      id: input.instagramAccountId,
      userId
    },
    select: {
      id: true
    }
  });

  if (!account) {
    throw new AutomationError(
      "Instagram account not found",
      404
    );
  }

  const resolvedTargetMode =
    input.targetMode ?? (input.mediaId ? "SPECIFIC_POST" : "ALL_POSTS");
  const normalizedMediaId =
    resolvedTargetMode === "SPECIFIC_POST" ? (input.mediaId ?? null) : null;

  const scheduledActivateAt =
    resolvedTargetMode === "SCHEDULED_TIME" && input.scheduledActivateAt
      ? new Date(input.scheduledActivateAt)
      : null;

  const bindingWindowEndAt =
    resolvedTargetMode === "SCHEDULED_TIME" && scheduledActivateAt
      ? input.bindingWindowEndAt
        ? new Date(input.bindingWindowEndAt)
        : new Date(
            scheduledActivateAt.getTime() +
              (input.bindingWindowMinutes ?? 30) * 60 * 1000
          )
      : null;

  // Prevent duplicate automation for the same specific post.
  if (normalizedMediaId) {
    const existingAutomation = await prisma.automation.findFirst({
      where: {
        instagramAccountId: input.instagramAccountId,
        mediaId: normalizedMediaId,
      },
      select: { id: true },
    });

    if (existingAutomation) {
      throw new AutomationError(
        "An automation already exists for this post",
        409
      );
    }
  }

  const effectiveDeliveryMode = input.followRequired
    ? "BUTTON"
    : (input.deliveryMode ?? "DIRECT");

  let resolvedTemplateId: string | null = null;
  if (input.templateId) {
    try {
      const existingTemplate = await prisma.automationTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true },
      });
      resolvedTemplateId = existingTemplate ? existingTemplate.id : null;
    } catch {
      resolvedTemplateId = null;
    }
  }

  const products = input.products ?? [];
  await validateProductOwnership(userId, products);

  const effectiveDmLink = input.dmLink ?? products[0]?.affiliateUrl ?? null;

  try {
    return await prisma.automation.create({
      data: {
        instagramAccountId: input.instagramAccountId,
        name: input.name,
        targetMode: resolvedTargetMode,
        mediaId: normalizedMediaId,
        mediaPermalink: resolvedTargetMode === "SPECIFIC_POST" ? input.mediaPermalink : null,
        mediaType: resolvedTargetMode === "SPECIFIC_POST" ? input.mediaType : null,
        scheduledActivateAt,
        bindingWindowEndAt,
        mediaTypeFilter: input.mediaTypeFilter ?? "ANY",
        captionKeywordFilter: input.captionKeywordFilter ?? null,
        triggerType: input.triggerType,
        keywordMatchMode: input.keywordMatchMode ?? "CONTAINS",
        keywordMatchLogic: input.keywordMatchLogic ?? "ANY_KEYWORD",
        keywords: input.keywords,
        publicReplyEnabled: input.publicReplyEnabled ?? true,
        publicReplyText: input.publicReplyText,
        publicReplyVariations: input.publicReplyVariations ?? [],
        dmMessageText: input.dmMessageText,
        dmLink: effectiveDmLink,
        productDeliveryMode: input.productDeliveryMode ?? "SINGLE_MESSAGE",
        productIntroText: input.productIntroText ?? null,
        productClosingText: input.productClosingText ?? null,
        deliveryMode: effectiveDeliveryMode,
        buttonLabel: input.buttonLabel ?? null,
        cooldownSeconds: input.cooldownSeconds ?? 0,
        dmMeFallbackEnabled: input.dmMeFallbackEnabled ?? false,
        followRequired: input.followRequired ?? false,
        followInstructionText: input.followInstructionText,
        followSuccessText: input.followSuccessText,
        followFallbackText: input.followFallbackText,
        followUpEnabled: input.followUpEnabled ?? false,
        followUpText: input.followUpText ?? null,
        templateId: resolvedTemplateId,
        status: "DRAFT",
        products: products.length > 0 ? { create: mapProductCreateData(products) } : undefined,
      },
      include: {
        products: { orderBy: { sortOrder: "asc" } },
      },
    });
  } catch (error) {
    // Handle a duplicate created by a concurrent request.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AutomationError(
        "An automation already exists for this post",
        409
      );
    }

    throw error;
  }
}

// List all automations belonging to a user.
export async function getUserAutomations(userId: string) {
  return prisma.automation.findMany({
    where: {
      instagramAccount: {
        userId
      }
    },
    include: {
      instagramAccount: {
        select: {
          id: true,
          username: true,
          instagramUserId: true
        }
      },
      products: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

// Get one automation.
export async function getAutomationById(
  userId: string,
  automationId: string
) {
  const automation = await prisma.automation.findFirst({
    where: {
      id: automationId,
      instagramAccount: {
        userId
      }
    },
    include: {
      instagramAccount: {
        select: {
          id: true,
          username: true,
          instagramUserId: true
        }
      },
      products: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!automation) {
    throw new AutomationError(
      "Automation not found",
      404
    );
  }

  return automation;
}

// Update automation settings.
export async function updateAutomation(
  userId: string,
  automationId: string,
  input: UpdateAutomationInput
) {
  const existing = await getAutomationById(
    userId,
    automationId
  );

  const nextTriggerType = input.triggerType ?? existing.triggerType;
  const nextKeywords = input.keywords ?? existing.keywords;

  if (nextTriggerType === "KEYWORD" && nextKeywords.length === 0) {
    throw new AutomationError(
      "At least one keyword is required",
      400
    );
  }

  if (nextTriggerType === "ANY_COMMENT" && nextKeywords.length > 0) {
    throw new AutomationError(
      "Keywords are not allowed for ANY_COMMENT automation",
      400
    );
  }

  const { products, bindingWindowMinutes, ...scalarInput } = input;

  if (products !== undefined) {
    await validateProductOwnership(userId, products);
  }

  const nextTargetMode = scalarInput.targetMode ?? existing.targetMode;
  const nextScheduledAt =
    scalarInput.scheduledActivateAt !== undefined
      ? scalarInput.scheduledActivateAt
        ? new Date(scalarInput.scheduledActivateAt)
        : null
      : existing.scheduledActivateAt;
  const nextWindowEnd =
    scalarInput.bindingWindowEndAt !== undefined
      ? scalarInput.bindingWindowEndAt
        ? new Date(scalarInput.bindingWindowEndAt)
        : null
      : bindingWindowMinutes !== undefined && nextScheduledAt
        ? new Date(nextScheduledAt.getTime() + bindingWindowMinutes * 60 * 1000)
        : scalarInput.scheduledActivateAt && nextScheduledAt
          ? new Date(nextScheduledAt.getTime() + 30 * 60 * 1000)
          : existing.bindingWindowEndAt;

  const updated = await prisma.$transaction(async (tx) => {
    if (products !== undefined) {
      await tx.automationProduct.deleteMany({
        where: { automationId },
      });
      if (products.length > 0) {
        await tx.automationProduct.createMany({
          data: mapProductCreateData(products).map((p) => ({
            ...p,
            automationId,
          })),
        });
      }
    }

    return tx.automation.update({
      where: {
        id: automationId
      },
      data: {
        ...scalarInput,
        ...(scalarInput.scheduledActivateAt !== undefined ? { scheduledActivateAt: nextScheduledAt } : {}),
        ...(nextWindowEnd !== existing.bindingWindowEndAt ? { bindingWindowEndAt: nextWindowEnd } : {}),
        ...(nextTargetMode === "SCHEDULED_TIME" && existing.status === "EXPIRED" && nextWindowEnd && nextWindowEnd.getTime() > Date.now()
          ? { status: "SCHEDULED" }
          : {}),
        ...(products !== undefined && scalarInput.dmLink === undefined
          ? { dmLink: products[0]?.affiliateUrl ?? existing.dmLink }
          : {}),
      },
      include: {
        products: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });
  });

  if (updated.status === "SCHEDULED" && updated.targetMode === "SCHEDULED_TIME" && updated.scheduledActivateAt) {
    await scheduleBindingPollJob(updated.id, updated.instagramAccountId, updated.scheduledActivateAt).catch(() => {});
  } else {
    await cancelBindingPollJob(updated.id).catch(() => {});
  }

  return updated;
}

// Activate, schedule, or pause automation.
export async function updateAutomationStatus(
  userId: string,
  automationId: string,
  status: "ACTIVE" | "PAUSED" | "SCHEDULED"
) {
  const existing = await getAutomationById(userId, automationId);

  let targetStatus = status;

  if (
    (status === "ACTIVE" || status === "SCHEDULED") &&
    existing.targetMode === "SCHEDULED_TIME" &&
    existing.mediaId === null
  ) {
    if (!existing.scheduledActivateAt) {
      throw new AutomationError("Scheduled automation is missing scheduledActivateAt", 400);
    }
    const windowEnd =
      existing.bindingWindowEndAt ??
      new Date(existing.scheduledActivateAt.getTime() + 30 * 60 * 1000);
    if (windowEnd.getTime() <= Date.now()) {
      throw new AutomationError("Scheduled binding window has already expired", 400);
    }
    targetStatus = "SCHEDULED";
  }

  if (targetStatus === "ACTIVE" && existing.targetMode === "ALL_POSTS" && existing.mediaId === null) {
    const activeAllMedia = await prisma.automation.findFirst({
      where: {
        instagramAccountId: existing.instagramAccountId,
        targetMode: "ALL_POSTS",
        mediaId: null,
        status: "ACTIVE",
        id: { not: automationId },
      },
      select: { id: true },
    });

    if (activeAllMedia) {
      throw new AutomationError(
        "Only one active all-media automation is allowed per Instagram account",
        409
      );
    }
  }

  const updated = await prisma.automation.update({
    where: {
      id: automationId
    },
    data: {
      status: targetStatus
    }
  });

  if (targetStatus === "SCHEDULED" && existing.scheduledActivateAt) {
    await scheduleBindingPollJob(
      existing.id,
      existing.instagramAccountId,
      existing.scheduledActivateAt
    ).catch(() => {});
  } else if (targetStatus === "PAUSED") {
    await cancelBindingPollJob(existing.id).catch(() => {});
  }

  return updated;
}

// Delete automation.
export async function deleteAutomation(
  userId: string,
  automationId: string
) {
  await getAutomationById(userId, automationId);

  await cancelBindingPollJob(automationId).catch(() => {});

  await prisma.automation.delete({
    where: {
      id: automationId
    }
  });

  return {
    id: automationId,
    deleted: true
  };
}

export interface ListExecutionsFilter {
  automationId?: string;
  instagramAccountId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

const VALID_EXECUTION_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "RETRY_PENDING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
]);

export async function listUserExecutions(
  userId: string,
  filter: ListExecutionsFilter = {}
) {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, Math.max(1, filter.limit ?? 25));
  const skip = (page - 1) * limit;

  const statusFilter =
    filter.status && VALID_EXECUTION_STATUSES.has(filter.status)
      ? (filter.status as
          | "PENDING"
          | "PROCESSING"
          | "RETRY_PENDING"
          | "COMPLETED"
          | "PARTIAL"
          | "FAILED"
          | "CANCELLED")
      : undefined;

  const where = {
    automation: {
      ...(filter.automationId ? { id: filter.automationId } : {}),
      instagramAccount: {
        userId,
        ...(filter.instagramAccountId ? { id: filter.instagramAccountId } : {}),
      },
    },
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.automationExecution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        automationId: true,
        status: true,
        publicReplyStatus: true,
        privateReplyStatus: true,
        metaReplyId: true,
        metaPrivateReplyId: true,
        errorMessage: true,
        retryCount: true,
        lastAttemptAt: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        followCheckStatus: true,
        followCheckSentAt: true,
        followCheckVerifiedAt: true,
        followCheckRetryCount: true,
        metaFollowCheckReplyId: true,
        followVerificationOutcome: true,
        followCheckError: true,
        conversationState: true,
        deliveryActions: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            actionType: true,
            status: true,
            attempts: true,
            metaId: true,
            lastErrorCode: true,
            lastErrorMessage: true,
            sentAt: true,
          },
        },
        automation: {
          select: {
            id: true,
            name: true,
            mediaId: true,
            triggerType: true,
            followRequired: true,
            instagramAccount: {
              select: {
                id: true,
                username: true,
                instagramUserId: true,
              },
            },
          },
        },
        webhookEvent: {
          select: {
            id: true,
            commentId: true,
            mediaId: true,
            commenterUsername: true,
            commentText: true,
            status: true,
            receivedAt: true,
            processedAt: true,
          },
        },
        messagingEvents: {
          orderBy: { receivedAt: "desc" },
          take: 5,
          select: {
            id: true,
            providerEventId: true,
            status: true,
            receivedAt: true,
            processedAt: true,
          },
        },
      },
    }),
    prisma.automationExecution.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getUserExecutionById(
  userId: string,
  executionId: string
) {
  const execution = await prisma.automationExecution.findFirst({
    where: {
      id: executionId,
      automation: {
        instagramAccount: {
          userId,
        },
      },
    },
    select: {
      id: true,
      automationId: true,
      status: true,
      publicReplyStatus: true,
      privateReplyStatus: true,
      metaReplyId: true,
      metaPrivateReplyId: true,
      errorMessage: true,
      retryCount: true,
      lastAttemptAt: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      followCheckStatus: true,
      followCheckSentAt: true,
      followCheckVerifiedAt: true,
      followCheckRetryCount: true,
      metaFollowCheckReplyId: true,
      followVerificationOutcome: true,
      followCheckError: true,
      conversationState: true,
      deliveryActions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          actionType: true,
          status: true,
          attempts: true,
          metaId: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          sentAt: true,
        },
      },
      automation: {
        select: {
          id: true,
          name: true,
          mediaId: true,
          triggerType: true,
          followRequired: true,
          instagramAccount: {
            select: {
              id: true,
              username: true,
              instagramUserId: true,
            },
          },
        },
      },
      webhookEvent: {
        select: {
          id: true,
          commentId: true,
          mediaId: true,
          commenterUsername: true,
          commentText: true,
          status: true,
          receivedAt: true,
          processedAt: true,
        },
      },
      messagingEvents: {
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          providerEventId: true,
          status: true,
          receivedAt: true,
          processedAt: true,
        },
      },
    },
  });

  if (!execution) {
    throw new AutomationError("Execution not found", 404);
  }

  return execution;
}
