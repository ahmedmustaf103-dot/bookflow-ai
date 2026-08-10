import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBookingExperience } from "../public-booking-experience";
import { db } from "@/server/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      name: true,
      publicBookingEnabled: true,
      faviconUrl: true,
      logoUrl: true,
    },
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
    icons: org.faviconUrl
      ? { icon: org.faviconUrl }
      : org.logoUrl
        ? { icon: org.logoUrl }
        : undefined,
    openGraph: {
      title: `Book with ${org.name}`,
      description: `Schedule an appointment online with ${org.name}.`,
      images: org.logoUrl ? [{ url: org.logoUrl }] : undefined,
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
    select: { id: true },
  });
  if (!org) notFound();
  return <PublicBookingExperience organizationId={org.id} />;
}
