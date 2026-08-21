import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { clerkKeysArePlaceholders } from "@/lib/clerk-placeholders";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/invite(.*)",
]);

function appHostname() {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}

function shouldSkipHostRewrite(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/sign-") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/book/by-host") ||
    pathname.startsWith("/book/manage") ||
    pathname.startsWith("/_next")
  );
}

function applyCustomDomainRewrite(req: NextRequest) {
  const hostHeader = req.headers.get("host")?.split(":")[0]?.toLowerCase();
  const primary = appHostname();
  if (
    hostHeader &&
    hostHeader !== primary &&
    hostHeader !== "localhost" &&
    hostHeader !== "127.0.0.1" &&
    !hostHeader.endsWith(".localhost") &&
    !hostHeader.endsWith(".vercel.app") &&
    !shouldSkipHostRewrite(req.nextUrl.pathname)
  ) {
    // Custom domain prep: rewrite to resolver (activates when org.customDomainStatus=ACTIVE).
    const url = req.nextUrl.clone();
    url.pathname = "/book/by-host";
    url.searchParams.set("host", hostHeader);
    return NextResponse.rewrite(url);
  }
  return undefined;
}

function isolatedTestMiddleware(req: NextRequest) {
  if (isProtectedRoute(req)) {
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set(
      "redirect_url",
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    return NextResponse.redirect(signIn);
  }
  return applyCustomDomainRewrite(req) ?? NextResponse.next();
}

export default clerkKeysArePlaceholders()
  ? isolatedTestMiddleware
  : clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
      return applyCustomDomainRewrite(req);
    });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
