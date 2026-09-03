import "server-only";

import { auth } from "@clerk/nextjs/server";

import { clerkKeysArePlaceholders } from "@/lib/clerk-placeholders";

/** Clerk user id, or null when signed out / isolated test builds. */
export async function getOptionalClerkUserId() {
  if (clerkKeysArePlaceholders()) return null;
  const { userId } = await auth();
  return userId ?? null;
}
