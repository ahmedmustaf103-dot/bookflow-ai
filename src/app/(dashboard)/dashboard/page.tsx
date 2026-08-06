import Link from "next/link";

import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { OverviewCopyLink } from "@/components/dashboard/overview-copy-link";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Surface } from "@/components/ui/surface";
import { env } from "@/lib/env";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function DashboardPage() {
  const ctx = await requireOrgOrRedirect();

  const [locationCount, resourceCount, serviceCount, upcoming, bookingTotal] =
    await Promise.all([
      ctx.db.location.count({ where: { isActive: true } }),
      ctx.db.resource.count({ where: { isActive: true } }),
      ctx.db.service.count({ where: { isActive: true } }),
      ctx.db.booking.count({
        where: {
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { gte: new Date() },
        },
      }),
      ctx.db.booking.count(),
    ]);

  const bookUrl = `${env.NEXT_PUBLIC_APP_URL}/book/${ctx.organization.slug}`;
  const bookPath = `/book/${ctx.organization.slug}`;

  return (
    <div>
      <PageHeader
        title={ctx.organization.name}
        description={`Welcome${ctx.user.firstName ? `, ${ctx.user.firstName}` : ""}. Plan ${ctx.organization.plan}.`}
        actions={
          <>
            <ButtonLink href="/dashboard/appointments" size="sm">
              Calendar
            </ButtonLink>
            <ButtonLink href={bookPath} variant="secondary" size="sm">
              Booking page
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

      <Surface className="mb-6" padding="md">
        <p className="mb-2 text-xs font-medium text-[var(--ink-tertiary)] uppercase">
          Public booking link
        </p>
        <OverviewCopyLink
          orgId={ctx.organization.id}
          value={bookUrl}
          label="Public booking link"
        />
      </Surface>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Upcoming",
            value: upcoming,
            href: "/dashboard/appointments",
          },
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
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bf-row-hover rounded-[var(--radius-panel)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Stat label={stat.label} value={stat.value} />
          </Link>
        ))}
      </div>
    </div>
  );
}
