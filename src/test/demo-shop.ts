/**
 * Deterministic presentation catalog for the isolated demo org.
 * Never used by E2E (`e2e-test-shop`) or live customer orgs (`bookflow`, `pgym`).
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { BookingSource, BookingStatus } from "../generated/prisma/client";
import { isoDayInZone, shiftIsoDay } from "../server/analytics/period";

import { TEST_ORG_SLUG } from "./constants";

export const DEMO_ORG_SLUG = "bookflow-demo";
export const DEMO_ORG_NAME = "Atelier Hale";
export const DEMO_LOCATION_NAME = "Shoreditch studio";
export const DEMO_TIMEZONE = "Europe/London";
export const DEMO_OWNER_EMAIL = "owner.atelier-hale@example.test";
export const DEMO_OWNER_CLERK_ID = "demo-seed-owner-atelier-hale";
export const DEMO_MANAGE_TOKEN_PREFIX = "demotoken";
export const DEMO_EMAIL_DOMAIN = "example.test";

export const DEMO_FORBIDDEN_SLUGS = [
  TEST_ORG_SLUG,
  "bookflow",
  "pgym",
] as const;

export type DemoServiceKey =
  "haircut" | "fade" | "beard" | "signature" | "combo";

export type DemoStaffKey = "jordan" | "maya";

export const DEMO_SERVICES: Array<{
  key: DemoServiceKey;
  name: string;
  durationMin: number;
  bufferAfter: number;
  priceCents: number;
  currency: "GBP";
}> = [
  {
    key: "haircut",
    name: "Precision cut",
    durationMin: 30,
    bufferAfter: 5,
    priceCents: 3800,
    currency: "GBP",
  },
  {
    key: "fade",
    name: "Skin fade",
    durationMin: 45,
    bufferAfter: 5,
    priceCents: 4200,
    currency: "GBP",
  },
  {
    key: "beard",
    name: "Beard sculpt",
    durationMin: 30,
    bufferAfter: 0,
    priceCents: 2400,
    currency: "GBP",
  },
  {
    key: "signature",
    name: "Signature cut & finish",
    durationMin: 45,
    bufferAfter: 5,
    priceCents: 5500,
    currency: "GBP",
  },
  {
    key: "combo",
    name: "Cut & beard",
    durationMin: 60,
    bufferAfter: 10,
    priceCents: 6200,
    currency: "GBP",
  },
];

/** weekday: 0 Sun … 6 Sat (matches availability engine). */
export const DEMO_STAFF: Array<{
  key: DemoStaffKey;
  name: string;
  weekdays: number[];
  startMin: number;
  endMin: number;
}> = [
  {
    key: "jordan",
    name: "Jordan Hale",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startMin: 9 * 60,
    endMin: 18 * 60,
  },
  {
    key: "maya",
    name: "Maya Chen",
    weekdays: [2, 3, 4, 5, 6],
    startMin: 10 * 60,
    endMin: 18 * 60,
  },
];

export const DEMO_CLIENTS: Array<{
  key: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  tags: string[];
  marketingOptIn: boolean;
  /** How many local days before "now" this client record was created. */
  createdDaysAgo: number;
}> = [
  {
    key: "james",
    name: "James Okonkwo",
    email: "james.okonkwo@example.test",
    phone: "+447700900101",
    notes: "Prefers a mid fade, no clipper on the crown.",
    tags: ["regular", "fade"],
    marketingOptIn: true,
    createdDaysAgo: 180,
  },
  {
    key: "sofia",
    name: "Sofia Khan",
    email: "sofia.khan@example.test",
    phone: "+447700900102",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 150,
  },
  {
    key: "lewis",
    name: "Lewis Grant",
    email: "lewis.grant@example.test",
    phone: "+447700900103",
    notes: "New client — first visit last week.",
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 6,
  },
  {
    key: "amira",
    name: "Amira Hassan",
    email: "amira.hassan@example.test",
    phone: null,
    notes: null,
    tags: ["colour"],
    marketingOptIn: true,
    createdDaysAgo: 40,
  },
  {
    key: "callum",
    name: "Callum Wright",
    email: "callum.wright@example.test",
    phone: "+447700900104",
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 18,
  },
  {
    key: "priya",
    name: "Priya Shah",
    email: "priya.shah@example.test",
    phone: "+447700900105",
    notes: "Usually books Jordan.",
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 90,
  },
  {
    key: "noah",
    name: "Noah Patel",
    email: "noah.patel@example.test",
    phone: null,
    notes: null,
    tags: [],
    marketingOptIn: false,
    createdDaysAgo: 11,
  },
  {
    key: "elena",
    name: "Elena Rossi",
    email: "elena.rossi@example.test",
    phone: "+447700900106",
    notes: null,
    tags: ["regular"],
    marketingOptIn: true,
    createdDaysAgo: 120,
  },
];

