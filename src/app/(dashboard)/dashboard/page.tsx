import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { db } from "@/server/db";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function DashboardPage() {
  const ctx = await requireOrgOrRedirect();
  const orgId = ctx.organization.id;

  const [locationCount, resourceCount, serviceCount] = await Promise.all([
    db.location.count({ where: { organizationId: orgId, isActive: true } }),
    db.resource.count({ where: { organizationId: orgId, isActive: true } }),
    db.service.count({ where: { organizationId: orgId, isActive: true } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">
          {ctx.organization.name}
        </h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Welcome{ctx.user.firstName ? `, ${ctx.user.firstName}` : ""}. Public
          booking page will be{" "}
          <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-sm">
            /book/{ctx.organization.slug}
          </code>{" "}
          in Phase 2.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
        <ButtonLink href="/dashboard/services">Add a service</ButtonLink>
        <ButtonLink href="/dashboard/availability" variant="secondary">
          Edit hours
        </ButtonLink>
      </div>
    </div>
  );
}
