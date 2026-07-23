import "server-only";

import { db } from "@/server/db";
import { logger } from "@/lib/logger";

export type ClerkUserPayload = {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

export async function upsertUserFromClerk(data: ClerkUserPayload) {
  const email = data.email_addresses[0]?.email_address;

  if (!email) {
    logger.warn(
      { clerkUserId: data.id },
      "Clerk user missing email; skipping sync",
    );
    return null;
  }

  const user = await db.user.upsert({
    where: { clerkUserId: data.id },
    create: {
      clerkUserId: data.id,
      email,
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
    },
    update: {
      email,
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
    },
  });

  logger.info(
    { userId: user.id, clerkUserId: data.id },
    "Synced user from Clerk",
  );
  return user;
}

export async function deleteUserByClerkId(clerkUserId: string) {
  const existing = await db.user.findUnique({
    where: { clerkUserId },
  });

  if (!existing) {
    logger.info({ clerkUserId }, "User already absent; nothing to delete");
    return;
  }

  await db.user.delete({
    where: { clerkUserId },
  });

  logger.info(
    { clerkUserId, userId: existing.id },
    "Deleted user from Clerk webhook",
  );
}
