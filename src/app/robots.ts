import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL;
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book/"],
      disallow: [
        "/dashboard/",
        "/onboarding",
        "/api/",
        "/sign-in",
        "/sign-up",
        "/book/manage/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
