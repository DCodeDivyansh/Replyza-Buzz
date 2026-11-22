
import { z } from "zod";

export const createAutomationSchema = z
  .object({
    instagramAccountId: z.string().uuid(),

    name: z.string().trim().min(1).max(100),

    mediaId: z.string().trim().min(1).max(255),

    mediaPermalink: z.string().url().optional(),

    mediaType: z
      .enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REELS"])
      .optional(),

    triggerType: z.enum(["ANY_COMMENT", "KEYWORD"]),

    keywords: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .default([]),

    publicReplyText: z.string().trim().min(1).max(500),

    dmMessageText: z.string().trim().min(1).max(2000),

    dmLink: z.string().url().optional()
  })
  .superRefine((data, ctx) => {
    if (data.triggerType === "KEYWORD" && data.keywords.length === 0) {
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

    triggerType: z.enum(["ANY_COMMENT", "KEYWORD"]).optional(),

    keywords: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .optional(),

    publicReplyText: z.string().trim().min(1).max(500).optional(),

    dmMessageText: z.string().trim().min(1).max(2000).optional(),

    dmLink: z.string().url().nullable().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.triggerType === "KEYWORD" && data.keywords?.length === 0) {
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
