
import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const server = app.listen(env.PORT, () => {
  logger.info(
    `Replyza API running on port ${env.PORT}`
  );

  logger.info(
    `Environment: ${env.NODE_ENV}`
  );
});

// Handle server startup errors.
server.on("error", (error: NodeJS.ErrnoException) => {
  logger.error({ err: error }, "Server error");

  process.exitCode = 1;
});

// Graceful shutdown.
function shutdown(signal: string): void {
  logger.info(`${signal} received. Shutting down...`);

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Shutdown failed");
      process.exitCode = 1;
      return;
    }

    logger.info("HTTP server closed successfully");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
