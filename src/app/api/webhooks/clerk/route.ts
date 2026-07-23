import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import {
  deleteUserByClerkId,
  upsertUserFromClerk,
  type ClerkUserPayload,
} from "@/server/users/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    logger.error({ err: error }, "Clerk webhook verification failed");
    return new Response("Invalid webhook", { status: 400 });
  }

  const log = logger.child({
    eventType: event.type,
    eventId: event.data.id,
  });

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        await upsertUserFromClerk(event.data as unknown as ClerkUserPayload);
        break;
      }
      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (clerkUserId) {
          await deleteUserByClerkId(clerkUserId);
        }
        break;
      }
      default:
        log.debug("Unhandled Clerk webhook event");
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error({ err: error }, "Clerk webhook handler failed");
    return new Response("Webhook handler error", { status: 500 });
  }
}
