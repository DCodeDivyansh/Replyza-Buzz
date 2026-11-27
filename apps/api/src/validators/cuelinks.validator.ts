import { z } from "zod";
import { isValidHttpUrl } from "@replyza/shared";

export const upsertCuelinksSchema = z.object({
  publisherId: z
    .string()
    .trim()
    .min(1, "Cuelinks Publisher ID is required")
    .max(64, "Publisher ID is too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Publisher ID must be alphanumeric"),
  apiKey: z.string().trim().max(256).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const convertCuelinksSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(2048, "URL is too long")
    .refine(isValidHttpUrl, {
      message: "URL must be a valid http:// or https:// URL",
    }),
  subid: z.string().trim().max(100).optional(),
});

export type UpsertCuelinksInput = z.infer<typeof upsertCuelinksSchema>;
export type ConvertCuelinksInput = z.infer<typeof convertCuelinksSchema>;
