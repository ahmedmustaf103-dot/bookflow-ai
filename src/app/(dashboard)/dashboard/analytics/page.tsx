import Link from "next/link";

import {
  BookingsTrendChart,
  TopServicesChart,
} from "@/components/dashboard/analytics-charts";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Surface } from "@/components/ui/surface";
import { formatMoney } from "@/lib/client-tags";
import {
  deltaHint,
  getBookingSeries,
  getCustomerInsights,
  getMonthBookingUsage,
  getOrgAnalytics,
  getStaffInsights,
  getTopServices,
} from "@/server/analytics/org";
import { getPlanLimits, planAllowsAi } from "@/server/billing/plans";
import { requireOrgRole } from "@/server/tenant/context";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function AnalyticsPage() {
  const ctx = await requireOrgRole("STAFF");
  const orgId = ctx.organization.id;
  const days = 30;

  const [analytics, series, topServices, staff, customers, recentInsight, usage] =
    await Promise.all([
      getOrgAnalytics(orgId, days),
      getBookingSeries(orgId, days),
      getTopServices(orgId, days, 5),
      getStaffInsights(orgId, days, 6),
      getCustomerInsights(orgId, days),
      ctx.db.aiRun.findFirst({
        where: { feature: "insight_digest" },
        orderBy: { createdAt: "desc" },
        select: { outputPreview: true, createdAt: true },
      }),
      Promise.all([
        ctx.db.location.count({ where: { isActive: true } }),
        ctx.db.resource.count({ where: { isActive: true } }),
        getMonthBookingUsage(orgId),
      ]),
    ]);

  const [locationCount, resourceCount, monthBookings] = usage;
  const limits = getPlanLimits(ctx.organization.plan);
  const hasActivity = analytics.bookingsTotal > 0 || analytics.upcoming > 0;
  const seriesHasSignal = series.some((p) => p.bookings > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description={`Last ${days} days by appointment time (${analytics.timeZone.replace(/_/g, " ")}).`}
        actions={
          <ButtonLink href="/dashboard/ai" variant="secondary" size="sm">
            AI insights
          </ButtonLink>
        }
      />

      {!hasActivity ? (
        <EmptyState
          title="No booking activity yet"
          description="Once clients start booking, you’ll see revenue trends, popular services, and staff load here."
          action={
            <>
              <ButtonLink href={`/book/${ctx.organization.slug}`} size="sm">
                Open booking page
              </ButtonLink>
              <ButtonLink
                href="/dashboard/appointments"
                variant="secondary"
                size="sm"
              >
                Calendar
              </ButtonLink>
            </>
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Est. revenue"
          value={formatMoney(
            analytics.estimatedRevenueCents,
            analytics.currency,
          )}
          hint={
            analytics.estimatedRevenueCents === 0
              ? "Completed visits in this period"
              : deltaHint(
                  analytics.estimatedRevenueCents,
                  analytics.previous.estimatedRevenueCents,
                )
          }
        />
        <Stat
          label="Bookings"
          value={analytics.bookingsTotal}
          hint={deltaHint(
            analytics.bookingsTotal,
            analytics.previous.bookingsTotal,
          )}
        />
        <Stat
          label="No-show rate"
          value={pct(analytics.noShowRate)}
          hint={
            analytics.bookingsNoShow > 0
              ? `${analytics.bookingsNoShow} no-shows · prior ${pct(analytics.previous.noShowRate)}`
              : "Keep confirming reminders to stay low"
          }
        />
        <Stat
          label="Upcoming"
          value={analytics.upcoming}
          hint="Confirmed + pending on the calendar"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Surface>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Booking trend</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                Daily bookings over the last {days} days
              </p>
            </div>
            <p className="text-xs tabular-nums text-[var(--ink-tertiary)]">
              {analytics.bookingsCompleted} completed ·{" "}
              {analytics.bookingsCancelled} cancelled
            </p>
          </div>
          {seriesHasSignal ? (
            <BookingsTrendChart data={series} currency={analytics.currency} />
          ) : (
            <EmptyState
              className="py-10"
              title="Not enough history for a trend"
              description="A few more bookings will unlock this chart."
            />
          )}
        </Surface>

        <Surface>
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Popular services</h2>
            <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
              What clients book most
            </p>
          </div>
          {topServices.length > 0 ? (
            <>
              <TopServicesChart
                data={topServices}
                currency={analytics.currency}
              />
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {topServices.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="truncate text-[var(--ink)]">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-[var(--ink-tertiary)]">
                      {s.count} ·{" "}
                      {formatMoney(s.revenueCents, analytics.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              className="py-10"
              title="No popular services yet"
              description="Completed and upcoming bookings will rank your services here."
            />
          )}
        </Surface>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Staff insights</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                Load and no-shows by resource
              </p>
            </div>
            <Link
              href="/dashboard/staff"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Manage staff
            </Link>
          </div>
          {staff.length === 0 ? (
            <EmptyState
              className="py-8"
              title="No staff activity"
              description="Bookings assigned to staff will show utilization here."
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {staff.map((row) => {
                const max = staff[0]?.bookings || 1;
                const width = Math.max(8, Math.round((row.bookings / max) * 100));
                return (
                  <li key={row.resourceId} className="py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[var(--ink)]">
                        {row.name}
                      </span>
                      <span className="tabular-nums text-[var(--ink-tertiary)]">
                        {row.bookings} bookings
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--ink-tertiary)]">
                      {row.completed} completed
                      {row.noShows > 0 ? ` · ${row.noShows} no-shows` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>

        <Surface>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Customer insights</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                Growth and loyalty signals
              </p>
            </div>
            <Link
              href="/dashboard/clients"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              View clients
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="New clients" value={customers.newClients} hint={`Last ${days} days`} />
            <Stat
              label="Returning this period"
              value={customers.returningClients}
              hint="Booked 2+ times recently"
            />
            <Stat
              label="Repeat bookers"
              value={customers.repeatBookers}
              hint="All-time 2+ completed visits"
            />
            <Stat
              label="Clients with upcoming"
              value={customers.clientsWithUpcoming}
              hint={`${analytics.uniqueClients} total on file`}
            />
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">AI insights</h2>
            {planAllowsAi(ctx.organization.plan) ? (
              <Link
                href="/dashboard/ai"
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Generate
              </Link>
            ) : null}
          </div>
          {recentInsight?.outputPreview ? (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--ink-secondary)]">
                {recentInsight.outputPreview}
              </p>
              <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
                Last generated{" "}
                {recentInsight.createdAt.toLocaleString()}
              </p>
            </>
          ) : (
            <EmptyState
              className="py-8"
              title="No AI briefing yet"
              description={
                planAllowsAi(ctx.organization.plan)
                  ? "Generate a business insights digest to get concrete next actions."
                  : "Upgrade to Growth or Business to unlock AI insights."
              }
              action={
                planAllowsAi(ctx.organization.plan) ? (
                  <ButtonLink href="/dashboard/ai" size="sm">
                    Open AI
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/dashboard/billing" size="sm">
                    View plans
                  </ButtonLink>
                )
              }
            />
          )}
        </Surface>

        <Surface>
          <h2 className="text-sm font-semibold">Plan usage</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Current plan: {ctx.organization.plan}
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-[var(--ink-secondary)]">
            <li className="flex justify-between gap-3">
              <span>Locations</span>
              <span className="tabular-nums">
                {locationCount}
                {limits.locations != null ? ` / ${limits.locations}` : " / ∞"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Staff / resources</span>
              <span className="tabular-nums">
                {resourceCount}
                {limits.resources != null ? ` / ${limits.resources}` : " / ∞"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Bookings this month</span>
              <span className="tabular-nums">
                {monthBookings}
                {limits.bookingsPerMonth != null
                  ? ` / ${limits.bookingsPerMonth}`
                  : " / ∞"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Clients on file</span>
              <span className="tabular-nums">{analytics.uniqueClients}</span>
            </li>
          </ul>
        </Surface>
      </div>
    </div>
  );
}
