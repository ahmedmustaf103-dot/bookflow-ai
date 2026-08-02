import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { env } from "@/lib/env";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function DashboardPage() {
  const ctx = await requireOrgOrRedirect();

  const [locationCount, resourceCount, serviceCount, upcoming] =
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
    ]);

  const bookUrl = `${env.NEXT_PUBLIC_APP_URL}/book/${ctx.organization.slug}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">
          {ctx.organization.name}
        </h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Welcome{ctx.user.firstName ? `, ${ctx.user.firstName}` : ""}. Plan:{" "}
          <span className="font-medium">{ctx.organization.plan}</span>
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-white/50 px-4 py-3 text-sm">
        Public booking link:{" "}
        <Link
          href={`/book/${ctx.organization.slug}`}
          className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          {bookUrl}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
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
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5 transition-colors hover:border-[var(--color-accent)]"
          >
            <p className="text-sm text-[var(--color-ink)]/60">{stat.label}</p>
            <p className="font-display mt-2 text-3xl">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/dashboard/appointments">Appointments</ButtonLink>
        <ButtonLink href={`/book/${ctx.organization.slug}`} variant="secondary">
          Open booking page
        </ButtonLink>
        <ButtonLink href="/dashboard/billing" variant="ghost">
          Billing
        </ButtonLink>
      </div>
    </div>
  );
}
