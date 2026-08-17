/** Split today's open bookings into the one happening now vs still upcoming. */

export type TimedBooking = {
  startAt: Date;
  endAt: Date;
};

/**
 * Current = in the appointment window, or the latest open booking that already
 * started (staff often complete a few minutes after endAt).
 * Upcoming = open bookings that have not started yet, in start order.
 */
export function splitFloorBookings<T extends TimedBooking>(
  open: T[],
  now: Date,
): { current: T | null; upcoming: T[] } {
  const started = open
    .filter((b) => b.startAt.getTime() <= now.getTime())
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  const inWindow = started.find((b) => b.endAt.getTime() > now.getTime());
  const current = inWindow ?? started[0] ?? null;
  const upcoming = open
    .filter((b) => b.startAt.getTime() > now.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return { current, upcoming };
}
