/**
 * BookFlow analytics metric definitions (source of truth for product + tests).
 *
 * Primary time axis: booking.startAt interpreted in the organization's timezoneDefault.
 * Period: last N local calendar days inclusive of today, half-open Instant range [start, end).
 */
export const ANALYTICS_METRIC_DEFINITIONS = {
  period:
    "Last N calendar days in the organization timezone, including today. Bounds are [startOfFirstDay, startOfTomorrow) as Instants.",
  booking:
    "Any appointment whose startAt falls in the selected period (all statuses).",
  bookingsTotal:
    "Count of bookings with startAt in the period (includes cancelled).",
  bookingsCompleted: "Count of COMPLETED bookings with startAt in the period.",
  bookingsCancelled: "Count of CANCELLED bookings with startAt in the period.",
  bookingsNoShow: "Count of NO_SHOW bookings with startAt in the period.",
  noShowRate:
    "NO_SHOW / (COMPLETED + NO_SHOW) for bookings with startAt in the period. 0 when there are no eligible outcomes.",
  revenue:
    "Sum of service.priceCents for COMPLETED bookings with startAt in the period. Not cash collected; list price at service.",
  upcoming:
    "PENDING + CONFIRMED bookings with startAt >= now (not limited to the period window).",
  uniqueClients: "Count of Client rows for the organization (all time).",
  seriesBookings:
    "Per local day: count of non-cancelled bookings with startAt on that day.",
  seriesRevenue:
    "Per local day: COMPLETED booking service price sum with startAt on that day.",
  topServices:
    "Non-cancelled bookings in period grouped by service; revenue uses COMPLETED only.",
  staffInsights:
    "Non-cancelled bookings in period grouped by resource; completed/no-show counts by status.",
  newClients:
    "Clients whose profile createdAt falls in the period (acquisition, not first appointment).",
  returningClients:
    "Distinct clients with 2+ non-cancelled bookings whose startAt falls in the period.",
  repeatBookers:
    "Distinct clients with 2+ COMPLETED bookings all-time (loyalty).",
  clientsWithUpcoming:
    "Distinct clients with at least one PENDING/CONFIRMED booking with startAt >= now.",
  todayAgenda:
    "PENDING/CONFIRMED bookings with startAt in today's local org-timezone day.",
  monthBookingsUsage:
    "Non-cancelled bookings with startAt in the current org-timezone calendar month (plan quota signal).",
} as const;
