import { describe, expect, it } from "vitest";

import { ANALYTICS_METRIC_DEFINITIONS } from "@/server/analytics/definitions";
import {
  computeNoShowRate,
  isoDayInZone,
  previousAnalyticsPeriod,
  resolveAnalyticsPeriod,
  resolveMonthPeriod,
  resolveTodayPeriod,
  shiftIsoDay,
  zonedDayStart,
} from "@/server/analytics/period";

describe("analytics period math", () => {
  it("shifts ISO calendar days across month boundaries", () => {
    expect(shiftIsoDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftIsoDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds a half-open last-N-days window in Europe/London", () => {
    // 2026-08-10 22:30 UTC = 2026-08-10 23:30 in London (BST)
    const now = new Date("2026-08-10T22:30:00.000Z");
    const period = resolveAnalyticsPeriod(7, "Europe/London", now);

    expect(period.startDay).toBe("2026-08-04");
    expect(period.endDayExclusive).toBe("2026-08-11");
    expect(period.days).toHaveLength(7);
    expect(period.days[0]).toBe("2026-08-04");
    expect(period.days.at(-1)).toBe("2026-08-10");

    // Bounds are London midnights as Instants
    expect(period.start.toISOString()).toBe(
      zonedDayStart("2026-08-04", "Europe/London").toISOString(),
    );
    expect(period.end.toISOString()).toBe(
      zonedDayStart("2026-08-11", "Europe/London").toISOString(),
    );
  });

  it("keeps previous period adjacent and same length", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const current = resolveAnalyticsPeriod(30, "UTC", now);
    const previous = previousAnalyticsPeriod(current);

    expect(previous.days).toHaveLength(30);
    expect(previous.endDayExclusive).toBe(current.startDay);
    expect(previous.end.toISOString()).toBe(current.start.toISOString());
  });

  it("handles DST spring-forward day without dropping the calendar day", () => {
    // UK BST started 2026-03-29. Window including that day should still list it.
    const now = new Date("2026-03-30T12:00:00.000Z");
    const period = resolveAnalyticsPeriod(3, "Europe/London", now);
    expect(period.days).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
    expect(period.start < period.end).toBe(true);
  });

  it("places late-evening UTC into the next US calendar day", () => {
    const now = new Date("2026-08-11T02:30:00.000Z"); // still Aug 10 in LA
    expect(isoDayInZone(now, "America/Los_Angeles")).toBe("2026-08-10");
    const today = resolveTodayPeriod("America/Los_Angeles", now);
    expect(today.startDay).toBe("2026-08-10");
    expect(today.endDayExclusive).toBe("2026-08-11");
  });

  it("resolves calendar month bounds in org timezone", () => {
    const now = new Date("2026-08-10T15:00:00.000Z");
    const month = resolveMonthPeriod("Europe/London", now);
    expect(month.startDay).toBe("2026-08-01");
    expect(month.endDayExclusive).toBe("2026-09-01");
  });

  it("treats appointment created earlier for tomorrow as outside today's period", () => {
    const now = new Date("2026-08-10T15:00:00.000Z");
    const today = resolveTodayPeriod("UTC", now);
    const tomorrowStart = zonedDayStart("2026-08-11", "UTC");
    // startAt tomorrow is not < end of today
    expect(tomorrowStart >= today.end).toBe(true);
    expect(tomorrowStart < today.start).toBe(false);
  });

  it("includes appointment created yesterday for today in today's period", () => {
    const now = new Date("2026-08-10T15:00:00.000Z");
    const today = resolveTodayPeriod("UTC", now);
    const startAt = new Date("2026-08-10T10:00:00.000Z");
    expect(startAt >= today.start && startAt < today.end).toBe(true);
  });
});

describe("no-show rate", () => {
  it("matches completed+no-show denominator", () => {
    expect(computeNoShowRate(8, 2)).toBeCloseTo(0.2);
    expect(computeNoShowRate(0, 0)).toBe(0);
    expect(computeNoShowRate(0, 3)).toBe(1);
  });
});

describe("metric definitions", () => {
  it("documents startAt-based booking and completed-only revenue", () => {
    expect(ANALYTICS_METRIC_DEFINITIONS.booking).toMatch(/startAt/);
    expect(ANALYTICS_METRIC_DEFINITIONS.revenue).toMatch(/COMPLETED/);
    expect(ANALYTICS_METRIC_DEFINITIONS.noShowRate).toMatch(/NO_SHOW/);
    expect(ANALYTICS_METRIC_DEFINITIONS.period).toMatch(/timezone/);
  });
});
