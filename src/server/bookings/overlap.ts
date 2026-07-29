/** Maps advisory / exclusion / app overlap failures to a slot-taken outcome. */
export function isBookingOverlapError(e: unknown): boolean {
  if (e instanceof Error && e.message === "SLOT_TAKEN") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("bookings_resource_no_overlap") ||
    msg.includes("23P01") ||
    /exclusion/i.test(msg)
  );
}
