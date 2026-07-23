import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk session middleware only.
 * Protect resources in layouts/pages with `auth.protect()` (Clerk v7 guidance).
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
