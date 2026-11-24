
import { prisma } from "@replyza/database";
import type {
  CreateAutomationInput,
  UpdateAutomationInput
} from "../validators/automation.validator";

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

  // Prevent duplicate automation for the same post.
  const existingAutomation = await prisma.automation.findUnique({
    where: {
      instagramAccountId_mediaId: {
        instagramAccountId: input.instagramAccountId,
        mediaId: input.mediaId
      }
    },
    select: {
      id: true
    }
  });

  if (existingAutomation) {
    throw new AutomationError(
      "An automation already exists for this post",
      409
    );
  }

  try {
    return await prisma.automation.create({
      data: {
        instagramAccountId: input.instagramAccountId,
        name: input.name,
        mediaId: input.mediaId,
        mediaPermalink: input.mediaPermalink,
        mediaType: input.mediaType,
        triggerType: input.triggerType,
        keywords: input.keywords,
        publicReplyText: input.publicReplyText,
        dmMessageText: input.dmMessageText,
        dmLink: input.dmLink,
        followRequired: input.followRequired ?? false,
        followInstructionText: input.followInstructionText,
        followSuccessText: input.followSuccessText,
        followFallbackText: input.followFallbackText,
        templateId: input.templateId,
        status: "DRAFT"
      }
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

  return prisma.automation.update({
    where: {
      id: automationId
    },
    data: input
  });
}

// Activate or pause automation.
export async function updateAutomationStatus(
  userId: string,
  automationId: string,
  status: "ACTIVE" | "PAUSED"
) {
  await getAutomationById(userId, automationId);

  return prisma.automation.update({
    where: {
      id: automationId
    },
    data: {
      status
    }
  });
}

// Delete automation.
export async function deleteAutomation(
  userId: string,
  automationId: string
) {
  await getAutomationById(userId, automationId);

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
