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
  if (!org) return { title: "Book online" };
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
        <h1 className="font-display text-3xl tracking-tight">{org.name}</h1>
        <p className="mt-3 text-[var(--color-ink)]/70">
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
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-[0.16em] text-[var(--color-accent)] uppercase">
          Book online
        </p>
        <h1 className="font-display mt-2 text-4xl tracking-tight">
          {org.name}
        </h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Pick a service, choose who you&apos;d like, and confirm a time.
        </p>
      </header>

      {services.length === 0 ? (
        <p className="text-[var(--color-ink)]/60">
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
  );
}
