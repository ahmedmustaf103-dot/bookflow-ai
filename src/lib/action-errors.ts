import { Prisma } from "@/generated/prisma/client";
import type { ZodError } from "zod";

/** Safe errors that may be shown to end users. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function firstZodMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Map AI provider failures to a short staff-safe message. */
export function toSafeAiError(e: unknown, fallback: string): string {
  if (e instanceof UserFacingError) return e.message;
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "object" &&
          e &&
          "message" in e &&
          typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : "";
  const lower = msg.toLowerCase();
  if (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("resource_exhausted")
  ) {
    return "AI quota exceeded for this API key. Wait a bit, switch model, or use another key.";
  }
  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission")
  ) {
    return "AI API key was rejected. Check GOOGLE_GENERATIVE_AI_API_KEY / OPENAI_API_KEY.";
  }
  if (lower.includes("not found") && lower.includes("model")) {
    return "AI model not available for this key. Set AI_MODEL_GOOGLE=gemini-2.5-flash and restart.";
  }
  return toSafeActionError(e, fallback);
}

/** Map unknown failures to a client-safe string. Never leak Prisma/SQL internals. */
export function toSafeActionError(e: unknown, fallback: string): string {
  if (e instanceof UserFacingError) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "That record already exists";
    if (e.code === "P2025") return "Record not found";
    return fallback;
  }
  return fallback;
}
