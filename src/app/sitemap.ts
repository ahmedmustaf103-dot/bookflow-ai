import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { db } from "@/server/db";

/** Request-time only — do not prerender against a live database at build. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;
  const home: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    const orgs = await db.organization.findMany({
      where: { publicBookingEnabled: true },
      select: { slug: true, updatedAt: true },
      take: 5000,
      orderBy: { updatedAt: "desc" },
    });

    return [
      ...home,
      ...orgs.map((org) => ({
        url: `${base}/book/${org.slug}`,
        lastModified: org.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // Build/CI/test must not require production Prisma or a reachable DB.
    return home;
  }
}
