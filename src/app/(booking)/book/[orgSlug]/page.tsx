import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBookingWizard } from "./booking-wizard";
import { db } from "@/server/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: { name: true, publicBookingEnabled: true },
  });
  if (!org) return { title: "Book online", robots: { index: false } };
  if (!org.publicBookingEnabled) {
    return {
      title: org.name,
      description: `Online booking is currently unavailable for ${org.name}.`,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `Book with ${org.name}`,
    description: `Schedule an appointment online with ${org.name}.`,
    openGraph: {
      title: `Book with ${org.name}`,
      description: `Schedule an appointment online with ${org.name}.`,
    },
  };
}

export default async function PublicBookPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) notFound();

  if (!org.publicBookingEnabled) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
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

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--ink-tertiary)] uppercase">
            BookFlow AI
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            {org.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">
            Pick a service, choose who you&apos;d like, and confirm a time.
          </p>
        </header>

        {services.length === 0 ? (
          <p className="text-sm text-[var(--ink-secondary)]">
            This business hasn&apos;t published services yet.
          </p>
        ) : (
          <PublicBookingWizard
            organizationId={org.id}
            organizationName={org.name}
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
