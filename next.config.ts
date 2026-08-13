import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { buildSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // E2E uses `.next-e2e` so `next start` never serves a production `.next` built with `.env.local`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
