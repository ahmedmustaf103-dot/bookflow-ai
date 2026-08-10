import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ManageAppointmentClient } from "./manage-appointment";
import { brandCssVars } from "@/lib/branding";
import { manageTokenSchema } from "@/server/actions/schemas";
import { getPublicManagedBooking } from "@/server/bookings/manage";

export const metadata: Metadata = {
  title: "Manage appointment",
  robots: { index: false, follow: false },
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ manageToken: string }>;
}) {
  const { manageToken: rawToken } = await params;
  const parsed = manageTokenSchema.safeParse(rawToken);
  if (!parsed.success) notFound();

  const result = await getPublicManagedBooking(parsed.data);
  if (!result.ok) notFound();

  const booking = result.data;
  const theme = brandCssVars(booking.brandPrimary) as CSSProperties;

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={theme}>
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          {booking.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={booking.logoUrl}
              alt={booking.organizationName}
              className="mb-4 h-12 w-auto max-w-[220px] object-contain"
            />
          ) : null}
          <p className="text-sm text-[var(--ink-secondary)]">
            Self-serve changes for your booking with{" "}
            <span className="font-medium text-[var(--ink)]">
              {booking.organizationName}
            </span>
            .
          </p>
        </header>

        <ManageAppointmentClient
          manageToken={parsed.data}
          initial={booking}
        />

        {booking.bookAgainHref ? (
          <p className="mt-6 text-center text-sm text-[var(--ink-tertiary)]">
            Need another appointment?{" "}
            <Link
              href={booking.bookAgainHref}
              className="font-medium text-[var(--accent)] hover:underline"
            >
              Book again
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
