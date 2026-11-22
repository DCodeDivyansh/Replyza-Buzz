import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({
    path: path.resolve(process.cwd(), "../../.env")
});

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"])
        .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    META_APP_SECRET: z.string().min(1),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(32)
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = result.data;