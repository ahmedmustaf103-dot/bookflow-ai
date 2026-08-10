import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";

import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { OverviewCopyLink } from "@/components/dashboard/overview-copy-link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Surface } from "@/components/ui/surface";
import { formatMoney } from "@/lib/client-tags";
import { env } from "@/lib/env";
import {
  deltaHint,
  getOrgAnalytics,
  getTodayAgenda,
} from "@/server/analytics/org";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function DashboardPage() {
  const ctx = await requireOrgOrRedirect();
  const orgId = ctx.organization.id;

  const [
    locationCount,
    resourceCount,
    serviceCount,
    bookingTotal,
    analytics7,
    today,
  ] = await Promise.all([
    ctx.db.location.count({ where: { isActive: true } }),
    ctx.db.resource.count({ where: { isActive: true } }),
    ctx.db.service.count({ where: { isActive: true } }),
    ctx.db.booking.count(),
    getOrgAnalytics(orgId, 7),
    getTodayAgenda(orgId, 5),
  ]);

  const bookUrl = `${env.NEXT_PUBLIC_APP_URL}/book/${ctx.organization.slug}`;
  const bookPath = `/book/${ctx.organization.slug}`;
  const setupComplete =
    serviceCount > 0 && resourceCount > 0 && locationCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={ctx.organization.name}
        description={`Welcome${ctx.user.firstName ? `, ${ctx.user.firstName}` : ""}. Plan ${ctx.organization.plan}.`}
        actions={
          <>
            <ButtonLink href="/dashboard/analytics" size="sm" variant="secondary">
              Analytics
            </ButtonLink>
            <ButtonLink href="/dashboard/appointments" size="sm">
              Calendar
            </ButtonLink>
          </>
        }
      />

      <SetupChecklist
        orgId={ctx.organization.id}
        hasServices={serviceCount > 0}
        hasResources={resourceCount > 0}
        hasBookings={bookingTotal > 0}
        bookPath={bookPath}
      />

      <Surface padding="md">
        <p className="mb-2 text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
          Public booking link
        </p>
        <OverviewCopyLink
          orgId={ctx.organization.id}
          value={bookUrl}
          label="Public booking link"
        />
      </Surface>

      {setupComplete ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/dashboard/appointments"
            className="bf-row-hover rounded-[var(--radius-panel)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Stat
              label="Upcoming"
              value={analytics7.upcoming}
              hint="On the calendar"
            />
          </Link>
          <Link
            href="/dashboard/analytics"
            className="bf-row-hover rounded-[var(--radius-panel)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Stat
              label="7-day revenue"
              value={formatMoney(
                analytics7.estimatedRevenueCents,
                analytics7.currency,
              )}
              hint={deltaHint(
                analytics7.estimatedRevenueCents,
                analytics7.previous.estimatedRevenueCents,
              )}
            />
          </Link>
          <Link
            href="/dashboard/analytics"
            className="bf-row-hover rounded-[var(--radius-panel)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Stat
              label="7-day bookings"
              value={analytics7.bookingsTotal}
              hint={deltaHint(
                analytics7.bookingsTotal,
                analytics7.previous.bookingsTotal,
              )}
            />
          </Link>
          <Link
            href="/dashboard/analytics"
            className="bf-row-hover rounded-[var(--radius-panel)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Stat
              label="No-show rate"
              value={`${Math.round(analytics7.noShowRate * 100)}%`}
              hint="Last 7 days"
            />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Locations",
              value: locationCount,
              href: "/dashboard/locations",
            },
            {
              label: "Staff / resources",
              value: resourceCount,
              href: "/dashboard/staff",
            },
            {
              label: "Services",
              value: serviceCount,
              href: "/dashboard/services",
            },
            {
              label: "Upcoming",
              value: analytics7.upcoming,
              href: "/dashboard/appointments",
            },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bf-row-hover rounded-[var(--radius-panel)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              <Stat label={stat.label} value={stat.value} />
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Surface>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Today</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                Next appointments on the schedule
              </p>
            </div>
            <Link
              href="/dashboard/appointments"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Open calendar
            </Link>
          </div>
          {today.length === 0 ? (
            <EmptyState
              className="py-8"
              title="Nothing scheduled today"
              description="Share your booking link or block time on the calendar."
              action={
                <ButtonLink href={bookPath} size="sm" variant="secondary">
                  Booking page
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {today.map((b) => (
                <li
                  key={b.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">
                      {b.client.name}
                    </p>
                    <p className="truncate text-xs text-[var(--ink-tertiary)]">
                      {b.service.name} · {b.resource.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-[var(--ink-secondary)]">
                    {formatInTimeZone(
                      b.startAt,
                      b.location.timezone,
                      "HH:mm",
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface>
          <h2 className="text-sm font-semibold">Quick links</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/dashboard/analytics"
                className="text-[var(--accent)] hover:underline"
              >
                Revenue & customer insights →
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/clients"
                className="text-[var(--accent)] hover:underline"
              >
                Client CRM →
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/ai"
                className="text-[var(--accent)] hover:underline"
              >
                AI briefing →
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/settings"
                className="text-[var(--accent)] hover:underline"
              >
                Automation settings →
              </Link>
            </li>
          </ul>
        </Surface>
      </div>
    </div>
  );
}
