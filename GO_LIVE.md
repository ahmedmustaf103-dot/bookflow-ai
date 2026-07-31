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

## 4. Email (Resend)

1. Verify a sending domain (or use Resend onboarding domain for tests).
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

## 5. Billing (Stripe)

1. Create Starter / Growth / Business prices.
2. Set `STRIPE_SECRET_KEY`, price IDs, and `STRIPE_WEBHOOK_SECRET`.
3. Webhook endpoint: `https://<host>/api/webhooks/stripe`.

## 6. AI (optional but needed for `/dashboard/ai`)

Set `OPENAI_API_KEY` and/or `GOOGLE_GENERATIVE_AI_API_KEY`, plus `AI_PROVIDER`.

## 7. Scale & polish (optional)

| Integration | Vars |
| ----------- | ---- |
| Upstash Redis (shared slot cache + rate limits) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` |
| Twilio SMS reminders (Growth/Business) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |

## 8. Smoke check after deploy

1. Sign up → onboarding → create business.
2. Add a service linked to staff.
3. Open `/book/<slug>` and create a booking.
4. Confirm email arrives (or logs if Resend unset).
5. Cancel / complete from Appointments.
6. (Growth+) Confirm reminder outbox rows; Twilio SMS if configured.
7. Run local/CI Playwright: `npm run test:e2e` (set `SMOKE_ORG_SLUG` for a live book page).

## Definition of done

A new salon can sign up, publish a booking page, take a real appointment with confirmation email, and manage it from the dashboard — with Stripe subscription available.
