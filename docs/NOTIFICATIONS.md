# Notification outbox & delivery timing

BookFlow keeps an **outbox** (`notification_outbox`) for all customer emails/SMS. Rows are claimed with `PENDING → PROCESSING`, sent via Resend/Twilio, then marked `SENT` (or retried / `FAILED`).

## What is fast without cron

After a booking **confirmation**, **cancellation**, or **reschedule** is enqueued with `scheduledFor = now`, the server schedules `processDueOutbox()` via Next.js [`after()`](https://nextjs.org/docs/app/api-reference/functions/after). That runs **after the response** so:

- The booking DB transaction never waits on Resend
- Emails typically leave within seconds on a warm function
- Dedupe keys + claim semantics still prevent double sends

## What still needs a frequent cron

| Kind                                                  | Why                                      |
| ----------------------------------------------------- | ---------------------------------------- |
| `BOOKING_REMINDER` (email/SMS)                        | `scheduledFor` is hours before `startAt` |
| `FOLLOW_UP` / `REVIEW_REQUEST` / `REBOOKING_REMINDER` | Scheduled after completion               |
| Retries after provider failure                        | Backoff until next flush                 |
| Stale `PROCESSING` reclaim                            | Workers that died mid-send               |

## Vercel Hobby limitation (current deploy)

Hobby allows **at most one cron run per day**. Expressions like `*/5 * * * *` **fail deployment**. Timing is also only accurate to ±59 minutes within the hour.

`vercel.json` therefore keeps:

```json
{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }
```

as a safety net only — **not** sufficient for reminder timing.

## Recommended setup for demos / pilots

Point an external scheduler every **5 minutes** at:

```http
GET https://<host>/api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

(POST is also accepted.)

Examples: [cron-job.org](https://cron-job.org) (free), EasyCron, GitHub Actions `schedule`.

Alternatively upgrade to **Vercel Pro** and change the schedule to `*/5 * * * *`.

Until an external (or Pro) cron is configured, **reminders and post-visit automations are not reliable for client use**, even though confirm/cancel/reschedule emails flush promptly.

Operator checklist (env vars, curl tests, FAILED rows): [OPERATOR.md](./OPERATOR.md).

## Transactional vs marketing consent

| Kind                           | Class         | `marketingOptIn` required? |
| ------------------------------ | ------------- | -------------------------- |
| `BOOKING_CONFIRMATION`         | Transactional | No                         |
| `BOOKING_CANCELLATION`         | Transactional | No                         |
| `BOOKING_RESCHEDULED`          | Transactional | No                         |
| `BOOKING_REMINDER` (email/SMS) | Transactional | No                         |
| `FOLLOW_UP`                    | Marketing     | **Yes**                    |
| `REVIEW_REQUEST`               | Marketing     | **Yes**                    |
| `REBOOKING_REMINDER`           | Marketing     | **Yes**                    |

Enforcement:

1. **Enqueue** — `enqueuePostVisitAutomation` skips all marketing rows when `ctx.marketingOptIn` is not `true`.
2. **Send / retry** — `processDueOutbox` re-loads the client’s live `marketingOptIn` before dispatching marketing kinds; if opted out, the row is `CANCELLED` (not retried).
3. **Staff opt-out** — updating a client with marketing unchecked cancels pending/processing marketing outbox rows for that client.

This is an engineering control, not legal advice.
