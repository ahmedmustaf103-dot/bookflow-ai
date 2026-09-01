# Analytics metrics

Source of truth: [`src/server/analytics/definitions.ts`](../src/server/analytics/definitions.ts)  
Period math: [`src/server/analytics/period.ts`](../src/server/analytics/period.ts)  
Queries: [`src/server/analytics/org.ts`](../src/server/analytics/org.ts)

## Business rule

**All appointment metrics use `booking.startAt`**, interpreted in the organization’s `timezoneDefault`.

The selected window is the last **N local calendar days including today**, as a half-open Instant range:

`[start of first day, start of tomorrow)` in the org timezone.

Bookings **created** yesterday for an appointment **today** count in today’s analytics.  
Bookings created today for **next month** do **not** count in the current 30-day window (they appear when that `startAt` falls in range).

## Metric definitions

| Metric                         | Definition                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Bookings**                   | Count of appointments with `startAt` in the period (all statuses, including cancelled)                |
| **Completed**                  | `COMPLETED` with `startAt` in period                                                                  |
| **Cancelled**                  | `CANCELLED` with `startAt` in period                                                                  |
| **No-shows**                   | `NO_SHOW` with `startAt` in period                                                                    |
| **No-show rate**               | `NO_SHOW / (COMPLETED + NO_SHOW)` in period; `0` if none eligible                                     |
| **Est. revenue**               | Sum of `service.priceCents` for **COMPLETED** only, `startAt` in period (list price, not Stripe cash) |
| **Upcoming**                   | `PENDING` + `CONFIRMED` with `startAt >= now` (not limited to the period)                             |
| **Clients on file**            | All-time `Client` count for the org                                                                   |
| **Trend (bookings)**           | Per local day: non-cancelled appointments that day                                                    |
| **Trend (revenue)**            | Per local day: COMPLETED list-price sum that day                                                      |
| **Popular services**           | Non-cancelled in period by service; revenue = COMPLETED only                                          |
| **Staff insights**             | Non-cancelled in period by resource                                                                   |
| **New clients**                | Clients with `createdAt` in the period (profile acquisition)                                          |
| **Returning this period**      | Clients with ≥2 non-cancelled bookings whose `startAt` is in period                                   |
| **Repeat bookers**             | Clients with ≥2 COMPLETED bookings all-time                                                           |
| **Clients with upcoming**      | Distinct clients with a future PENDING/CONFIRMED booking                                              |
| **Today’s agenda**             | PENDING/CONFIRMED with `startAt` in today’s org-local day                                             |
| **Bookings this month (plan)** | Non-cancelled with `startAt` in the current org-local calendar month                                  |

## Tenancy

Every query filters `organizationId` (dashboard uses the signed-in org only).

## Limitations

- Multi-location orgs use **org default timezone**, not each location’s timezone, for period boundaries and day buckets.
- Revenue is **list price on COMPLETED**, not deposits/refunds/Stripe charges.
- Currency is taken from the first active service (orgs with mixed currencies still sum as one integer).
