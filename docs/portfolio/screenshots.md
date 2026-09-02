# Screenshots — capture guide

Save PNGs into this folder:

`docs/portfolio/screenshots/`

Use a clean Chrome profile, 1440×900 or 1600×1000, light mode, hide bookmarks bar.

## Required set (portfolio + case study)

| #   | Filename                   | URL                       | Notes                             |
| --- | -------------------------- | ------------------------- | --------------------------------- |
| 1   | `01-landing.png`           | `/`                       | Full first viewport — brand + CTA |
| 2   | `02-booking-service.png`   | `/book/bookflow-demo`     | Step 1 services                   |
| 3   | `03-booking-time.png`      | `/book/bookflow-demo`     | Step 3 with visible slots         |
| 4   | `04-booking-confirmed.png` | after submit              | Success state                     |
| 5   | `05-dashboard.png`         | `/dashboard`              | Overview                          |
| 6   | `06-appointments.png`      | `/dashboard/appointments` | Calendar/board with bookings      |
| 7   | `07-analytics.png`         | `/dashboard/analytics`    | Charts populated if possible      |
| 8   | `08-ai.png`                | `/dashboard/ai`           | Workbench with a completed run    |
| 9   | `09-settings-brand.png`    | `/dashboard/settings`     | Logo / brand colour if set        |

## Optional

| Filename                | Why                              |
| ----------------------- | -------------------------------- |
| `10-staff-hours.png`    | Shows availability engine inputs |
| `11-billing.png`        | Stripe plans / entitlements      |
| `12-mobile-booking.png` | iPhone frame or DevTools mobile  |

## Tips

- For a local dashboard capture, run `npm run db:seed:demo` and open org slug `bookflow-demo` (Atelier Hale). Do not reseed production `bookflow`.
- Use realistic names (not “Test Client 3”). The demo seed already does this.
- Crop browser chrome for LinkedIn; keep URL bar for case-study “live product” proof.
- After capture, embed in [`case-study.md`](./case-study.md) and the README gallery.
