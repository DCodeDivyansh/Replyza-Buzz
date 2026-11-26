import { z } from "zod";
import { validateTemplateVariables } from "@replyza/shared";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const httpUrlSchema = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .refine(
    (val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use http:// or https://" }
  );

const imageUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith("data:image/")) {
        return val.length <= 2_800_000;
      }
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Image must be a valid http(s) URL or uploaded image under 2MB" }
  );

export const automationProductInputSchema = z.object({
  affiliateProductId: z.string().regex(uuidRegex, "Invalid affiliate product ID").nullable().optional(),
  name: z.string().trim().min(1, "Product name is required").max(160),
  imageUrl: imageUrlSchema.nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  productUrl: httpUrlSchema.nullable().optional(),
  affiliateUrl: httpUrlSchema,
  originalUrl: httpUrlSchema.nullable().optional(),
  price: z.string().trim().max(40).nullable().optional(),
  discountPrice: z.string().trim().max(40).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  ctaLabel: z.string().trim().min(1).max(20).default("Shop Now"),
  customMessage: z.string().trim().max(500).nullable().optional(),
  couponCode: z.string().trim().max(60).nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type AutomationProductInput = z.infer<typeof automationProductInputSchema>;

function checkVariables(
  ctx: z.RefinementCtx,
  fields: Array<{ path: string; value?: string | null }>
) {
  for (const field of fields) {
    if (!field.value) continue;
    const res = validateTemplateVariables(field.value);
    if (!res.valid) {
      ctx.addIssue({
        code: "custom",
        path: [field.path],
        message: `Unsupported variable(s): ${res.unsupportedVariables.map((v) => `{{${v}}}`).join(", ")}`,
      });
    }
  }
}

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

    keywordMatchLogic: z.enum(["ANY_KEYWORD", "ALL_KEYWORDS"]).default("ANY_KEYWORD"),

    keywords: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .default([]),

    publicReplyEnabled: z.boolean().default(true),

    publicReplyText: z.string().trim().max(500).default("Check your DMs {{username}}! Sent it your way 🔥"),

    publicReplyVariations: z
      .array(z.string().trim().min(1).max(500))
      .max(10)
      .default([]),

    dmMessageText: z.string().trim().min(1).max(2000),

    dmLink: httpUrlSchema.nullable().optional(),

    productDeliveryMode: z
      .enum(["SINGLE_MESSAGE", "SEPARATE_MESSAGES", "GENERIC_CARDS", "SELECTION_PROMPT"])
      .default("SINGLE_MESSAGE"),

    productIntroText: z.string().trim().max(1000).nullable().optional(),

    productClosingText: z.string().trim().max(1000).nullable().optional(),

    products: z.array(automationProductInputSchema).max(10).default([]),

    deliveryMode: z.enum(["DIRECT", "BUTTON"]).default("DIRECT"),

    buttonLabel: z.string().trim().min(1).max(20).nullable().optional(),

    cooldownSeconds: z.number().int().min(0).max(86400).default(0),

    dmMeFallbackEnabled: z.boolean().default(false),

    followRequired: z.boolean().default(false),

    followInstructionText: z.string().trim().max(1000).nullable().optional(),

    followSuccessText: z.string().trim().max(1000).nullable().optional(),

    followFallbackText: z.string().trim().max(1000).nullable().optional(),

    followUpEnabled: z.boolean().default(false),

    followUpText: z.string().trim().max(1000).nullable().optional(),

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

    if (data.publicReplyEnabled && !data.publicReplyText.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["publicReplyText"],
        message: "Public reply text is required when public replies are enabled"
      });
    }

    checkVariables(ctx, [
      { path: "publicReplyText", value: data.publicReplyText },
      { path: "dmMessageText", value: data.dmMessageText },
      { path: "productIntroText", value: data.productIntroText },
      { path: "productClosingText", value: data.productClosingText },
      { path: "followInstructionText", value: data.followInstructionText },
      { path: "followSuccessText", value: data.followSuccessText },
      { path: "followFallbackText", value: data.followFallbackText },
      { path: "followUpText", value: data.followUpText },
    ]);
  });

export const updateAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),

    mediaId: z.string().trim().min(1).max(255).nullable().optional(),

    triggerType: z.enum(["ANY_COMMENT", "KEYWORD"]).optional(),

    keywordMatchMode: z.enum(["CONTAINS", "EXACT", "ANY"]).optional(),

    keywordMatchLogic: z.enum(["ANY_KEYWORD", "ALL_KEYWORDS"]).optional(),

    keywords: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .optional(),

    publicReplyEnabled: z.boolean().optional(),

    publicReplyText: z.string().trim().max(500).optional(),

    publicReplyVariations: z
      .array(z.string().trim().min(1).max(500))
      .max(10)
      .optional(),

    dmMessageText: z.string().trim().min(1).max(2000).optional(),

    dmLink: httpUrlSchema.nullable().optional(),

    productDeliveryMode: z
      .enum(["SINGLE_MESSAGE", "SEPARATE_MESSAGES", "GENERIC_CARDS", "SELECTION_PROMPT"])
      .optional(),

    productIntroText: z.string().trim().max(1000).nullable().optional(),

    productClosingText: z.string().trim().max(1000).nullable().optional(),

    products: z.array(automationProductInputSchema).max(10).optional(),

    deliveryMode: z.enum(["DIRECT", "BUTTON"]).optional(),

    buttonLabel: z.string().trim().min(1).max(20).nullable().optional(),

    cooldownSeconds: z.number().int().min(0).max(86400).optional(),

    dmMeFallbackEnabled: z.boolean().optional(),

    followRequired: z.boolean().optional(),

    followInstructionText: z.string().trim().max(1000).nullable().optional(),

    followSuccessText: z.string().trim().max(1000).nullable().optional(),

    followFallbackText: z.string().trim().max(1000).nullable().optional(),

    followUpEnabled: z.boolean().optional(),

    followUpText: z.string().trim().max(1000).nullable().optional(),

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

    checkVariables(ctx, [
      { path: "publicReplyText", value: data.publicReplyText },
      { path: "dmMessageText", value: data.dmMessageText },
      { path: "productIntroText", value: data.productIntroText },
      { path: "productClosingText", value: data.productClosingText },
      { path: "followInstructionText", value: data.followInstructionText },
      { path: "followSuccessText", value: data.followSuccessText },
      { path: "followFallbackText", value: data.followFallbackText },
      { path: "followUpText", value: data.followUpText },
    ]);
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