export type DemoBookingPlan = {
  token: string;
  clientKey: string;
  staffKey: DemoStaffKey;
  serviceKey: DemoServiceKey;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  source: BookingSource;
  cancelReason: string | null;
};

export function assertDemoSlugIsolated(slug: string) {
  if ((DEMO_FORBIDDEN_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Refusing to seed protected slug ${slug}`);
  }
  if (slug !== DEMO_ORG_SLUG) {
    throw new Error(`Demo seed only targets ${DEMO_ORG_SLUG}, got ${slug}`);
  }
}

export function weekdaySun0(isoDay: string, timeZone: string): number {
  const noon = fromZonedTime(`${isoDay}T12:00:00`, timeZone);
  const isoDow = Number(formatInTimeZone(noon, timeZone, "i"));
  return isoDow % 7;
}

export function zonedAt(
  isoDay: string,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${isoDay}T${hh}:${mm}:00`, timeZone);
}

export function serviceByKey(key: DemoServiceKey) {
  const service = DEMO_SERVICES.find((s) => s.key === key);
  if (!service) throw new Error(`Unknown demo service ${key}`);
  return service;
}

export function staffByKey(key: DemoStaffKey) {
  const staff = DEMO_STAFF.find((s) => s.key === key);
  if (!staff) throw new Error(`Unknown demo staff ${key}`);
  return staff;
}

function staffWorks(staffKey: DemoStaffKey, weekday: number) {
  return staffByKey(staffKey).weekdays.includes(weekday);
}

function endsAt(startAt: Date, serviceKey: DemoServiceKey) {
  return new Date(
    startAt.getTime() + serviceByKey(serviceKey).durationMin * 60_000,
  );
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Occupied window includes service buffer so chairs are not back-to-back. */
export function occupiedUntil(startAt: Date, serviceKey: DemoServiceKey) {
  const service = serviceByKey(serviceKey);
  return new Date(
    startAt.getTime() + (service.durationMin + service.bufferAfter) * 60_000,
  );
}

function withinStaffHours(
  staffKey: DemoStaffKey,
  hour: number,
  minute: number,
  serviceKey: DemoServiceKey,
) {
  const staff = staffByKey(staffKey);
  const startMin = hour * 60 + minute;
  const endMin = startMin + serviceByKey(serviceKey).durationMin;
  return startMin >= staff.startMin && endMin <= staff.endMin;
}

export function assertNoDemoOverlaps(plan: DemoBookingPlan[]) {
  const blocking = plan.filter(
    (b) =>
      b.status === "PENDING" ||
      b.status === "CONFIRMED" ||
      b.status === "COMPLETED" ||
      b.status === "NO_SHOW",
  );
  for (let i = 0; i < blocking.length; i++) {
    for (let j = i + 1; j < blocking.length; j++) {
      const a = blocking[i]!;
      const b = blocking[j]!;
      if (a.staffKey !== b.staffKey) continue;
      if (
        rangesOverlap(
          a.startAt,
          occupiedUntil(a.startAt, a.serviceKey),
          b.startAt,
          occupiedUntil(b.startAt, b.serviceKey),
        )
      ) {
        throw new Error(
          `Demo overlap on ${a.staffKey}: ${a.token} vs ${b.token}`,
        );
      }
    }
  }
}

function cancelReasonFor(status: BookingStatus): string | null {
  if (status === "CANCELLED") return "Client asked to move the appointment";
  if (status === "NO_SHOW") return "Did not arrive";
  return null;
}

type Rel = {
  day: number;
  hour: number;
  minute: number;
  staff: DemoStaffKey;
  service: DemoServiceKey;
  client: string;
  status: BookingStatus;
  source: BookingSource;
};

/**
 * Relative schedule around "today" in the shop timezone.
 * day 0 = today, negative = past, positive = upcoming.
 */
const RELATIVE_BOOKINGS: Rel[] = [
  {
    day: -42,
    hour: 10,
    minute: 0,
    staff: "jordan",
    service: "haircut",
    client: "james",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -40,
    hour: 11,
    minute: 30,
    staff: "maya",
    service: "signature",
    client: "sofia",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -38,
    hour: 14,
    minute: 0,
    staff: "jordan",
    service: "combo",
    client: "elena",
    status: "COMPLETED",
    source: "DASHBOARD",
  },
  {
    day: -35,
    hour: 10,
    minute: 30,
    staff: "jordan",
    service: "fade",
    client: "priya",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -33,
    hour: 15,
    minute: 0,
    staff: "maya",
    service: "beard",
    client: "amira",
    status: "NO_SHOW",
    source: "PUBLIC",
  },
  {
    day: -32,
    hour: 12,
    minute: 0,
    staff: "jordan",
    service: "signature",
    client: "james",
    status: "CANCELLED",
    source: "PUBLIC",
  },
  {
    day: -13,
    hour: 10,
    minute: 0,
    staff: "jordan",
    service: "haircut",
    client: "james",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -12,
    hour: 11,
    minute: 0,
    staff: "maya",
    service: "fade",
    client: "sofia",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -12,
    hour: 14,
    minute: 0,
    staff: "jordan",
    service: "combo",
    client: "elena",
    status: "COMPLETED",
    source: "DASHBOARD",
  },
  {
    day: -11,
    hour: 10,
    minute: 30,
    staff: "jordan",
    service: "signature",
    client: "priya",
    status: "NO_SHOW",
    source: "PUBLIC",
  },
  {
    day: -11,
    hour: 15,
    minute: 0,
    staff: "maya",
    service: "beard",
    client: "amira",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -10,
    hour: 10,
    minute: 0,
    staff: "jordan",
    service: "haircut",
    client: "james",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -9,
    hour: 11,
    minute: 30,
    staff: "maya",
    service: "beard",
    client: "sofia",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -8,
    hour: 14,
    minute: 0,
    staff: "jordan",
    service: "fade",
    client: "elena",
    status: "NO_SHOW",
    source: "PUBLIC",
  },
  {
    day: -7,
    hour: 10,
    minute: 0,
    staff: "jordan",
    service: "combo",
    client: "priya",
    status: "COMPLETED",
    source: "DASHBOARD",
  },
  {
    day: -7,
    hour: 12,
    minute: 0,
    staff: "maya",
    service: "signature",
    client: "amira",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -6,
    hour: 9,
    minute: 30,
    staff: "jordan",
    service: "haircut",
    client: "callum",
    status: "CANCELLED",
    source: "PUBLIC",
  },
  {
    day: -6,
    hour: 11,
    minute: 0,
    staff: "maya",
    service: "fade",
    client: "noah",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -5,
    hour: 10,
    minute: 0,
    staff: "jordan",
    service: "signature",
    client: "james",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -5,
    hour: 15,
    minute: 0,
    staff: "maya",
    service: "haircut",
    client: "lewis",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -4,
    hour: 13,
    minute: 0,
    staff: "jordan",
    service: "beard",
    client: "sofia",
    status: "NO_SHOW",
    source: "PUBLIC",
  },
  {
    day: -4,
    hour: 16,
    minute: 0,
    staff: "maya",
    service: "combo",
    client: "elena",
    status: "COMPLETED",
    source: "DASHBOARD",
  },
  {
    day: -3,
    hour: 10,
    minute: 30,
    staff: "jordan",
    service: "fade",
    client: "priya",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -3,
    hour: 12,
    minute: 0,
    staff: "maya",
    service: "beard",
    client: "amira",
    status: "CANCELLED",
    source: "PUBLIC",
  },
  {
    day: -2,
    hour: 11,
    minute: 0,
    staff: "jordan",
    service: "haircut",
    client: "james",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -2,
    hour: 14,
    minute: 30,
    staff: "maya",
    service: "signature",
    client: "sofia",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -1,
    hour: 9,
    minute: 30,
    staff: "jordan",
    service: "combo",
    client: "elena",
    status: "COMPLETED",
    source: "DASHBOARD",
  },
  {
    day: -1,
    hour: 11,
    minute: 30,
    staff: "maya",
    service: "fade",
    client: "noah",
    status: "COMPLETED",
    source: "PUBLIC",
  },
  {
    day: -1,
    hour: 15,
    minute: 0,
    staff: "jordan",
    service: "beard",
    client: "callum",
    status: "CANCELLED",
    source: "PUBLIC",
  },
  {
    day: 1,
    hour: 10,
    minute: 0,
    staff: "jordan",
    service: "signature",
    client: "james",
    status: "CONFIRMED",
    source: "PUBLIC",
  },
  {
    day: 1,
    hour: 11,
    minute: 30,
    staff: "maya",
    service: "haircut",
    client: "amira",
    status: "CONFIRMED",
    source: "PUBLIC",
  },
  {
    day: 2,
    hour: 13,
    minute: 0,
    staff: "jordan",
    service: "fade",
    client: "priya",
    status: "CONFIRMED",
    source: "PUBLIC",
  },
  {
    day: 2,
    hour: 15,
    minute: 0,
    staff: "maya",
    service: "beard",
    client: "sofia",
    status: "CONFIRMED",
    source: "DASHBOARD",
  },
  {
    day: 3,
    hour: 10,
    minute: 30,
    staff: "jordan",
    service: "combo",
    client: "elena",
    status: "CONFIRMED",
    source: "PUBLIC",
  },
  {
    day: 3,
    hour: 15,
    minute: 30,
    staff: "maya",
    service: "beard",
    client: "callum",
    status: "PENDING",
    source: "PUBLIC",
  },
  {
    day: 4,
    hour: 12,
    minute: 0,
    staff: "maya",
    service: "signature",
    client: "lewis",
    status: "CONFIRMED",
    source: "PUBLIC",
  },
  {
    day: 5,
    hour: 16,
    minute: 0,
    staff: "jordan",
    service: "haircut",
    client: "noah",
    status: "CONFIRMED",
    source: "PUBLIC",
  },
];

function roundDown15(minOfDay: number) {
  return Math.floor(minOfDay / 15) * 15;
}

function todayFloorRows(today: string, now: Date, timeZone: string): Rel[] {
  const weekday = weekdaySun0(today, timeZone);
  const jordanOpen = staffWorks("jordan", weekday);
  const mayaOpen = staffWorks("maya", weekday);
  if (!jordanOpen && !mayaOpen) return [];

  const localHour = Number(formatInTimeZone(now, timeZone, "H"));
  const localMinute = Number(formatInTimeZone(now, timeZone, "m"));
  const nowMin = localHour * 60 + localMinute;
  const rows: Rel[] = [];

  if (jordanOpen) {
    const morningStart = 9 * 60 + 30;
    const morningEnd = morningStart + serviceByKey("haircut").durationMin;
    rows.push({
      day: 0,
      hour: 9,
      minute: 30,
      staff: "jordan",
      service: "haircut",
      client: "james",
      status: nowMin >= morningEnd ? "COMPLETED" : "CONFIRMED",
      source: "PUBLIC",
    });
  }

  if (mayaOpen) {
    const morningStart = 10 * 60 + 30;
    const morningEnd = morningStart + serviceByKey("beard").durationMin;
    rows.push({
      day: 0,
      hour: 10,
      minute: 30,
      staff: "maya",
      service: "beard",
      client: "sofia",
      status: nowMin >= morningEnd ? "COMPLETED" : "CONFIRMED",
      source: "PUBLIC",
    });
  }

  if (jordanOpen && nowMin >= 11 * 60 && nowMin < 17 * 60) {
    const startMin = Math.max(11 * 60, roundDown15(nowMin - 20));
    const service: DemoServiceKey = "signature";
    const duration = serviceByKey(service).durationMin;
    if (startMin + duration <= 18 * 60) {
      rows.push({
        day: 0,
        hour: Math.floor(startMin / 60),
        minute: startMin % 60,
        staff: "jordan",
        service,
        client: "priya",
        status: "CONFIRMED",
        source: "DASHBOARD",
      });
      const later =
        startMin + duration + serviceByKey(service).bufferAfter + 25;
      if (later + serviceByKey("fade").durationMin <= 18 * 60) {
        rows.push({
          day: 0,
          hour: Math.floor(later / 60),
          minute: later % 60,
          staff: "jordan",
          service: "fade",
          client: "lewis",
          status: "CONFIRMED",
          source: "PUBLIC",
        });
      }
    }
  } else if (jordanOpen && nowMin < 10 * 60) {
    rows.push(
      {
        day: 0,
        hour: 11,
        minute: 0,
        staff: "jordan",
        service: "signature",
        client: "priya",
        status: "CONFIRMED",
        source: "DASHBOARD",
      },
      {
        day: 0,
        hour: 14,
        minute: 0,
        staff: "jordan",
        service: "fade",
        client: "lewis",
        status: "CONFIRMED",
        source: "PUBLIC",
      },
    );
  } else if (jordanOpen && nowMin >= 17 * 60 && nowMin < 18 * 60) {
    rows.push({
      day: 0,
      hour: 17,
      minute: 0,
      staff: "jordan",
      service: "beard",
      client: "lewis",
      status: "CONFIRMED",
      source: "PUBLIC",
    });
  }

  if (mayaOpen && nowMin < 16 * 60 + 30) {
    const hour = nowMin < 14 * 60 ? 14 : 16;
    rows.push({
      day: 0,
      hour,
      minute: 30,
      staff: "maya",
      service: "combo",
      client: "amira",
      status: "CONFIRMED",
      source: "PUBLIC",
    });
  }

  return rows;
}

export function planDemoBookings(
  now = new Date(),
  timeZone = DEMO_TIMEZONE,
): DemoBookingPlan[] {
  const today = isoDayInZone(now, timeZone);
  const rel = [...RELATIVE_BOOKINGS, ...todayFloorRows(today, now, timeZone)];
  const plan: DemoBookingPlan[] = [];
  let tokenIndex = 1;

  for (const row of rel) {
    const isoDay = shiftIsoDay(today, row.day);
    const weekday = weekdaySun0(isoDay, timeZone);
    if (!staffWorks(row.staff, weekday)) continue;
    if (!withinStaffHours(row.staff, row.hour, row.minute, row.service)) {
      continue;
    }
    const startAt = zonedAt(isoDay, row.hour, row.minute, timeZone);
    plan.push({
      token: `${DEMO_MANAGE_TOKEN_PREFIX}${String(tokenIndex).padStart(2, "0")}`,
      clientKey: row.client,
      staffKey: row.staff,
      serviceKey: row.service,
      startAt,
      endAt: endsAt(startAt, row.service),
      status: row.status,
      source: row.source,
      cancelReason: cancelReasonFor(row.status),
    });
    tokenIndex += 1;
  }

  assertNoDemoOverlaps(plan);
  return plan;
}

export function demoClientCreatedAt(
  clientKey: string,
  now: Date,
  timeZone = DEMO_TIMEZONE,
) {
  const client = DEMO_CLIENTS.find((c) => c.key === clientKey);
  if (!client) throw new Error(`Unknown demo client ${clientKey}`);
  const today = isoDayInZone(now, timeZone);
  return zonedAt(shiftIsoDay(today, -client.createdDaysAgo), 10, 0, timeZone);
}
