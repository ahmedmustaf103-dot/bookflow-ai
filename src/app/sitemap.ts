import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { db } from "@/server/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;

  const orgs = await db.organization.findMany({
    where: { publicBookingEnabled: true },
    select: { slug: true, updatedAt: true },
    take: 5000,
    orderBy: { updatedAt: "desc" },
  });

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...orgs.map((org) => ({
      url: `${base}/book/${org.slug}`,
      lastModified: org.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
