# LinkedIn launch post

Copy, personalize the bracketed bits, then post with 3–4 screenshots + demo link.

---

## Primary post

I built **BookFlow AI** — a multi-tenant booking and operations platform for barbers, salons, and other appointment businesses.

**The problem:** shops lose time and money to phone-tag booking, no-shows, and a pile of disconnected tools.

**What shipped:**

- Public branded booking (`/book/[slug]`) with real availability
- Owner dashboard — calendar, clients, staff, services, hours
- Automation outbox — confirmations, reminders, follow-ups, review asks, rebooking nudges (email + SMS)
- AI workbench — summaries, drafts, insights, booking assistant — metered by plan
- Stripe plans, white-label branding, custom domain prep
- Postgres tenancy with RLS, security headers, and production hardening on Vercel

**Stack:** Next.js 15 · React 19 · TypeScript · Prisma · PostgreSQL · Clerk · Stripe · Resend · Twilio · Vercel AI SDK

**Try it**

- App: https://bookflow-ai-isga.vercel.app
- Book a demo appointment: https://bookflow-ai-isga.vercel.app/book/bookflow

If you run a service business — or you build for ones — I’m looking for [pilot shops / freelance clients / feedback]. Happy to do a 20-minute walkthrough.

[#BuildInPublic](https://www.linkedin.com/feed/hashtag/?keywords=buildinpublic) #SaaS #NextJS #BookingSoftware #Barber #SalonTech

---

## Short follow-up (day 2–3)

Quick clip from the booking flow (15–30s).

Caption:

> Customer side of BookFlow AI — service → staff → time → done. Availability is computed from real staff hours + existing bookings, not a static calendar embed.

Link the full demo again.

---

## Comment you pin under the post

Architecture + case study (when public):  
`docs/portfolio/` in the repo — ERD, system diagram, and a write-up of the phased build.

DM me “demo” and I’ll send a calendar link.
