# Pilot runbook — onboard a real barber/salon

Use this when you put one shop live next week. Do not skip the proof steps.

Related: [OPERATOR.md](./OPERATOR.md) (cron, Resend, FAILED rows), [GOOGLE_CALENDAR.md](./GOOGLE_CALENDAR.md) (one-way sync), [GO_LIVE.md](../GO_LIVE.md) (Vercel env).

## Onboard the owner

1. **Create account** — Sign up at `/sign-up` with Clerk (email they actually check).
2. **Create business** — `/onboarding`: business name, vertical (barber/salon), timezone. This seeds a location, one staff member, weekday hours, and default services.
3. **Set branding** — Settings → logo + brand colour. Optional but it shows on the public page and emails. Checklist stays **Not set up** until a logo is uploaded.
4. **Add/edit services** — Review seeded services. Set price, duration, buffers. Deactivate anything they do not sell. Do not delete if it has history.
5. **Add/edit staff** — Name the chair/people customers pick. Assign which services they provide. Deactivate leavers; keep history.
6. **Configure hours** — Hours page, per staff member. Preview slots before sharing the link.
7. **Configure reminders** — Settings → reminder lead time (default 24h). Trial/Growth/Business get email reminders when Resend is live.
8. **Configure Resend** — Production `RESEND_API_KEY` + verified `RESEND_FROM_EMAIL`. Without this, bookings still save and outbox rows end **FAILED**, not SENT. Confirmations will not arrive.
9. **Connect Google Calendar if wanted** — Settings → Connect. Optional. Skip if they do not care. Bookings still work.
10. **Test a booking** — Open `/book/<slug>` (or dashboard **New appointment**). Use a real email you control.
11. **Test confirmation email** — Customer inbox + ICS attachment / Add to calendar. Owner/admin should get a “new booking” email.
12. **Test reminder** — See OPERATOR.md: either wait until `scheduledFor`, or move a **test** outbox row’s `scheduledFor` into the past and hit cron with `CRON_SECRET`.
13. **Test cancellation** — Manage link in the confirmation email → cancel. Slot should free. Google event should disappear if connected.
14. **Test rescheduling** — Manage link → new slot. Confirmation of the new time. Google event should move if connected.
15. **Share the public booking link** — Copy from the dashboard. Do not share `/book/bookflow` unless that shop is the one you mean.

## Team logins

Settings → Team: invite by email as ADMIN, STAFF, or VIEWER (owners invite admins; admins invite staff/viewers). Invitee signs in with **that** email and opens the invite link. Bookable chairs on **Staff** are not the same as dashboard logins.

## What BookFlow does **not** support today

Be honest with the shop:

- Two-way Google Calendar (Google does not write busy time back into BookFlow)
- Automatic Google busy-time blocking
- Remotely editing or deleting an event a customer imported by hand into iCloud / Apple Calendar (an updated or cancellation ICS is emailed; they must open it)
- Customer card deposits / Stripe Checkout for clients
- Full self-serve custom domains (field exists; DNS activation is ops-assisted)
- In-app chatbot
- n8n or other external workflow builders
- Destructive delete of services/staff that would wipe booking history (deactivate instead)

## Ready for a pilot?

You are ready when: logo or they accepted no logo, at least one active service linked to active staff, hours exist, a real confirmation email arrived, and (if they want reminders) cron + Resend are proven — not assumed.
