import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { PublicSlot, PublicSlotDay } from "@/lib/booking-types";

/** Inclusive local days customers can book ahead on the public page. */
export const PUBLIC_BOOKING_HORIZON_DAYS = 28;

export function addUtcDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function eachYmd(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    out.push(cursor);
    cursor = addUtcDaysToYmd(cursor, 1);
    if (out.length > 366) break;
  }
  return out;
}

export function publicBookingHorizon(timezone: string, now = new Date()) {
  const fromDate = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const toDate = addUtcDaysToYmd(fromDate, PUBLIC_BOOKING_HORIZON_DAYS - 1);
  return { fromDate, toDate };
}

function labelForDate(date: string, timezone: string, sample?: Date) {
  if (sample) return formatInTimeZone(sample, timezone, "EEE d MMM");
  const noon = fromZonedTime(`${date}T12:00:00.000`, timezone);
  return formatInTimeZone(noon, timezone, "EEE d MMM");
}

export function firstBookableDate(days: PublicSlotDay[]): string {
  return days.find((d) => d.slots.length > 0)?.date ?? days[0]?.date ?? "";
}

export function groupSlotsByLocalDay(
  slots: Array<{ start: Date }>,
  timezone: string,
  range?: { fromDate: string; toDate: string },
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

  if (!range) return [...map.values()];

  return eachYmd(range.fromDate, range.toDate).map((date) => {
    const existing = map.get(date);
    if (existing) return existing;
    return {
      date,
      label: labelForDate(date, timezone),
      slots: [],
    };
  });
}
