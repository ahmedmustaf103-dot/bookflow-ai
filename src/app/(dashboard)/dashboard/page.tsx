import Link from "next/link";

import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { OverviewCopyLink } from "@/components/dashboard/overview-copy-link";
import { DashboardFloor } from "@/components/dashboard/dashboard-floor";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Surface } from "@/components/ui/surface";
import { formatMoney } from "@/lib/client-tags";
import { publicBookingUrl } from "@/lib/booking-urls";
import {
  deltaHint,
  getOrgAnalytics,
  getDashboardFloor,
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
    floor,
  ] = await Promise.all([
    ctx.db.location.count({ where: { isActive: true } }),
    ctx.db.resource.count({ where: { isActive: true } }),
    ctx.db.service.count({ where: { isActive: true } }),
    ctx.db.booking.count(),
    getOrgAnalytics(orgId, 7),
    getDashboardFloor(orgId),
  ]);

  const bookUrl = publicBookingUrl(ctx.organization);
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
            <ButtonLink href="/dashboard/appointments/new" size="sm">
              New appointment
            </ButtonLink>
            <ButtonLink
              href="/dashboard/analytics"
              size="sm"
              variant="secondary"
            >
              Analytics
            </ButtonLink>
            <ButtonLink
              href="/dashboard/appointments"
              size="sm"
              variant="secondary"
            >
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

      <DashboardFloor
        current={floor.current}
        upcoming={floor.upcoming}
        recentlyCompleted={floor.recentlyCompleted}
        timeZone={floor.timeZone}
        bookPath={bookPath}
      />
    </div>
  );
}
