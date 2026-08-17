import { env } from "@/lib/env";

type OrgForBookingUrl = {
  slug: string;
  customDomain?: string | null;
  customDomainStatus?: string | null;
};

function appOrigin() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

/** Client-facing self-serve manage/cancel/reschedule link for a booking. */
export function bookingManageUrl(
  manageToken: string,
  org?: OrgForBookingUrl | null,
) {
  const base =
    org?.customDomain && org.customDomainStatus === "ACTIVE"
      ? `https://${org.customDomain}`
      : appOrigin();
  return `${base}/book/manage/${manageToken}`;
}

/** Public booking page for an organization (prefers active custom domain). */
export function publicBookingUrl(org: string | OrgForBookingUrl) {
  if (typeof org === "string") {
    return `${appOrigin()}/book/${org}`;
  }
  if (org.customDomain && org.customDomainStatus === "ACTIVE") {
    return `https://${org.customDomain}`;
  }
  return `${appOrigin()}/book/${org.slug}`;
}

/** Staff dashboard calendar — used in owner/admin booking emails. */
export function dashboardAppointmentsUrl() {
  return `${appOrigin()}/dashboard/appointments`;
}

export function appHostHostname() {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}
