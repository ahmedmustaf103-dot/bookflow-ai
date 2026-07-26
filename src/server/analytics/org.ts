import "server-only";

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
};

export async function getOrgAnalytics(
  organizationId: string,
  days = 30,
): Promise<OrgAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [grouped, uniqueClients, upcoming, revenueRows] = await Promise.all([
    db.booking.groupBy({
      by: ["status"],
      where: {
        organizationId,
        createdAt: { gte: since },
      },
      _count: { _all: true },
    }),
    db.client.count({ where: { organizationId } }),
    db.booking.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { gte: new Date() },
      },
    }),
    db.booking.findMany({
      where: {
        organizationId,
        status: { in: ["COMPLETED", "CONFIRMED"] },
        startAt: { gte: since },
      },
      select: { service: { select: { priceCents: true } } },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }

  const bookingsCompleted = counts.COMPLETED ?? 0;
  const bookingsNoShow = counts.NO_SHOW ?? 0;
  const bookingsCancelled = counts.CANCELLED ?? 0;
  const bookingsTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const attendedOrMissed = bookingsCompleted + bookingsNoShow;
  const noShowRate =
    attendedOrMissed === 0 ? 0 : bookingsNoShow / attendedOrMissed;

  const estimatedRevenueCents = revenueRows.reduce(
    (sum, row) => sum + row.service.priceCents,
    0,
  );

  return {
    bookingsTotal,
    bookingsCompleted,
    bookingsNoShow,
    bookingsCancelled,
    noShowRate,
    estimatedRevenueCents,
    uniqueClients,
    upcoming,
  };
}
