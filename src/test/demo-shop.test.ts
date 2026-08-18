import { describe, expect, it } from "vitest";

import { isoDayInZone, shiftIsoDay } from "@/server/analytics/period";
import { TEST_ORG_SLUG } from "@/test/constants";
import {
  assertDemoSlugIsolated,
  assertNoDemoOverlaps,
  DEMO_CLIENTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_FORBIDDEN_SLUGS,
  DEMO_ORG_SLUG,
  DEMO_STAFF,
  DEMO_TIMEZONE,
  occupiedUntil,
  planDemoBookings,
  weekdaySun0,
} from "@/test/demo-shop";

const WEDNESDAY_NOON_UTC = new Date("2026-08-12T12:00:00.000Z");

describe("demo shop planner", () => {
  it("never targets E2E or live customer slugs", () => {
    expect(DEMO_ORG_SLUG).toBe("bookflow-demo");
    expect(DEMO_FORBIDDEN_SLUGS).toContain(TEST_ORG_SLUG);
    expect(DEMO_FORBIDDEN_SLUGS).toContain("bookflow");
    expect(DEMO_FORBIDDEN_SLUGS).toContain("pgym");
    expect(assertDemoSlugIsolated(DEMO_ORG_SLUG)).toBeUndefined();
    expect(() => assertDemoSlugIsolated(TEST_ORG_SLUG)).toThrow(
      /protected slug/,
    );
    expect(() => assertDemoSlugIsolated("bookflow")).toThrow(/protected slug/);
  });

  it("uses clearly fictional contacts", () => {
    expect(DEMO_CLIENTS.length).toBeGreaterThanOrEqual(6);
    for (const client of DEMO_CLIENTS) {
      expect(client.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true);
      expect(client.name).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
      if (client.phone) {
        expect(client.phone.startsWith("+4477009")).toBe(true);
      }
    }
    expect(DEMO_CLIENTS.some((c) => c.marketingOptIn)).toBe(true);
    expect(DEMO_CLIENTS.some((c) => !c.marketingOptIn)).toBe(true);
    expect(DEMO_CLIENTS.some((c) => c.createdDaysAgo > 30)).toBe(true);
    expect(DEMO_CLIENTS.some((c) => c.createdDaysAgo <= 30)).toBe(true);
  });

  it("is deterministic for a frozen clock", () => {
    const a = planDemoBookings(WEDNESDAY_NOON_UTC);
    const b = planDemoBookings(WEDNESDAY_NOON_UTC);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("spreads statuses, staff, and services without overlaps", () => {
    const plan = planDemoBookings(WEDNESDAY_NOON_UTC);
    expect(() => assertNoDemoOverlaps(plan)).not.toThrow();

    const statuses = new Set(plan.map((b) => b.status));
    expect(statuses.has("COMPLETED")).toBe(true);
    expect(statuses.has("CONFIRMED")).toBe(true);
    expect(statuses.has("CANCELLED")).toBe(true);
    expect(statuses.has("NO_SHOW")).toBe(true);
    expect(statuses.has("PENDING")).toBe(true);

    expect(new Set(plan.map((b) => b.staffKey)).size).toBe(2);
    expect(new Set(plan.map((b) => b.serviceKey)).size).toBeGreaterThanOrEqual(
      4,
    );
    expect(new Set(plan.map((b) => b.clientKey)).size).toBeGreaterThanOrEqual(
      6,
    );

    const completed = plan.filter((b) => b.status === "COMPLETED");
    expect(completed.length).toBeGreaterThanOrEqual(8);
    expect(
      plan.filter((b) => b.status === "CANCELLED").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      plan.filter((b) => b.status === "NO_SHOW").length,
    ).toBeGreaterThanOrEqual(2);

    const returning = plan.filter((b) => b.clientKey === "james");
    expect(returning.length).toBeGreaterThanOrEqual(2);
  });

  it("places a current booking and later upcoming work on a weekday afternoon", () => {
    const plan = planDemoBookings(WEDNESDAY_NOON_UTC);
    const today = isoDayInZone(WEDNESDAY_NOON_UTC, DEMO_TIMEZONE);
    const todaysOpen = plan.filter(
      (b) =>
        isoDayInZone(b.startAt, DEMO_TIMEZONE) === today &&
        (b.status === "CONFIRMED" || b.status === "PENDING"),
    );
    const current = todaysOpen.find(
      (b) =>
        b.startAt.getTime() <= WEDNESDAY_NOON_UTC.getTime() &&
        b.endAt.getTime() > WEDNESDAY_NOON_UTC.getTime(),
    );
    expect(current).toBeTruthy();
    expect(
      todaysOpen.some(
        (b) => b.startAt.getTime() > WEDNESDAY_NOON_UTC.getTime(),
      ),
    ).toBe(true);
    expect(
      plan.some(
        (b) =>
          b.status === "COMPLETED" &&
          isoDayInZone(b.startAt, DEMO_TIMEZONE) === today,
      ),
    ).toBe(true);
  });

  it("skips staff on closed weekdays", () => {
    const monday = new Date("2026-08-17T12:00:00.000Z");
    const plan = planDemoBookings(monday);
    const today = isoDayInZone(monday, DEMO_TIMEZONE);
    expect(weekdaySun0(today, DEMO_TIMEZONE)).toBe(1);
    expect(
      plan.some(
        (b) =>
          b.staffKey === "maya" &&
          isoDayInZone(b.startAt, DEMO_TIMEZONE) === today,
      ),
    ).toBe(false);
    expect(DEMO_STAFF.find((s) => s.key === "maya")?.weekdays.includes(1)).toBe(
      false,
    );
  });

  it("keeps occupied buffers from colliding on the same chair", () => {
    const plan = planDemoBookings(WEDNESDAY_NOON_UTC);
    const byStaff = new Map<string, typeof plan>();
    for (const row of plan) {
      const list = byStaff.get(row.staffKey) ?? [];
      list.push(row);
      byStaff.set(row.staffKey, list);
    }
    for (const rows of byStaff.values()) {
      const blocking = rows.filter((b) => b.status !== "CANCELLED");
      for (let i = 0; i < blocking.length; i++) {
        for (let j = i + 1; j < blocking.length; j++) {
          const a = blocking[i]!;
          const b = blocking[j]!;
          const aEnd = occupiedUntil(a.startAt, a.serviceKey).getTime();
          const bEnd = occupiedUntil(b.startAt, b.serviceKey).getTime();
          const overlap =
            a.startAt.getTime() < bEnd && b.startAt.getTime() < aEnd;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it("keeps future work inside the next week and history in the past", () => {
    const plan = planDemoBookings(WEDNESDAY_NOON_UTC);
    const today = isoDayInZone(WEDNESDAY_NOON_UTC, DEMO_TIMEZONE);
    const nextWeek = shiftIsoDay(today, 8);
    expect(
      plan.some((b) => b.startAt.getTime() < WEDNESDAY_NOON_UTC.getTime()),
    ).toBe(true);
    expect(
      plan.some(
        (b) =>
          (b.status === "CONFIRMED" || b.status === "PENDING") &&
          isoDayInZone(b.startAt, DEMO_TIMEZONE) > today &&
          isoDayInZone(b.startAt, DEMO_TIMEZONE) < nextWeek,
      ),
    ).toBe(true);
  });
});
