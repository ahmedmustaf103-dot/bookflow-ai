import "server-only";

import { env } from "@/lib/env";
import { err, ok, type ActionResult } from "@/lib/result";
import { db } from "@/server/db";
import { priceIdToPlan } from "@/server/billing/plans";
import { requireStripe } from "@/server/billing/stripe";
import { requireMembership } from "@/server/auth/session";

export async function ensureStripeCustomer(organizationId: string) {
  const stripe = requireStripe();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  if (org.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { organizationId: org.id, slug: org.slug },
  });

  await db.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(input: {
  organizationId: string;
  priceId: string;
}): Promise<ActionResult<{ url: string }>> {
  try {
    await requireMembership(input.organizationId, "OWNER");
    const stripe = requireStripe();
    const customerId = await ensureStripeCustomer(input.organizationId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=1`,
      metadata: { organizationId: input.organizationId },
      subscription_data: {
        metadata: { organizationId: input.organizationId },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) return err("Stripe did not return a checkout URL");
    return ok({ url: session.url });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Checkout failed");
  }
}

export async function createBillingPortalSession(
  organizationId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    await requireMembership(organizationId, "OWNER");
    const stripe = requireStripe();
    const customerId = await ensureStripeCustomer(organizationId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return ok({ url: session.url });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Billing portal failed");
  }
}

export async function syncSubscriptionFromStripe(subscriptionId: string) {
  const stripe = requireStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = sub.metadata.organizationId;
  if (!organizationId) {
    throw new Error("Subscription missing organizationId metadata");
  }

  const priceId = sub.items.data[0]?.price.id ?? "";
  const plan = priceIdToPlan(priceId, env);

  const statusMap: Record<
    string,
    "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "UNPAID"
  > = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    unpaid: "UNPAID",
    paused: "PAST_DUE",
  };

  const periodEnd = (sub as { current_period_end?: number }).current_period_end;

  await db.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        status: statusMap[sub.status] ?? "INCOMPLETE",
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        status: statusMap[sub.status] ?? "INCOMPLETE",
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });

    if (plan && (sub.status === "active" || sub.status === "trialing")) {
      await tx.organization.update({
        where: { id: organizationId },
        data: { plan },
      });
    }

    if (sub.status === "canceled") {
      await tx.organization.update({
        where: { id: organizationId },
        data: { plan: "TRIAL" },
      });
    }
  });
}
