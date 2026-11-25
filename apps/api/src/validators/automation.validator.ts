import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const createAutomationSchema = z
  .object({
    instagramAccountId: z.string().regex(uuidRegex, "Invalid account ID UUID"),

    name: z.string().trim().min(1).max(100),

    // Nullable for all-media automations
    mediaId: z.string().trim().min(1).max(255).nullable().optional(),

    mediaPermalink: z.string().url().nullable().optional(),

    mediaType: z
      .enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REELS"])
      .nullable()
      .optional(),

    triggerType: z.enum(["ANY_COMMENT", "KEYWORD"]),

    keywordMatchMode: z.enum(["CONTAINS", "EXACT", "ANY"]).default("CONTAINS"),

    keywords: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .default([]),

    publicReplyText: z.string().trim().min(1).max(500),

    publicReplyVariations: z
      .array(z.string().trim().min(1).max(500))
      .max(10)
      .default([]),

    dmMessageText: z.string().trim().min(1).max(2000),

    dmLink: z.string().url().nullable().optional(),

    deliveryMode: z.enum(["DIRECT", "BUTTON"]).default("DIRECT"),

    buttonLabel: z.string().trim().min(1).max(20).nullable().optional(),

    cooldownSeconds: z.number().int().min(0).max(86400).default(0),

    dmMeFallbackEnabled: z.boolean().default(false),

    followRequired: z.boolean().default(false),

    followInstructionText: z.string().trim().max(1000).nullable().optional(),

    followSuccessText: z.string().trim().max(1000).nullable().optional(),

    followFallbackText: z.string().trim().max(1000).nullable().optional(),

    templateId: z.string().regex(uuidRegex, "Invalid template ID UUID").nullable().optional()
  })
  .superRefine((data, ctx) => {
    if (
      data.triggerType === "KEYWORD" &&
      data.keywordMatchMode !== "ANY" &&
      data.keywords.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["keywords"],
        message: "At least one keyword is required for keyword automation"
      });
    }

    if (data.triggerType === "ANY_COMMENT" && data.keywords.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["keywords"],
        message: "Keywords are not allowed for ANY_COMMENT automation"
      });
    }
  });

export const updateAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),

    mediaId: z.string().trim().min(1).max(255).nullable().optional(),

    triggerType: z.enum(["ANY_COMMENT", "KEYWORD"]).optional(),

    keywordMatchMode: z.enum(["CONTAINS", "EXACT", "ANY"]).optional(),

    keywords: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .optional(),

    publicReplyText: z.string().trim().min(1).max(500).optional(),

    publicReplyVariations: z
      .array(z.string().trim().min(1).max(500))
      .max(10)
      .optional(),

    dmMessageText: z.string().trim().min(1).max(2000).optional(),

    dmLink: z.string().url().nullable().optional(),

    deliveryMode: z.enum(["DIRECT", "BUTTON"]).optional(),

    buttonLabel: z.string().trim().min(1).max(20).nullable().optional(),

    cooldownSeconds: z.number().int().min(0).max(86400).optional(),

    dmMeFallbackEnabled: z.boolean().optional(),

    followRequired: z.boolean().optional(),

    followInstructionText: z.string().trim().max(1000).nullable().optional(),

    followSuccessText: z.string().trim().max(1000).nullable().optional(),

    followFallbackText: z.string().trim().max(1000).nullable().optional(),

    templateId: z.string().regex(uuidRegex, "Invalid template ID UUID").nullable().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.triggerType === "KEYWORD" &&
      data.keywordMatchMode !== "ANY" &&
      data.keywords?.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["keywords"],
        message: "At least one keyword is required for keyword automation"
      });
    }

    if (data.triggerType === "ANY_COMMENT" && data.keywords?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["keywords"],
        message: "Keywords are not allowed for ANY_COMMENT automation"
      });
    }
  });

export const automationStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"])
});

export type CreateAutomationInput = z.infer<
  typeof createAutomationSchema
>;

export type UpdateAutomationInput = z.infer<
  typeof updateAutomationSchema
>;
