import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  previousAnalyticsPeriod,
  resolveAnalyticsPeriod,
  resolveMonthPeriod,
  resolveTodayPeriod,
  computeNoShowRate,
  type AnalyticsPeriod,
} from "@/server/analytics/period";
import { splitFloorBookings } from "@/server/analytics/floor";

export type OrgAnalytics = {
  bookingsTotal: number;
  bookingsCompleted: number;
  bookingsNoShow: number;
  bookingsCancelled: number;
  noShowRate: number;
  /** COMPLETED list-price revenue for startAt in period */
  estimatedRevenueCents: number;
  uniqueClients: number;
  upcoming: number;
  currency: string;
  timeZone: string;
  /** Prior window of same length for simple compare */
  previous: {
    bookingsTotal: number;
    estimatedRevenueCents: number;
    noShowRate: number;
  };
};

export type AnalyticsDayPoint = {
  date: string; // yyyy-MM-dd in org timezone
  bookings: number;
  revenueCents: number;
};

export type TopServiceRow = {
  name: string;
  count: number;
  revenueCents: number;
};

export type StaffInsightRow = {
  resourceId: string;
  name: string;
  bookings: number;
  completed: number;
  noShows: number;
};

export type CustomerInsights = {
  newClients: number;
  returningClients: number;
  clientsWithUpcoming: number;
  repeatBookers: number;
};

async function getOrgTimezone(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { timezoneDefault: true },
  });
  return org?.timezoneDefault || "UTC";
}

async function resolveCurrency(organizationId: string) {
  const service = await db.service.findFirst({
    where: { organizationId, isActive: true },
    select: { currency: true },
    orderBy: { createdAt: "asc" },
  });
  return service?.currency || "GBP";
}

async function statusCounts(
  organizationId: string,
  period: AnalyticsPeriod,
) {
  const grouped = await db.booking.groupBy({
    by: ["status"],
    where: {
      organizationId,
      startAt: {
        gte: period.start,
        lt: period.end,
      },
    },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  const completed = counts.COMPLETED ?? 0;
  const noShow = counts.NO_SHOW ?? 0;
  const cancelled = counts.CANCELLED ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    completed,
    noShow,
    cancelled,
    total,
    noShowRate: computeNoShowRate(completed, noShow),
  };
}

/** COMPLETED appointments only — list price, not payments collected. */
async function completedRevenueCents(
  organizationId: string,
  period: AnalyticsPeriod,
) {
  const rows = await db.$queryRaw<Array<{ cents: number }>>(Prisma.sql`
    SELECT COALESCE(SUM(s."priceCents"), 0)::int AS cents
    FROM bookings b
    INNER JOIN services s ON s.id = b."serviceId"
    WHERE b."organizationId" = ${organizationId}
      AND b.status = 'COMPLETED'
      AND b."startAt" >= ${period.start}
      AND b."startAt" < ${period.end}
  `);
  return rows[0]?.cents ?? 0;
}

export async function getOrgAnalytics(
  organizationId: string,
  days = 30,
  now = new Date(),
): Promise<OrgAnalytics> {
  const timeZone = await getOrgTimezone(organizationId);
  const period = resolveAnalyticsPeriod(days, timeZone, now);
  const previous = previousAnalyticsPeriod(period);

  const [
    current,
    prior,
    uniqueClients,
    upcoming,
    estimatedRevenueCents,
    previousRevenue,
    currency,
  ] = await Promise.all([
    statusCounts(organizationId, period),
    statusCounts(organizationId, previous),
    db.client.count({ where: { organizationId } }),
    db.booking.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { gte: now },
      },
    }),
    completedRevenueCents(organizationId, period),
    completedRevenueCents(organizationId, previous),
    resolveCurrency(organizationId),
  ]);

  return {
    bookingsTotal: current.total,
    bookingsCompleted: current.completed,
    bookingsNoShow: current.noShow,
    bookingsCancelled: current.cancelled,
    noShowRate: current.noShowRate,
    estimatedRevenueCents,
    uniqueClients,
    upcoming,
    currency,
    timeZone,
    previous: {
      bookingsTotal: prior.total,
      estimatedRevenueCents: previousRevenue,
      noShowRate: prior.noShowRate,
    },
  };
}

