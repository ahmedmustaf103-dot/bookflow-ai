import {
  openBillingPortalAction,
  startCheckoutAction,
} from "@/server/actions/booking";
import { getStripe } from "@/server/billing/stripe";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { requireOrgOrRedirect } from "@/server/tenant/context";
import { Button } from "@/components/ui/button";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const ctx = await requireOrgOrRedirect();
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Billing</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Current plan:{" "}
          <span className="font-medium text-[var(--color-ink)]">
            {ctx.organization.plan}
          </span>
          {subscription
            ? ` · Stripe ${subscription.status}`
            : " · No Stripe subscription"}
        </p>
      </div>

      {params.success ? (
        <p className="rounded-md bg-[var(--color-accent-soft)] px-4 py-3 text-sm">
          Checkout completed — subscription syncs via webhook within a few
          seconds.
        </p>
      ) : null}
      {params.canceled ? (
        <p className="rounded-md border border-[var(--color-border)] px-4 py-3 text-sm">
          Checkout canceled.
        </p>
      ) : null}

      {!stripeReady ? (
        <p className="text-sm text-[var(--color-ink)]/65">
          Add <code>STRIPE_SECRET_KEY</code> and price IDs to{" "}
          <code>.env.local</code> to enable Checkout.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {prices.map((p) => (
              <div
                key={p.plan}
                className="flex flex-col rounded-lg border border-[var(--color-border)] p-5"
              >
                <h2 className="font-display text-xl">{p.label}</h2>
                <p className="mt-2 flex-1 text-sm text-[var(--color-ink)]/65">
                  {p.blurb}
                </p>
                {p.priceId ? (
                  <form action={startCheckoutAction} className="mt-4">
                    <input type="hidden" name="plan" value={p.plan} />
                    <Button type="submit" className="w-full">
                      Subscribe
                    </Button>
                  </form>
                ) : (
                  <p className="mt-4 text-xs text-[var(--color-ink)]/45">
                    Price ID not configured
                  </p>
                )}
              </div>
            ))}
          </div>

          {ctx.organization.stripeCustomerId ? (
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
