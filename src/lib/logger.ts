import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Plain pino (no pino-pretty worker). Next.js Turbopack kills transport
 * workers and surfaces "the worker has exited" as console errors.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: {
    service: "bookflow-ai",
  },
  ...(isDev
    ? {
        // Readable single-line logs without a worker thread
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {}),
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
