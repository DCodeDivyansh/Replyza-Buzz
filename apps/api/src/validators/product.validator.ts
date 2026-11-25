import { z } from "zod";

const httpUrlSchema = z
  .string()
  .trim()
  .url("Must be a valid URL (including https://)")
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
        // Cap inline data URLs at ~2MB
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

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(160),
  brand: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  affiliateUrl: httpUrlSchema,
  originalUrl: httpUrlSchema.nullable().optional(),
  price: z.string().trim().max(40).nullable().optional(),
  discountPrice: z.string().trim().max(40).nullable().optional(),
  discountInfo: z.string().trim().max(120).nullable().optional(),
  couponCode: z.string().trim().max(60).nullable().optional(),
  affiliatePartner: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  ctaLabel: z.string().trim().min(1).max(30).default("Shop Now"),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const updateProductSchema = createProductSchema.partial().strict();

export const importMetadataSchema = z.object({
  url: httpUrlSchema,
});

export const bulkImportProductsSchema = z.object({
  rawText: z.string().trim().min(1).max(20000).optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        affiliateUrl: httpUrlSchema,
        originalUrl: httpUrlSchema.nullable().optional(),
        imageUrl: imageUrlSchema.nullable().optional(),
        description: z.string().trim().max(1000).nullable().optional(),
        price: z.string().trim().max(40).nullable().optional(),
        discountPrice: z.string().trim().max(40).nullable().optional(),
        brand: z.string().trim().max(100).nullable().optional(),
        category: z.string().trim().max(80).nullable().optional(),
        ctaLabel: z.string().trim().min(1).max(30).optional(),
      })
    )
    .max(50)
    .optional(),
  extractMetadata: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type BulkImportProductsInput = z.infer<typeof bulkImportProductsSchema>;
