import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const currentDirectory = path.dirname(
  fileURLToPath(import.meta.url)
);

dotenv.config({
  path: path.resolve(currentDirectory, "../../.env")
});

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations"
  },

  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || env("DIRECT_URL") || env("DATABASE_URL")
  }
});