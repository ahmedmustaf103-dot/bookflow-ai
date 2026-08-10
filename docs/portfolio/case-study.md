# Case study — BookFlow AI

> Replace bracketed metrics with real numbers after you collect them from demos and early users.

## Overview

**Product:** BookFlow AI — multi-tenant booking and operations platform for service businesses.  
**Live:** https://bookflow-ai-isga.vercel.app  
**Demo booking:** https://bookflow-ai-isga.vercel.app/book/bookflow  
**Role:** Solo builder / full-stack engineer  
**Stack:** Next.js 15, React 19, TypeScript, Prisma 7, PostgreSQL, Clerk, Stripe, Resend, Twilio, Vercel AI SDK, Upstash Redis

## Problem

Barbers, salons, and similar businesses still lose revenue to:

- No-shows and forgotten appointments
- Phone-tag booking that blocks chairs during busy hours
- Tool sprawl (calendar + SMS + CRM + “AI chatbot” that doesn’t know inventory)
- Softwares that look consumer-polished but are weak on tenancy, billing, and ops

Existing booking tools either under-serve automation or bolt AI on without real availability and plan entitlements.

## Solution

One org-scoped system that covers:

1. **Public booking** — branded 4-step flow (service → staff → time → details)
2. **Ops dashboard** — calendar, clients, staff, services, hours, analytics
3. **Automation** — confirmation, reminder, follow-up, review request, rebooking via outbox
4. **AI** — summaries, drafts, insights, booking assistant with tools + token metering
5. **Commercial layer** — Stripe plans, entitlements, white-label branding, custom domains

## Approach

Shipped in phased sprints rather than a big-bang rewrite:

| Phase | Outcome |
| ----- | ------- |
| 0 | App shell, Clerk, env validation, logging, CI |
| 1 | Orgs, locations, resources, services, availability engine |
| 2 | Public booking, appointments, email, Stripe |
| 3 | CRM, analytics, reminders/cron, audit log |
| 4 | AI workbench + metering |
| 5 | Exclusion constraints, Redis/cache, vertical packs, observability |
| 6–8 | Stronger automation, dashboard insights, white-label, CSP/RLS/prod hardening |

Engineering choices that matter in interviews:

- **Postgres exclusion constraints** for double-booking safety (not “check then insert” only)
- **Outbox pattern** for reliable notifications with retries/dedupe
- **RLS + tenant helpers** for multi-tenant isolation
- **Server actions + Zod** for typed mutations
- **Fail-open in-memory rate limits** when Redis isn’t configured (Hobby-friendly)

## Results

| Metric | Value |
| ------ | ----- |
| Time to first public booking (demo org) | [e.g. &lt; 2 minutes] |
| Reminder delivery success (outbox SENT) | [e.g. 98%] |
| Lighthouse / a11y smoke | [pass / score] |
| Orgs onboarded / waitlist | [n] |
| Bookings created in first 30 days | [n] |

Qualitative:

- [Quote from a barber / salon owner after a demo]
- [What surprised you in user testing]

## Screenshots

Drop captures into `docs/portfolio/screenshots/` (see [`screenshots.md`](./screenshots.md)) and embed here:

<!-- ![Landing](./screenshots/01-landing.png) -->
<!-- ![Public booking](./screenshots/02-booking.png) -->
<!-- ![Dashboard](./screenshots/03-dashboard.png) -->
<!-- ![AI](./screenshots/04-ai.png) -->
<!-- ![Analytics](./screenshots/05-analytics.png) -->

## What I’d build next

- Self-serve manage/reschedule via `manageToken`
- Tighter reminder cadence on Hobby (external cron)
- Deposit / card-on-file for no-show protection
- Deeper Google Calendar two-way sync

## Takeaway for clients

You get a production-shaped SaaS — not a prototype: tenancy, billing, automation, AI metering, security headers, and a public booking surface you can white-label.
