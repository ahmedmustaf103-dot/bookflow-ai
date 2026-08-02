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
