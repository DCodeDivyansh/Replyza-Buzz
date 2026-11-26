import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({
    path: path.resolve(process.cwd(), "../../.env")
});

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
    JWT_SECRET: z.string().min(32),
    SESSION_SECRET: z.string().min(32),
    META_APP_SECRET: z.string().min(1),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(32),
    META_APP_ID: z.string().min(1),
    META_LOGIN_CONFIG_ID: z.string().min(1),
    META_REDIRECT_URI: z.string().url(),
    META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
    META_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    PROXY_SHARED_SECRET: z
      .string()
      .min(16)
      .default("replyza_default_proxy_secret_for_local_dev_123456789"),
  })
  .superRefine((data, ctx) => {
    // Disallow trailing slash on FRONTEND_URL to prevent URL construction bugs
    if (data.FRONTEND_URL.endsWith("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message: "FRONTEND_URL must not have a trailing slash",
      });
    }

    if (data.NODE_ENV === "production") {
      if (!data.FRONTEND_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["FRONTEND_URL"],
          message: "FRONTEND_URL must use HTTPS in production",
        });
      }
      if (!data.META_REDIRECT_URI.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["META_REDIRECT_URI"],
          message: "META_REDIRECT_URI must use HTTPS in production",
        });
      }
      if (data.META_APP_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["META_APP_SECRET"],
          message: "META_APP_SECRET must be at least 32 characters in production",
        });
      }
      if (data.PROXY_SHARED_SECRET === "replyza_default_proxy_secret_for_local_dev_123456789") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PROXY_SHARED_SECRET"],
          message: "Must configure a custom PROXY_SHARED_SECRET in production",
        });
      }
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = result.data;