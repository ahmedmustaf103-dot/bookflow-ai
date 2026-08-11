/**
 * Analytics period helpers — pure, timezone-aware calendar math.
 *
 * Period rule: the last `days` calendar days in `timeZone`, inclusive of today,
 * as half-open Instant range [start, end) where end is start-of-tomorrow in TZ.
 */

import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export function shiftIsoDay(isoDay: string, deltaDays: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid ISO day: ${isoDay}`);
  }
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function zonedDayStart(isoDay: string, timeZone: string): Date {
  return fromZonedTime(`${isoDay}T00:00:00.000`, timeZone);
}

export function isoDayInZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export type AnalyticsPeriod = {
  /** Inclusive local calendar day (yyyy-MM-dd) */
  startDay: string;
  /** Exclusive local calendar day (yyyy-MM-dd) — start of tomorrow when period includes today */
  endDayExclusive: string;
  /** Inclusive Instant bound */
  start: Date;
  /** Exclusive Instant bound */
  end: Date;
  /** Each local day in the period, startDay → yesterday-of-end */
  days: string[];
  timeZone: string;
};

/**
 * Last `dayCount` calendar days in `timeZone` ending today (inclusive).
 * Example dayCount=30 → today and the previous 29 local days.
 */
export function resolveAnalyticsPeriod(
  dayCount: number,
  timeZone: string,
  now = new Date(),
): AnalyticsPeriod {
  if (dayCount < 1) {
    throw new Error("dayCount must be >= 1");
  }
  const today = isoDayInZone(now, timeZone);
  const startDay = shiftIsoDay(today, -(dayCount - 1));
  const endDayExclusive = shiftIsoDay(today, 1);
  const days: string[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    days.push(shiftIsoDay(startDay, i));
  }
  return {
    startDay,
    endDayExclusive,
    start: zonedDayStart(startDay, timeZone),
    end: zonedDayStart(endDayExclusive, timeZone),
    days,
    timeZone,
  };
}

/** The immediately preceding window of the same length. */
export function previousAnalyticsPeriod(current: AnalyticsPeriod): AnalyticsPeriod {
  const dayCount = current.days.length;
  const endDayExclusive = current.startDay;
  const startDay = shiftIsoDay(endDayExclusive, -dayCount);
  const days: string[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    days.push(shiftIsoDay(startDay, i));
  }
  return {
    startDay,
    endDayExclusive,
    start: zonedDayStart(startDay, current.timeZone),
    end: zonedDayStart(endDayExclusive, current.timeZone),
    days,
    timeZone: current.timeZone,
  };
}

/** Local calendar month containing `now` in `timeZone`: [monthStart, monthEndExclusive). */
export function resolveMonthPeriod(timeZone: string, now = new Date()) {
  const today = isoDayInZone(now, timeZone);
  const [y, m] = today.split("-").map(Number);
  const startDay = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDayExclusive =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return {
    startDay,
    endDayExclusive,
    start: zonedDayStart(startDay, timeZone),
    end: zonedDayStart(endDayExclusive, timeZone),
    timeZone,
  };
}

/** Today in `timeZone`: [startOfToday, startOfTomorrow). */
export function resolveTodayPeriod(timeZone: string, now = new Date()) {
  return resolveAnalyticsPeriod(1, timeZone, now);
}

/**
 * No-show rate among appointments that reached a terminal attendance outcome.
 * Eligible = COMPLETED + NO_SHOW (cancelled / upcoming excluded).
 */
export function computeNoShowRate(completed: number, noShow: number): number {
  const eligible = completed + noShow;
  if (eligible <= 0) return 0;
  return noShow / eligible;
}
