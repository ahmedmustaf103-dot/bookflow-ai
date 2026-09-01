# BookFlow AI — system architecture

Multi-tenant booking SaaS for service businesses. Clients book publicly; owners run ops from a dashboard; AI and automation sit on top of the same org-scoped data.

## High-level

```mermaid
flowchart TB
  subgraph Clients
    Browser[Browser]
    Phone[Email / SMS]
  end

  subgraph Edge["Vercel / Next.js 15"]
    MW[Middleware<br/>auth · custom domain · CSP]
    Mkt["Marketing /"]
    Book["Public booking /book/slug"]
    Dash["Dashboard /dashboard"]
    API["API routes<br/>webhooks · cron"]
  end

  subgraph Core["Server domain"]
    Actions[Server actions]
    Avail[Availability engine]
    Outbox[Notification outbox]
    AI[AI features + tools]
    Billing[Stripe entitlements]
    Tenant[Tenant DB + RLS]
  end

  subgraph Data
    PG[(PostgreSQL)]
    Redis[(Upstash Redis<br/>optional)]
  end

  subgraph External
    Clerk[Clerk]
    Stripe[Stripe]
    Resend[Resend]
    Twilio[Twilio]
    GCal[Google Calendar]
    LLM[OpenAI / Google AI]
  end

  Browser --> MW
  MW --> Mkt
  MW --> Book
  MW --> Dash
  MW --> API

  Book --> Actions
  Dash --> Actions
  API --> Actions

  Actions --> Avail
  Actions --> Outbox
  Actions --> AI
  Actions --> Billing
  Actions --> Tenant
  Tenant --> PG
  Avail --> Redis
  Outbox --> Resend
  Outbox --> Twilio
  AI --> LLM
  Billing --> Stripe
  Dash --> Clerk
  API --> Clerk
  Actions --> GCal
  Outbox --> Phone
```

## Request paths

| Surface                | Who            | What happens                                    |
| ---------------------- | -------------- | ----------------------------------------------- |
| `/`                    | Prospects      | Marketing landing → Clerk sign-up               |
| `/book/[slug]`         | End customers  | 4-step wizard: service → staff → time → details |
| Custom domain          | End customers  | Middleware rewrites host → `/book/by-host`      |
| `/dashboard/*`         | Owners / staff | Calendar, CRM, AI, analytics, settings, billing |
| `/api/webhooks/clerk`  | Clerk          | Sync users into `User` + memberships            |
| `/api/webhooks/stripe` | Stripe         | Plan + subscription state                       |
| `/api/cron/reminders`  | Vercel cron    | Flush notification outbox                       |

## Tenancy & security

- Every business row hangs off `Organization`.
- Memberships map Clerk users → org roles (`OWNER` / `ADMIN` / `STAFF` / `VIEWER`).
- Postgres RLS + `withOrgRls` / tenant DB helpers enforce org isolation at query time.
- Public booking never sees other tenants; rate limits protect slot fetch and create booking.
- Security headers + CSP on responses (see Sprint 8 / `GO_LIVE.md`).

## Availability

```mermaid
sequenceDiagram
  participant W as Booking wizard
  participant A as fetchPublicSlotsAction
  participant E as Availability engine
  participant DB as Postgres
  participant C as Redis cache optional

  W->>A: org + service + staff
  A->>A: rate limit
  A->>C: get cached slots
  alt cache miss
    A->>E: rules + overrides + bookings
    E->>DB: load resource hours & bookings
    E-->>A: open ISO slots next week
    A->>C: set cache
  end
  A-->>W: slot list
```

## Automation (outbox)

Kinds: confirmation, cancellation, reminder, follow-up, review request, rebooking nudge.  
Channels: email (Resend), SMS (Twilio, plan-gated).  
Cron drains `NotificationOutbox` with retries and dedupe keys.

## AI

Dashboard AI workbench: client summaries, message drafts, insight digests, booking assistant with tools. Runs metered in `AiRun` against plan token budgets.

## Deploy topology

- **App:** Vercel (Hobby cron = daily; use external cron for tighter reminder windows).
- **DB:** Neon / Supabase Postgres (pooled URL in production).
- **Auth:** Clerk.
- **Optional:** Upstash Redis for shared rate limits + slot cache across instances.
