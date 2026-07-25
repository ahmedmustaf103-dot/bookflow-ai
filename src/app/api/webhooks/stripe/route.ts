import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { syncSubscriptionFromStripe } from "@/server/billing/checkout";
import { getStripe } from "@/server/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe webhooks not configured" },
      { status: 503 },
    );
  }

  const body = await request.text();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    logger.error({ err: error }, "Stripe webhook signature failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(sub.id);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.mode === "subscription" &&
          typeof session.subscription === "string"
        ) {
          await syncSubscriptionFromStripe(session.subscription);
        }
        break;
      }
      default:
        logger.debug({ type: event.type }, "Unhandled Stripe event");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      { err: error, type: event.type },
      "Stripe webhook handler failed",
    );
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
