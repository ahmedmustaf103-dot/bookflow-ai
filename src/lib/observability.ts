import { AsyncLocalStorage } from "node:async_hooks";

import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/server/flags";

export type RequestContext = {
  requestId: string;
  organizationId?: string;
  userId?: string;
  path?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  if (!isFeatureEnabled("request_tracing")) {
    return fn();
  }
  return storage.run(ctx, fn);
}

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Structured error log + Sentry when SENTRY_DSN is configured. */
export function captureException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const ctx = getRequestContext();
  const bindings = {
    requestId: ctx?.requestId,
    organizationId: ctx?.organizationId,
    userId: ctx?.userId,
    path: ctx?.path,
    ...extra,
  };

  logger.error({ err: error, ...bindings }, "captured exception");

  if (process.env.SENTRY_DSN) {
    void import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.withScope((scope) => {
          if (ctx?.requestId) scope.setTag("requestId", ctx.requestId);
          if (ctx?.organizationId) {
            scope.setTag("organizationId", ctx.organizationId);
          }
          if (ctx?.userId) scope.setUser({ id: ctx.userId });
          if (extra) scope.setExtras(extra);
          Sentry.captureException(error);
        });
      })
      .catch(() => {
        // Sentry optional at runtime
      });
  }
}

export function childLogger(bindings?: Record<string, unknown>) {
  const ctx = getRequestContext();
  return logger.child({
    requestId: ctx?.requestId,
    organizationId: ctx?.organizationId,
    userId: ctx?.userId,
    ...bindings,
  });
}
