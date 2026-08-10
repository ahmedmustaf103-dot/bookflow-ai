import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type OrgAnalytics = {
  bookingsTotal: number;
  bookingsCompleted: number;
  bookingsNoShow: number;
  bookingsCancelled: number;
  noShowRate: number;
  estimatedRevenueCents: number;
  uniqueClients: number;
  upcoming: number;
  currency: string;
  /** Prior window of same length for simple compare */
  previous: {
    bookingsTotal: number;
    estimatedRevenueCents: number;
    noShowRate: number;
  };
};

export type AnalyticsDayPoint = {
  date: string; // yyyy-MM-dd
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

function windowStart(days: number, from = new Date()) {
  const since = new Date(from);
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return since;
}

async function resolveCurrency(organizationId: string) {
  const service = await db.service.findFirst({
    where: { organizationId, isActive: true },
    select: { currency: true },
    orderBy: { createdAt: "asc" },
  });
  return service?.currency || "GBP";
}

async function statusCounts(organizationId: string, since: Date, until?: Date) {
  const grouped = await db.booking.groupBy({
    by: ["status"],
    where: {
      organizationId,
      createdAt: {
        gte: since,
        ...(until ? { lt: until } : {}),
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
  const attendedOrMissed = completed + noShow;
  const noShowRate =
    attendedOrMissed === 0 ? 0 : noShow / attendedOrMissed;
  return { completed, noShow, cancelled, total, noShowRate };
}

async function revenueCents(
  organizationId: string,
  since: Date,
  until?: Date,
) {
  const rows = until
    ? await db.$queryRaw<Array<{ cents: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(s."priceCents"), 0)::int AS cents
        FROM bookings b
        INNER JOIN services s ON s.id = b."serviceId"
        WHERE b."organizationId" = ${organizationId}
          AND b.status IN ('COMPLETED', 'CONFIRMED')
          AND b."startAt" >= ${since}
          AND b."startAt" < ${until}
      `)
    : await db.$queryRaw<Array<{ cents: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(s."priceCents"), 0)::int AS cents
        FROM bookings b
        INNER JOIN services s ON s.id = b."serviceId"
        WHERE b."organizationId" = ${organizationId}
          AND b.status IN ('COMPLETED', 'CONFIRMED')
          AND b."startAt" >= ${since}
      `);
  return rows[0]?.cents ?? 0;
}

export async function getOrgAnalytics(
  organizationId: string,
  days = 30,
): Promise<OrgAnalytics> {
  const since = windowStart(days);
  const prevUntil = since;
  const prevSince = windowStart(days, since);

  const [
    current,
    previous,
    uniqueClients,
    upcoming,
    estimatedRevenueCents,
    previousRevenue,
    currency,
  ] = await Promise.all([
    statusCounts(organizationId, since),
    statusCounts(organizationId, prevSince, prevUntil),
    db.client.count({ where: { organizationId } }),
    db.booking.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { gte: new Date() },
      },
    }),
    revenueCents(organizationId, since),
    revenueCents(organizationId, prevSince, prevUntil),
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
    previous: {
      bookingsTotal: previous.total,
      estimatedRevenueCents: previousRevenue,
      noShowRate: previous.noShowRate,
    },
  };
}

export async function getBookingSeries(
  organizationId: string,
  days = 30,
): Promise<AnalyticsDayPoint[]> {
  const since = windowStart(days);
  const rows = await db.$queryRaw<
    Array<{ day: Date; bookings: number; revenue: number }>
  >(Prisma.sql`
    SELECT
      date_trunc('day', b."startAt") AS day,
      COUNT(*)::int AS bookings,
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('COMPLETED', 'CONFIRMED') THEN s."priceCents"
          ELSE 0
        END
      ), 0)::int AS revenue
    FROM bookings b
    INNER JOIN services s ON s.id = b."serviceId"
    WHERE b."organizationId" = ${organizationId}
      AND b."startAt" >= ${since}
      AND b.status <> 'CANCELLED'
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const byDay = new Map<string, AnalyticsDayPoint>();
  for (const row of rows) {
    const date = row.day.toISOString().slice(0, 10);
    byDay.set(date, {
      date,
      bookings: row.bookings,
      revenueCents: row.revenue,
    });
  }

  const series: AnalyticsDayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push(
      byDay.get(key) ?? { date: key, bookings: 0, revenueCents: 0 },
    );
  }
  return series;
}

export async function getTopServices(
  organizationId: string,
  days = 30,
  limit = 5,
): Promise<TopServiceRow[]> {
  const since = windowStart(days);
  return db.$queryRaw<TopServiceRow[]>(Prisma.sql`
    SELECT
      s.name AS name,
      COUNT(*)::int AS count,
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('COMPLETED', 'CONFIRMED') THEN s."priceCents"
          ELSE 0
        END
      ), 0)::int AS "revenueCents"
    FROM bookings b
    INNER JOIN services s ON s.id = b."serviceId"
    WHERE b."organizationId" = ${organizationId}
      AND b."startAt" >= ${since}
      AND b.status <> 'CANCELLED'
    GROUP BY s.name
    ORDER BY count DESC
    LIMIT ${limit}
  `);
}

export async function getStaffInsights(
  organizationId: string,
  days = 30,
  limit = 6,
): Promise<StaffInsightRow[]> {
  const since = windowStart(days);
  return db.$queryRaw<StaffInsightRow[]>(Prisma.sql`
    SELECT
      r.id AS "resourceId",
      r.name AS name,
      COUNT(*)::int AS bookings,
      COUNT(*) FILTER (WHERE b.status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE b.status = 'NO_SHOW')::int AS "noShows"
    FROM bookings b
    INNER JOIN resources r ON r.id = b."resourceId"
    WHERE b."organizationId" = ${organizationId}
      AND b."startAt" >= ${since}
      AND b.status <> 'CANCELLED'
    GROUP BY r.id, r.name
    ORDER BY bookings DESC
    LIMIT ${limit}
  `);
}

export async function getCustomerInsights(
  organizationId: string,
  days = 30,
): Promise<CustomerInsights> {
  const since = windowStart(days);

  const [newClients, returningRows, clientsWithUpcoming, repeatRows] =
    await Promise.all([
      db.client.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
      db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT b."clientId"
          FROM bookings b
          WHERE b."organizationId" = ${organizationId}
            AND b."startAt" >= ${since}
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
          AND b."startAt" >= NOW()
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

export async function getTodayAgenda(
  organizationId: string,
  take = 5,
) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return db.booking.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gte: start, lt: end },
    },
    orderBy: { startAt: "asc" },
    take,
    include: {
      client: { select: { name: true } },
      service: { select: { name: true } },
      resource: { select: { name: true } },
      location: { select: { timezone: true } },
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
