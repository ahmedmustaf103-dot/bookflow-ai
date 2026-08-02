import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Surface } from "@/components/ui/surface";
import { getOrgAnalytics } from "@/server/analytics/org";
import { getPlanLimits } from "@/server/billing/plans";
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
    ctx.db.location.count({ where: { isActive: true } }),
    ctx.db.resource.count({ where: { isActive: true } }),
    ctx.db.booking.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
        status: { not: "CANCELLED" },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description={`Last 30 days for ${ctx.organization.name}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bookings" value={analytics.bookingsTotal} />
        <Stat label="Upcoming" value={analytics.upcoming} />
        <Stat label="No-show rate" value={pct(analytics.noShowRate)} />
        <Stat
          label="Est. revenue"
          value={money(analytics.estimatedRevenueCents)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Completed" value={analytics.bookingsCompleted} />
        <Stat label="No-shows" value={analytics.bookingsNoShow} />
        <Stat label="Cancelled" value={analytics.bookingsCancelled} />
      </div>

      <Surface>
        <h2 className="text-sm font-semibold">Plan usage</h2>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Current plan: {ctx.organization.plan}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[var(--ink-secondary)]">
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
      </Surface>
    </div>
  );
}
