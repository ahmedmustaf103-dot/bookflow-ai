import {
  openBillingPortalAction,
  startCheckoutAction,
} from "@/server/actions/booking";
import { getStripe } from "@/server/billing/stripe";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { requireOrgRole } from "@/server/tenant/context";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const ctx = await requireOrgRole("ADMIN");
  const params = await searchParams;
  const stripeReady = Boolean(getStripe());

  const subscription = await db.subscription.findUnique({
    where: { organizationId: ctx.organization.id },
  });

  const prices = [
    {
      plan: "STARTER",
      label: "Starter",
      priceId: env.STRIPE_PRICE_STARTER,
      blurb: "1 location · 2 staff · 300 bookings/mo",
    },
    {
      plan: "GROWTH",
      label: "Growth",
      priceId: env.STRIPE_PRICE_GROWTH,
      blurb: "3 locations · 10 staff · SMS reminders · AI credits",
    },
    {
      plan: "BUSINESS",
      label: "Business",
      priceId: env.STRIPE_PRICE_BUSINESS,
      blurb: "Unlimited · SMS reminders · higher AI budget",
    },
  ] as const;

  const canBill = ctx.membership.role === "OWNER";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing"
        description={`Current plan: ${ctx.organization.plan}${
          subscription
            ? ` · Stripe ${subscription.status}`
            : " · No Stripe subscription"
        }`}
      />

      {ctx.membership.role !== "OWNER" ? (
        <Surface>
          <p className="text-sm text-[var(--ink-secondary)]">
            Only the business owner can change the paid plan. You can still view
            the current plan here.
          </p>
        </Surface>
      ) : null}

      {params.success ? (
        <Surface className="border-[var(--accent)] bg-[var(--accent-soft)]">
          <p className="text-sm text-[var(--ink)]">
            Checkout completed — subscription syncs via webhook within a few
            seconds.
          </p>
        </Surface>
      ) : null}
      {params.canceled ? (
        <Surface>
          <p className="text-sm text-[var(--ink-secondary)]">
            Checkout canceled.
          </p>
        </Surface>
      ) : null}

      {!stripeReady ? (
        <p className="text-sm text-[var(--ink-tertiary)]">
          Add <code>STRIPE_SECRET_KEY</code> and price IDs to{" "}
          <code>.env.local</code> to enable Checkout.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {prices.map((p) => (
              <Surface key={p.plan} className="flex flex-col">
                <h2 className="text-sm font-semibold">{p.label}</h2>
                <p className="mt-2 flex-1 text-sm text-[var(--ink-tertiary)]">
                  {p.blurb}
                </p>
                {p.priceId && canBill ? (
                  <form action={startCheckoutAction} className="mt-4">
                    <input type="hidden" name="plan" value={p.plan} />
                    <Button type="submit" className="w-full">
                      Subscribe
                    </Button>
                  </form>
                ) : p.priceId ? (
                  <p className="mt-4 text-xs text-[var(--ink-tertiary)]">
                    Ask the owner to subscribe
                  </p>
                ) : (
                  <p className="mt-4 text-xs text-[var(--ink-tertiary)]">
                    Price ID not configured
                  </p>
                )}
              </Surface>
            ))}
          </div>

          {canBill && ctx.organization.stripeCustomerId ? (
            <form action={openBillingPortalAction}>
              <Button type="submit" variant="secondary">
                Open customer portal
              </Button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
