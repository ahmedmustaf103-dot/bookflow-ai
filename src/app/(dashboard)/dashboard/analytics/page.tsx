import { getOrgAnalytics } from "@/server/analytics/org";
import { getPlanLimits } from "@/server/billing/plans";
import { db } from "@/server/db";
import { requireOrgRole } from "@/server/tenant/context";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function AnalyticsPage() {
  const ctx = await requireOrgRole("STAFF");
  const analytics = await getOrgAnalytics(ctx.organization.id, 30);
  const limits = getPlanLimits(ctx.organization.plan);

  const [locationCount, resourceCount, monthBookings] = await Promise.all([
    db.location.count({
      where: { organizationId: ctx.organization.id, isActive: true },
    }),
    db.resource.count({
      where: { organizationId: ctx.organization.id, isActive: true },
    }),
    db.booking.count({
      where: {
        organizationId: ctx.organization.id,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
        status: { not: "CANCELLED" },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Analytics</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Last 30 days for {ctx.organization.name}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Bookings", value: String(analytics.bookingsTotal) },
          { label: "Upcoming", value: String(analytics.upcoming) },
          { label: "No-show rate", value: pct(analytics.noShowRate) },
          {
            label: "Est. revenue",
            value: money(analytics.estimatedRevenueCents),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-[var(--color-border)] p-5"
          >
            <p className="text-sm text-[var(--color-ink)]/60">{card.label}</p>
            <p className="font-display mt-2 text-3xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <p className="text-sm text-[var(--color-ink)]/60">Completed</p>
          <p className="mt-2 text-2xl font-semibold">
            {analytics.bookingsCompleted}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <p className="text-sm text-[var(--color-ink)]/60">No-shows</p>
          <p className="mt-2 text-2xl font-semibold">
            {analytics.bookingsNoShow}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <p className="text-sm text-[var(--color-ink)]/60">Cancelled</p>
          <p className="mt-2 text-2xl font-semibold">
            {analytics.bookingsCancelled}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-[var(--color-border)] p-5">
        <h2 className="text-lg font-semibold">Plan usage</h2>
        <p className="mt-1 text-sm text-[var(--color-ink)]/60">
          Current plan: {ctx.organization.plan}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            Locations: {locationCount}
            {limits.locations != null ? ` / ${limits.locations}` : " / ∞"}
          </li>
          <li>
            Staff / resources: {resourceCount}
            {limits.resources != null ? ` / ${limits.resources}` : " / ∞"}
          </li>
          <li>
            Bookings this month: {monthBookings}
            {limits.bookingsPerMonth != null
              ? ` / ${limits.bookingsPerMonth}`
              : " / ∞"}
          </li>
          <li>Clients on file: {analytics.uniqueClients}</li>
        </ul>
      </section>
    </div>
  );
}
