# BookFlow AI

AI-powered booking and business management for barbers, salons, and other service businesses.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4
- Prisma 7 · PostgreSQL · Clerk · Upstash Redis (optional) · Vercel-ready

## Phase 0–5 (current)

- Phase 0: app shell, Clerk auth, env validation, logging, CI
- Phase 1: organizations, locations, resources, services, hours, availability engine
- Phase 2: public booking (`/book/[slug]`), appointments board, Resend email, Stripe billing
- Phase 3: clients CRM, analytics, settings, reminder outbox + cron, plan entitlements, audit log
- Phase 4: AI summaries, message drafts, booking assistant with tools, token metering
- Phase 5: Postgres exclusion constraints, Redis slot cache & rate limits, feature flags, vertical packs, pooling/observability hooks

## Production

See [GO_LIVE.md](./GO_LIVE.md) for the deploy checklist (Clerk, Stripe, Resend, Twilio, Sentry, Vercel cron).

## Setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Fill in `DATABASE_URL` and Clerk keys from the [Clerk dashboard](https://dashboard.clerk.com).
   For production, use a **pooled** connection string (Neon/Supabase pooler or PgBouncer) and tune `DATABASE_POOL_MAX`.

3. Install and generate the Prisma client:

```bash
npm install
npm run db:generate
```

4. Run migrations (requires a reachable Postgres):

```bash
npm run db:migrate
```

5. (Optional) Add Upstash Redis REST credentials for shared slot cache and rate limits across instances. Without them, in-memory fallbacks work for local/single-instance.

6. Start the app:

```bash
npm run dev
```

7. Point a Clerk webhook to `https://<your-host>/api/webhooks/clerk` for events:
   - `user.created`
   - `user.updated`
   - `user.deleted`

   Set `CLERK_WEBHOOK_SIGNING_SECRET` from the Clerk webhook endpoint.

## Scripts

| Script               | Purpose                   |
| -------------------- | ------------------------- |
| `npm run dev`        | Local development         |
| `npm run build`      | Production build          |
| `npm run lint`       | ESLint                    |
| `npm run typecheck`  | TypeScript                |
| `npm run format`     | Prettier                  |
| `npm run db:migrate` | Create/apply migrations   |
| `npm run db:studio`  | Prisma Studio             |
| `npm test`           | Unit / eval tests         |
| `npm run test:e2e`   | Playwright smoke tests    |

## Architecture

See the architecture canvas in Cursor for the full roadmap (folders, schema, phases).
