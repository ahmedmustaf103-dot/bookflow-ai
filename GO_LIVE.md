# Go-live checklist

Ship BookFlow AI on Vercel with a managed Postgres and the integrations below.

See also [docs/NOTIFICATIONS.md](./docs/NOTIFICATIONS.md) for outbox flush vs cron timing.

## 1. Database

1. Create a Postgres database (Neon / Supabase / RDS).
2. Use the **pooled** connection string in production.
3. Set `DATABASE_URL` and optionally `DATABASE_POOL_MAX`.
4. Run migrations:

```bash
npm run db:migrate:deploy
```

5. Confirm RLS migration applied (`20260810200000_postgres_rls`). App queries still work when `app.organization_id` is unset; use `withOrgRls()` for defense-in-depth transactions.

## 2. Auth (Clerk)

1. Create a Clerk application.
2. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
3. Add a webhook to `https://<host>/api/webhooks/clerk` for `user.created`, `user.updated`, `user.deleted`.
4. Set `CLERK_WEBHOOK_SIGNING_SECRET`.

## 3. App host (Vercel)

1. Import the GitHub repo into Vercel.
2. Set env vars from `.env.example` (production values).
3. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Deploy — `vercel.json` keeps a **daily** Vercel cron (`0 8 * * *`) because **Hobby only allows once-per-day crons** (more frequent expressions fail deploy). Precision on Hobby is also ±59 minutes within the hour.
5. Set `CRON_SECRET` in the Vercel project (Production + Preview as needed). Vercel’s native daily cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
6. Configure an **external cron** for demo/pilot reminder reliability — see **§3a** below. Confirmations/cancellations/reschedules flush via Next.js `after()` without waiting for cron; reminders and post-visit emails still need a frequent flush.
7. Optional: upgrade to Vercel Pro and change `vercel.json` to `*/5 * * * *` instead of (or in addition to) an external scheduler.
8. After deploy, verify response headers include `Content-Security-Policy`, `X-Frame-Options: DENY`, and `Strict-Transport-Security`.

## 3a. External cron (required on Hobby for reliable reminders)

Vercel Hobby cannot run `/api/cron/reminders` every 5 minutes. Use an external scheduler that hits the same secured endpoint.

### Endpoint

| | |
| - | - |
| **URL** | `https://<your-vercel-host>/api/cron/reminders` |
| **Methods** | `GET` or `POST` (both accepted) |
| **Auth header** | `Authorization: Bearer <CRON_SECRET>` |
| **Query secrets** | **Do not** put the secret in the URL (`?secret=` is rejected / unsupported) |

`<CRON_SECRET>` must match the `CRON_SECRET` environment variable on Vercel. Generate a long random value (e.g. `openssl rand -hex 32`). Never commit it.

### Recommended schedule

Every **5 minutes** (e.g. cron expression `*/5 * * * *`).

That keeps appointment reminders within a few minutes of `scheduledFor` and drains retries / stale `PROCESSING` reclaim regularly.

### Vercel env var

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `CRON_SECRET` | **Yes** in production | Without it the route returns `503` in production. Same value for Vercel Cron and the external scheduler. |

Also ensure `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (and Twilio vars if using SMS reminders) are set, or sends will defer as “provider not configured”.

### Example: cron-job.org

1. Create a job → URL = `https://bookflow-ai-isga.vercel.app/api/cron/reminders` (use your real host).
2. Schedule: every 5 minutes.
3. Request method: GET (or POST).
4. Custom header: `Authorization` = `Bearer ` + your secret (same as Vercel `CRON_SECRET`).
5. Enable the job after the first successful manual test (below).

EasyCron, GitHub Actions `schedule`, or any HTTP cron works the same way.

### Test the endpoint safely

Replace the host and secret locally; do not paste real secrets into chats or commits.

```bash
# Expect 401 without auth (production)
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://<host>/api/cron/reminders

# Expect 200 with Bearer token
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/reminders
```

Successful JSON shape (fields may be zero if nothing is due):

```json
{
  "ok": true,
  "processed": 0,
  "sent": 0,
  "failed": 0,
  "deferred": 0,
  "skippedClaim": 0,
  "reclaimed": 0
}
```

Calling the endpoint repeatedly is safe: rows are claimed with `PENDING → PROCESSING`, dedupe keys prevent duplicate enqueue, and already-`SENT` rows are not selected again.

### Verify a reminder was processed

1. Create a booking whose reminder is due soon (org `reminderHoursBefore` vs appointment start), or temporarily set `scheduledFor` on a `PENDING` `BOOKING_REMINDER` row to the past in Prisma Studio / SQL.
2. Wait for the next external cron tick (or run the `curl` above).
3. Check:
   - Outbox row: `status = SENT`, `sentAt` set, `lastError` null
   - Resend dashboard (or Twilio) for the message
   - Vercel function logs for `Processed notification outbox` with `sent >= 1`
