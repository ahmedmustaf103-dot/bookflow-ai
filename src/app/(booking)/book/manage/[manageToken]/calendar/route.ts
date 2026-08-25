import { NextResponse } from "next/server";

import { buildConfirmationIcs } from "@/lib/ics";
import { manageTokenSchema } from "@/server/actions/schemas";
import { findBookingByManageTokenForIcs } from "@/server/bookings/manage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ manageToken: string }> },
) {
  const { manageToken: raw } = await context.params;
  const parsed = manageTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const booking = await findBookingByManageTokenForIcs(parsed.data);
  if (!booking) {
    return new NextResponse("Not found", { status: 404 });
  }

  const cancelled = booking.status === "CANCELLED";
  const ics = buildConfirmationIcs({
    bookingId: booking.id,
    organizationName: booking.organizationName,
    serviceName: booking.serviceName,
    resourceName: booking.resourceName,
    startAt: booking.startAt,
    endAt: booking.endAt,
    location: booking.locationName,
    manageUrl: booking.manageUrl,
    sequence: booking.sequence,
    method: cancelled ? "CANCEL" : "REQUEST",
  });

  const method = cancelled ? "CANCEL" : "REQUEST";
  const filename = cancelled
    ? "appointment-cancelled.ics"
    : "appointment.ics";

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": `text/calendar; charset=utf-8; method=${method}`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
