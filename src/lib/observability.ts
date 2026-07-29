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

export function runWithRequestContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  if (!isFeatureEnabled("request_tracing")) {
    return fn();
  }
  return storage.run(ctx, fn);
}

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Structured error log with request/tenant context when available. */
export function captureException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const ctx = getRequestContext();
  logger.error(
    {
      err: error,
      requestId: ctx?.requestId,
      organizationId: ctx?.organizationId,
      userId: ctx?.userId,
      path: ctx?.path,
      ...extra,
      sentryDsnConfigured: Boolean(process.env.SENTRY_DSN),
    },
    "captured exception",
  );

  // Hook point: when SENTRY_DSN is set, wire @sentry/nextjs in instrumentation.ts
  if (process.env.SENTRY_DSN && typeof process.env.SENTRY_DSN === "string") {
    // Intentionally no SDK import yet — keep build light; logs carry context for Axiom/Vercel.
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