export async function getBookingSeries(
  organizationId: string,
  days = 30,
  now = new Date(),
): Promise<AnalyticsDayPoint[]> {
  const timeZone = await getOrgTimezone(organizationId);
  const period = resolveAnalyticsPeriod(days, timeZone, now);

  const rows = await db.$queryRaw<
    Array<{ day: string; bookings: number; revenue: number }>
  >(Prisma.sql`
    SELECT
      to_char(
        (b."startAt" AT TIME ZONE ${timeZone}),
        'YYYY-MM-DD'
      ) AS day,
      COUNT(*) FILTER (WHERE b.status <> 'CANCELLED')::int AS bookings,
      COALESCE(SUM(
        CASE
          WHEN b.status = 'COMPLETED' THEN s."priceCents"
          ELSE 0
        END
      ), 0)::int AS revenue
    FROM bookings b
    INNER JOIN services s ON s.id = b."serviceId"
    WHERE b."organizationId" = ${organizationId}
      AND b."startAt" >= ${period.start}
      AND b."startAt" < ${period.end}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const byDay = new Map<string, AnalyticsDayPoint>();
  for (const row of rows) {
    byDay.set(row.day, {
      date: row.day,
      bookings: row.bookings,
      revenueCents: row.revenue,
    });
  }

  return period.days.map(
    (date) => byDay.get(date) ?? { date, bookings: 0, revenueCents: 0 },
  );
}

export async function getTopServices(
  organizationId: string,
  days = 30,
  limit = 5,
  now = new Date(),
): Promise<TopServiceRow[]> {
  const timeZone = await getOrgTimezone(organizationId);
  const period = resolveAnalyticsPeriod(days, timeZone, now);
  return db.$queryRaw<TopServiceRow[]>(Prisma.sql`
    SELECT
      s.name AS name,
      COUNT(*) FILTER (WHERE b.status <> 'CANCELLED')::int AS count,
      COALESCE(SUM(
        CASE
          WHEN b.status = 'COMPLETED' THEN s."priceCents"
          ELSE 0
        END
      ), 0)::int AS "revenueCents"
    FROM bookings b
    INNER JOIN services s ON s.id = b."serviceId"
    WHERE b."organizationId" = ${organizationId}
      AND b."startAt" >= ${period.start}
      AND b."startAt" < ${period.end}
    GROUP BY s.name
    HAVING COUNT(*) FILTER (WHERE b.status <> 'CANCELLED') > 0
    ORDER BY count DESC
    LIMIT ${limit}
  `);
}

export async function getStaffInsights(
  organizationId: string,
  days = 30,
  limit = 6,
  now = new Date(),
): Promise<StaffInsightRow[]> {
  const timeZone = await getOrgTimezone(organizationId);
  const period = resolveAnalyticsPeriod(days, timeZone, now);
  return db.$queryRaw<StaffInsightRow[]>(Prisma.sql`
    SELECT
      r.id AS "resourceId",
      r.name AS name,
      COUNT(*) FILTER (WHERE b.status <> 'CANCELLED')::int AS bookings,
      COUNT(*) FILTER (WHERE b.status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE b.status = 'NO_SHOW')::int AS "noShows"
    FROM bookings b
    INNER JOIN resources r ON r.id = b."resourceId"
    WHERE b."organizationId" = ${organizationId}
      AND b."startAt" >= ${period.start}
      AND b."startAt" < ${period.end}
    GROUP BY r.id, r.name
    HAVING COUNT(*) FILTER (WHERE b.status <> 'CANCELLED') > 0
    ORDER BY bookings DESC
    LIMIT ${limit}
  `);
}

export async function getCustomerInsights(
  organizationId: string,
  days = 30,
  now = new Date(),
): Promise<CustomerInsights> {
  const timeZone = await getOrgTimezone(organizationId);
  const period = resolveAnalyticsPeriod(days, timeZone, now);

  const [newClients, returningRows, clientsWithUpcoming, repeatRows] =
    await Promise.all([
      db.client.count({
        where: {
          organizationId,
          createdAt: { gte: period.start, lt: period.end },
        },
      }),
      db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT b."clientId"
          FROM bookings b
          WHERE b."organizationId" = ${organizationId}
            AND b."startAt" >= ${period.start}
            AND b."startAt" < ${period.end}
            AND b.status <> 'CANCELLED'
          GROUP BY b."clientId"
          HAVING COUNT(*) >= 2
        ) t
      `),
      db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(DISTINCT b."clientId")::int AS count
        FROM bookings b
        WHERE b."organizationId" = ${organizationId}
          AND b.status IN ('PENDING', 'CONFIRMED')
          AND b."startAt" >= ${now}
      `),
      db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT b."clientId"
          FROM bookings b
          WHERE b."organizationId" = ${organizationId}
            AND b.status = 'COMPLETED'
          GROUP BY b."clientId"
          HAVING COUNT(*) >= 2
        ) t
      `),
    ]);

  return {
    newClients,
    returningClients: returningRows[0]?.count ?? 0,
    clientsWithUpcoming: clientsWithUpcoming[0]?.count ?? 0,
    repeatBookers: repeatRows[0]?.count ?? 0,
  };
}

