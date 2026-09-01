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
import { canEditCalendar, canManage } from "@/server/auth/session";
import { getPilotSetupStatus } from "@/server/onboarding/setup-status";
import { resolveStaffResourceScope } from "@/server/staff/scope";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function DashboardPage() {
  const ctx = await requireOrgOrRedirect();
  const orgId = ctx.organization.id;
  const role = ctx.membership.role;
  const manage = canManage(role);
  const staffPlus = canEditCalendar(role);
  const scope = await resolveStaffResourceScope({
    organizationId: orgId,
    userId: ctx.user.id,
    role,
  });
  const floorResourceIds = scope.all ? undefined : scope.resourceIds;

  const [locationCount, resourceCount, serviceCount, analytics7, floor, setup] =
    await Promise.all([
      manage
        ? ctx.db.location.count({ where: { isActive: true } })
        : Promise.resolve(0),
      manage
        ? ctx.db.resource.count({ where: { isActive: true } })
        : Promise.resolve(0),
      manage
        ? ctx.db.service.count({ where: { isActive: true } })
        : Promise.resolve(0),
      manage ? getOrgAnalytics(orgId, 7) : Promise.resolve(null),
      getDashboardFloor(orgId, new Date(), floorResourceIds),
      manage
        ? getPilotSetupStatus({
            organizationId: orgId,
            name: ctx.organization.name,
            logoUrl: ctx.organization.logoUrl,
            reminderHoursBefore: ctx.organization.reminderHoursBefore,
          })
        : Promise.resolve(null),
    ]);

  const bookUrl = publicBookingUrl(ctx.organization);
  const bookPath = `/book/${ctx.organization.slug}`;
  const setupComplete =
    serviceCount > 0 && resourceCount > 0 && locationCount > 0;
  const upcomingCount = analytics7?.upcoming ?? floor.upcoming.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={ctx.organization.name}
        description={`Welcome${ctx.user.firstName ? `, ${ctx.user.firstName}` : ""}. You're on the ${ctx.organization.plan.charAt(0)}${ctx.organization.plan.slice(1).toLowerCase()} plan.`}
        actions={
          <>
            {staffPlus ? (
              <ButtonLink
                href="/dashboard/appointments/new"
                size="sm"
                className="min-h-11 w-full sm:h-8 sm:w-auto"
              >
                New appointment
              </ButtonLink>
            ) : null}
            {manage ? (
              <ButtonLink
                href="/dashboard/analytics"
                size="sm"
                variant="secondary"
                className="min-h-11 w-full sm:h-8 sm:w-auto"
              >
                Analytics
              </ButtonLink>
            ) : null}
            {staffPlus ? (
              <ButtonLink
                href="/dashboard/appointments"
                size="sm"
                variant="secondary"
                className="min-h-11 w-full sm:h-8 sm:w-auto"
              >
                Calendar
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {setup ? (
        <SetupChecklist
          orgId={ctx.organization.id}
          items={setup.items}
          bookPath={bookPath}
        />
      ) : null}

      {manage ? (
        <Surface padding="md" data-tour="owner-booking-link">
          <p className="mb-2 text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
            Your booking link
          </p>
          <p className="mb-2 text-sm text-[var(--ink-secondary)]">
            Give this link to your customers so they can book appointments
            online.
          </p>
          <OverviewCopyLink
            orgId={ctx.organization.id}
            value={bookUrl}
            label="Your booking link"
          />
        </Surface>
      ) : null}

      {manage && setupComplete && analytics7 ? (
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
      ) : manage && analytics7 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Locations",
              value: locationCount,
              href: "/dashboard/locations",
            },
            {
              label: "Staff",
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
      ) : staffPlus ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/appointments"
            className="bf-row-hover rounded-[var(--radius-panel)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Stat
              label="Upcoming today"
              value={upcomingCount}
              hint={
                scope.all
                  ? "On the calendar"
                  : scope.resourceIds.length === 0
                    ? "Ask the owner to add you as a staff member"
                    : "Your appointments"
              }
            />
          </Link>
        </div>
      ) : null}

      <DashboardFloor
        current={floor.current}
        upcoming={floor.upcoming}
        recentlyCompleted={floor.recentlyCompleted}
        timeZone={floor.timeZone}
        bookPath={bookPath}
        showOwnerLinks={manage}
        showCrmLink={staffPlus}
      />
    </div>
  );
}