4. Hit the endpoint again — `sent` should stay `0` for that booking (no duplicate send).

### Behaviour already guaranteed by the route

| Concern | Behaviour |
| ------- | ---------- |
| Due selection | Only `PENDING` rows with `scheduledFor <= now` |
| Idempotent / no double send | Optimistic claim (`updateMany` where still `PENDING`); lost races → `skippedClaim` |
| Stale jobs | `PROCESSING` older than 15 minutes reclaimed to `PENDING` each run |
| Failures | Error → `PENDING` + backoff retry (or `FAILED` after max attempts) |

More detail: [docs/NOTIFICATIONS.md](./docs/NOTIFICATIONS.md).

## 4. Email (Resend)

1. Verify a sending domain (or use Resend onboarding domain for tests).
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

`onboarding@resend.dev` can only deliver to the Resend account owner. To email clients, verify a domain you control in [Resend Domains](https://resend.com/domains), add the DKIM / SPF / MX records at the registrar, wait until status is **Verified**, then set Production:

`RESEND_FROM_EMAIL=BookFlow AI <hello@your-verified-domain>`

Redeploy after changing that value. Host fields at Namecheap are `resend._domainkey` and `send` (not `send.yourdomain.com`). MX Record appears after Mail Settings → Custom MX.

Also set Production `NEXT_PUBLIC_APP_URL` to the real Vercel URL (not `https://YOUR-PROJECT.vercel.app`) so manage-appointment links in emails work.

## 5. Billing (Stripe)

1. Create Starter / Growth / Business prices.
2. Set `STRIPE_SECRET_KEY`, price IDs, and `STRIPE_WEBHOOK_SECRET`.
3. Webhook endpoint: `https://<host>/api/webhooks/stripe`.

## 6. AI (optional but needed for `/dashboard/ai`)

Set `OPENAI_API_KEY` and/or `GOOGLE_GENERATIVE_AI_API_KEY`, plus `AI_PROVIDER`.

## 7. Observability & scale

| Integration | Vars |
| ----------- | ---- |
| **Sentry (required for prod ops)** | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` |
| Upstash Redis (shared slot cache + rate limits) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Twilio SMS reminders (Growth/Business) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Vercel Blob (logo/favicon uploads in prod) | `BLOB_READ_WRITE_TOKEN` |
| Google Calendar sync | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` |

Trigger a test error after deploy and confirm it appears in Sentry.

### Google Calendar

Create a **Web application** OAuth client. Authorized redirect URI:

`https://<your-vercel-host>/api/integrations/google-calendar/callback`

Enable the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) on that project, add scope `https://www.googleapis.com/auth/calendar.events` on the OAuth consent screen, then Dashboard → Settings → Connect Google Calendar and allow calendar access. Connecting does not import old bookings; only new / reschedule / cancel after a successful connect are pushed.

## 8. Smoke check after deploy

1. Sign up → onboarding → create business.
2. Add a service linked to staff.
3. Open `/book/<slug>` and create a booking.
4. Confirm email arrives (or logs if Resend unset).
5. Cancel / complete from Appointments.
6. (Growth+) Confirm reminder outbox rows; Twilio SMS if configured.
7. Run CI-equivalent locally:

```bash
npm run lint && npm test && npm run typecheck && npm run build
npm run test:e2e
```

8. Optional quality gates:

```bash
# Accessibility (Playwright + axe) — included in test:e2e
# Load smoke against a live booking page
LOAD_BASE_URL=https://<host> LOAD_ORG_SLUG=<slug> npm run load:smoke
# Lighthouse (serve production build first)
LH_BASE_URL=http://127.0.0.1:3000 LH_BOOK_PATH=/book/<slug> LH_MIN_SCORE=0.95 npm run lighthouse:smoke
```

## 9. Production hardening definition of done

- [ ] Security headers + CSP present on HTML responses
- [ ] Postgres RLS migration applied
- [ ] Sentry capturing server + client errors
- [ ] CI green on `main` (lint, unit, typecheck, build, Playwright incl. a11y)
- [ ] Booking + marketing pages pass Lighthouse ≥ 0.95 (or document exceptions)
- [ ] Load smoke error rate < 5% at modest concurrency
- [ ] New salon can book end-to-end with confirmation email

## Definition of done (product)

A new salon can sign up, publish a branded booking page, take a real appointment with confirmation email, and manage it from the dashboard — with Stripe subscription available.
