import { env } from "@/lib/env";

/** Client-facing self-serve manage/cancel/reschedule link for a booking. */
export function bookingManageUrl(manageToken: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/book/manage/${manageToken}`;
}

/** Public booking page for an organization. */
export function publicBookingUrl(orgSlug: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/book/${orgSlug}`;
}
