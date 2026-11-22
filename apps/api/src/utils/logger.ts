
import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.accessToken",
      "*.refreshToken",
      "*.password",
      "*.token"
    ],
    censor: "[REDACTED]"
  },

  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard"
          }
        }
      : undefined
});
