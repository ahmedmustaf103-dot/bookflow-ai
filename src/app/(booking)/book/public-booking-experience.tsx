import type { CSSProperties } from "react";

import { PublicBookingWizard } from "@/app/(booking)/book/[orgSlug]/booking-wizard";
import { brandCssVars } from "@/lib/branding";
import { isPublicDemoSlug, onboardingCopy } from "@/lib/onboarding/copy";
import { db } from "@/server/db";

export async function PublicBookingExperience({
  organizationId,
}: {
  organizationId: string;
}) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return null;

  if (!org.publicBookingEnabled) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logoUrl}
            alt={org.name}
            className="mb-4 h-10 w-auto object-contain"
          />
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
        <p className="mt-3 text-sm text-[var(--ink-secondary)]">
          Online booking is temporarily unavailable. Please contact the business
          directly.
        </p>
      </div>
    );
  }

  const services = await db.service.findMany({
    where: { organizationId: org.id, isActive: true },
    include: {
      resources: {
        include: { resource: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const resourcesMap = new Map<
    string,
    { id: string; name: string; serviceIds: string[] }
  >();

  for (const service of services) {
    for (const sr of service.resources) {
      if (!sr.resource.isActive) continue;
      const existing = resourcesMap.get(sr.resourceId);
      if (existing) {
        existing.serviceIds.push(service.id);
      } else {
        resourcesMap.set(sr.resourceId, {
          id: sr.resourceId,
          name: sr.resource.name,
          serviceIds: [service.id],
        });
      }
    }
  }

  const resources = [...resourcesMap.values()];
  const theme = brandCssVars(org.brandPrimary) as CSSProperties;

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={theme}>
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logoUrl}
              alt={org.name}
              className="mb-4 h-12 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              Online booking
            </p>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            {org.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">
            Pick a service, choose who you&apos;d like, and confirm a time.
          </p>
          {isPublicDemoSlug(org.slug) ? (
            <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-2 text-sm text-[var(--ink-secondary)]">
              <span className="font-medium text-[var(--ink)]">
                {onboardingCopy.demoBanner.title}.
              </span>{" "}
              {onboardingCopy.demoBanner.body}
            </p>
          ) : null}
        </header>

        {services.length === 0 ? (
          <p className="text-sm text-[var(--ink-secondary)]">
            This business hasn&apos;t published services yet.
          </p>
        ) : (
          <PublicBookingWizard
            organizationId={org.id}
            organizationName={org.name}
            guidedTour={isPublicDemoSlug(org.slug)}
            services={services.map((s) => ({
              id: s.id,
              name: s.name,
              durationMin: s.durationMin,
              priceCents: s.priceCents,
              currency: s.currency,
              description: s.description,
            }))}
            resources={resources}
          />
        )}
      </div>
    </div>
  );
}
