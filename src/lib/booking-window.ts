import { format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import type { PublicSlot, PublicSlotDay } from "@/lib/booking-types";

/** Inclusive local days customers can book ahead on the public page. */
export const PUBLIC_BOOKING_HORIZON_DAYS = 28;

export function addUtcDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function publicBookingHorizon(timezone: string, now = new Date()) {
  const localNow = toZonedTime(now, timezone);
  const fromDate = format(localNow, "yyyy-MM-dd");
  const toDate = addUtcDaysToYmd(fromDate, PUBLIC_BOOKING_HORIZON_DAYS - 1);
  return { fromDate, toDate };
}

export function groupSlotsByLocalDay(
  slots: Array<{ start: Date }>,
  timezone: string,
): PublicSlotDay[] {
  const map = new Map<string, PublicSlotDay>();
  for (const slot of slots) {
    const date = formatInTimeZone(slot.start, timezone, "yyyy-MM-dd");
    let day = map.get(date);
    if (!day) {
      day = {
        date,
        label: formatInTimeZone(slot.start, timezone, "EEE d MMM"),
        slots: [],
      };
      map.set(date, day);
    }
    const publicSlot: PublicSlot = {
      startIso: slot.start.toISOString(),
      label: formatInTimeZone(slot.start, timezone, "HH:mm"),
    };
    day.slots.push(publicSlot);
  }
  return [...map.values()];
}