const floorInclude = {
  client: { select: { name: true } },
  service: { select: { name: true } },
  resource: { select: { name: true } },
  location: { select: { timezone: true } },
} as const;

export async function getTodayAgenda(
  organizationId: string,
  take = 5,
  now = new Date(),
) {
  const timeZone = await getOrgTimezone(organizationId);
  const today = resolveTodayPeriod(timeZone, now);

  return db.booking.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: today.start, lt: today.end },
    },
    orderBy: { startAt: "asc" },
    take,
    include: floorInclude,
  });
}

export async function getDashboardFloor(
  organizationId: string,
  now = new Date(),
  resourceIds?: string[],
) {
  const timeZone = await getOrgTimezone(organizationId);
  const today = resolveTodayPeriod(timeZone, now);
  const resourceFilter =
    resourceIds != null ? { resourceId: { in: resourceIds } } : {};

  const [open, recentlyCompleted] = await Promise.all([
    db.booking.findMany({
      where: {
        organizationId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { gte: today.start, lt: today.end },
        ...resourceFilter,
      },
      orderBy: { startAt: "asc" },
      include: floorInclude,
    }),
    db.booking.findMany({
      where: {
        organizationId,
        status: "COMPLETED",
        startAt: { gte: today.start, lt: today.end },
        ...resourceFilter,
      },
      orderBy: { startAt: "desc" },
      take: 5,
      include: floorInclude,
    }),
  ]);

  const { current, upcoming } = splitFloorBookings(open, now);
  return { current, upcoming, recentlyCompleted, timeZone };
}

/** Plan usage: non-cancelled bookings with startAt in the current org-local month. */
export async function getMonthBookingUsage(
  organizationId: string,
  now = new Date(),
): Promise<number> {
  const timeZone = await getOrgTimezone(organizationId);
  const month = resolveMonthPeriod(timeZone, now);
  return db.booking.count({
    where: {
      organizationId,
      status: { not: "CANCELLED" },
      startAt: { gte: month.start, lt: month.end },
    },
  });
}

export function deltaHint(current: number, previous: number, suffix = "") {
  if (previous === 0 && current === 0) return "Flat vs prior period";
  if (previous === 0) return `New vs prior period${suffix}`;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return `Flat vs prior period${suffix}`;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prior period${suffix}`;
}
