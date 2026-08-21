# Operator runbook — BookFlow AI

How to run a live shop after you have deployed the app. This does **not** claim production cron or email is already working; it tells you how to prove it.

Do not put secrets in this file, chat logs, or screenshots.

## What sends immediately (no cron)

These enqueue with `scheduledFor = now` and flush via Next.js `after()` on a warm function:

- Customer booking confirmation
- Owner/admin “new booking” email
- Cancellation email
- Reschedule email

If those do not arrive, cron is not the first place to look. Check Resend first.

## What needs a frequent cron

These stay `PENDING` until `scheduledFor` is reached:

- Appointment reminders (email, and SMS on Growth/Business)
- Follow-up, review request, rebooking (marketing; `marketingOptIn` must be true)

Vercel Hobby only allows **one cron per day**. `vercel.json` uses `0 8 * * *` as a safety net. That is **not** enough for reminder timing.

## Required production environment

Set these on Vercel (Production). Never commit `.env.local`.

| Variable                                                 | Why                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | Pooled Postgres                                                                         |
| `NEXT_PUBLIC_APP_URL`                                    | Real app URL (manage links in email)                                                    |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Auth                                                                                    |
| `CLERK_WEBHOOK_SIGNING_SECRET`                           | User sync                                                                               |
| `RESEND_API_KEY`                                         | Send email                                                                              |
| `RESEND_FROM_EMAIL`                                      | Must be a **verified** domain, not only `onboarding@resend.dev`, if you email customers |
| `CRON_SECRET`                                            | Protects `/api/cron/reminders` (required in production; missing → 503)                  |

Optional:

| Variable                                                          | Why                             |
| ----------------------------------------------------------------- | ------------------------------- |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS reminders                   |
| `STRIPE_SECRET_KEY` / price IDs / `STRIPE_WEBHOOK_SECRET`         | SaaS billing only               |
| `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`     | One-way calendar push           |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`             | Shared rate limits + slot cache |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`                           | Error tracking                  |
| `BLOB_READ_WRITE_TOKEN`                                           | Logo uploads                    |

This repo cannot see whether those values are set on Vercel. Confirm in the Vercel project settings.

## External 5-minute cron (required on Hobby)

1. Generate a long secret (`openssl rand -hex 32`) and set it as `CRON_SECRET` on Vercel.
2. Create a job (cron-job.org, EasyCron, GitHub Actions, etc.):
   - URL: `https://<your-host>/api/cron/reminders`
   - Method: GET or POST
   - Header: `Authorization: Bearer <CRON_SECRET>`
   - Schedule: every 5 minutes
3. Do **not** put the secret in the query string.

Smoke test (replace host; use your local env for the secret):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://<host>/api/cron/reminders
# expect 401 in production without auth

curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/reminders
# expect JSON { "ok": true, "processed": ..., "sent": ... }
```

Calling it repeatedly is safe: rows are claimed `PENDING → PROCESSING`, then `SENT` or retried.

## How to verify a reminder was sent

1. Create a booking far enough ahead that `reminderHoursBefore` (default 24h) is still in the future.
2. In Prisma Studio / SQL, find `notification_outbox` where `kind = 'BOOKING_REMINDER'` and `bookingId` matches.
3. Confirm `scheduledFor` is about `startAt − reminderHoursBefore`.
4. Either wait for cron, or temporarily set `scheduledFor` to the past **only on a test booking**, then hit the cron endpoint.
5. Success: `status = SENT`, `sentAt` set, `lastError` null. Resend dashboard shows the message.
6. Hit cron again: that booking should not send twice (`sent` stays 0 for that row).

## Outbox states

| Status       | Meaning                                                 |
| ------------ | ------------------------------------------------------- |
| `PENDING`    | Waiting for `scheduledFor` or a retry                   |
| `PROCESSING` | Claimed by a worker. Stale (>15 min) rows are reclaimed |
| `SENT`       | Provider accepted the send                              |
| `FAILED`     | Max attempts (5) or repeated provider errors            |
| `CANCELLED`  | Booking cancelled, or marketing opted out before send   |

## If a row is FAILED

1. Read `lastError` on the row (do not paste API keys).
2. Typical causes: missing `RESEND_API_KEY`, unverified from-domain, Resend test-mode allowlist, Twilio not configured (SMS).
3. Missing provider defers 6 hours and counts as an attempt; after 5 attempts the row is `FAILED`.
4. Fix env / domain, then either wait for retry (if still `PENDING`) or enqueue a new reminder by rescheduling the booking on a **test** appointment.
5. Do not mark `SENT` by hand.

## Marketing consent

Follow-up, review, and rebooking **do not send** unless `clients.marketingOptIn` is true. Opt-out also cancels pending marketing rows. Confirmations and reminders are transactional and still send.

## Shop setup (you operate this)

1. Sign in → onboarding (or switch to the right org).
2. Add location, staff, hours, services. Link staff to services.
3. Use **New appointment** on the calendar for walk-ins / phone bookings (`source = DASHBOARD`).
4. Deactivate a service or staff member instead of deleting — history stays.
5. Share `/book/<slug>`. Inactive services/staff do not appear there.
6. Invite extra dashboard users from Settings → Team (Clerk sign-in; org-scoped invite).
7. Confirmation emails include an ICS attachment plus Add to calendar. Google Calendar is optional one-way push.

Shop onboarding sequence: [PILOT.md](./PILOT.md). Google proof: [GOOGLE_CALENDAR.md](./GOOGLE_CALENDAR.md).

## What this runbook does not verify

Whether Vercel currently has `CRON_SECRET`, Resend, or an external 5-minute job. Check those in the host dashboard before promising reminder timing to a client.
