# Go-live checklist

Ship BookFlow AI on Vercel with a managed Postgres and the integrations below.

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
4. Deploy — cron for `/api/cron/reminders` is already in `vercel.json` (every 15m).
5. Set `CRON_SECRET` and ensure Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` (Vercel does this automatically when configured).
6. After deploy, verify response headers include `Content-Security-Policy`, `X-Frame-Options: DENY`, and `Strict-Transport-Security`.

## 4. Email (Resend)

1. Verify a sending domain (or use Resend onboarding domain for tests).
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

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

Trigger a test error after deploy and confirm it appears in Sentry.

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
