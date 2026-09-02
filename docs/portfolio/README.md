# Portfolio pack — BookFlow AI

Assets that help you get clients after the product is finished.

| Asset                | File                                             | Status                            |
| -------------------- | ------------------------------------------------ | --------------------------------- |
| Professional README  | [`../../README.md`](../../README.md)             | Ready                             |
| Architecture diagram | [`architecture.md`](./architecture.md)           | Ready (Mermaid)                   |
| Database ERD         | [`erd.md`](./erd.md)                             | Ready (Mermaid)                   |
| Case study           | [`case-study.md`](./case-study.md)               | Ready (fill metrics after launch) |
| Demo video script    | [`demo-video-script.md`](./demo-video-script.md) | Ready to record                   |
| Screenshots guide    | [`screenshots.md`](./screenshots.md)             | Capture checklist                 |
| Landing page         | Live at `/`                                      | Shipped in app                    |
| LinkedIn launch post | [`linkedin-launch.md`](./linkedin-launch.md)     | Ready to post                     |

**Live demo:** https://bookflow-ai-isga.vercel.app  
**Public booking:** https://bookflow-ai-isga.vercel.app/book/bookflow-demo

## Presentation demo (Atelier Hale)

Local/test databases can be filled with a realistic barber shop without touching live customer orgs or the E2E fixture:

```bash
npm run db:seed:demo
```

- Shop: **Atelier Hale** (slug `bookflow-demo` only)
- Public book path: `/book/bookflow-demo`
- Fictional clients (`@example.test`), mixed appointment statuses, returning and new clients
- Does **not** write to `bookflow`, `pgym`, or `e2e-test-shop`

Hosted databases require an explicit opt-in (`DEMO_SEED_ALLOW_HOSTED=1`). Optional `DEMO_SEED_OWNER_EMAIL` attaches an existing user as owner so the Clerk dashboard can open that org.

Do not use the gym org (`pgym`) in the pitch. One barber demo is enough.
