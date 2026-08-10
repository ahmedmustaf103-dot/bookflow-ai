import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBookingExperience } from "../public-booking-experience";
import { db } from "@/server/db";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}): Promise<Metadata> {
  const { host } = await searchParams;
  if (!host) return { title: "Book online", robots: { index: false } };
  const org = await db.organization.findFirst({
    where: {
      customDomain: host.toLowerCase(),
      customDomainStatus: "ACTIVE",
    },
    select: { name: true, faviconUrl: true, logoUrl: true },
  });
  if (!org) return { title: "Book online", robots: { index: false } };
  return {
    title: `Book with ${org.name}`,
    icons: org.faviconUrl
      ? { icon: org.faviconUrl }
      : org.logoUrl
        ? { icon: org.logoUrl }
        : undefined,
  };
}

/** Custom-domain entry: middleware rewrites unknown hosts here. */
export default async function BookByHostPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const { host } = await searchParams;
  if (!host) notFound();

  const org = await db.organization.findFirst({
    where: {
      customDomain: host.toLowerCase(),
      customDomainStatus: "ACTIVE",
    },
    select: { id: true },
  });

  if (!org) notFound();
  return <PublicBookingExperience organizationId={org.id} />;
}
