import { ButtonLink } from "@/components/ui/button";

function BookingPreview() {
  return (
    <div
      className="bf-marketing-preview relative mx-auto w-full max-w-lg overflow-hidden rounded-t-[18px] border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur"
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-zinc-200/80 bg-zinc-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="ml-3 text-[11px] tracking-wide text-zinc-400">
          bookflow.app/book/your-shop
        </span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Online booking
        </p>
        <p className="font-marketing text-2xl font-bold tracking-tight text-zinc-900">
          Your shop name
        </p>
        <div className="flex gap-2">
          {["Service", "Staff", "Time", "Details"].map((label, i) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                  i < 2
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : i === 2
                      ? "bg-[var(--accent)] text-white"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {i < 2 ? "✓" : i + 1}
              </span>
              <span className="text-[10px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            "Tue 10:00",
            "Tue 10:30",
            "Tue 11:00",
            "Wed 09:00",
            "Wed 14:00",
            "Thu 16:30",
          ].map((slot, i) => (
            <div
              key={slot}
              className={`rounded-md border px-2 py-2 text-center text-xs ${
                i === 1
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                  : "border-zinc-200 text-zinc-600"
              }`}
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              {slot}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const capabilities = [
  {
    title: "Public booking that respects real hours",
    body: "Service, staff, and open times from your real hours — not a static booking button.",
  },
  {
    title: "Ops dashboard for the whole shop",
    body: "Calendar, customers, staff, services, hours, and insights — all in one place for your business.",
  },
  {
    title: "Automation that actually sends",
    body: "Confirmations, reminders, follow-ups, review asks, and rebooking nudges that actually send.",
  },
  {
    title: "AI with plan limits built in",
    body: "Summaries, drafts, insights, and a booking assistant — with fair usage so costs stay predictable.",
  },
];

const steps = [
  {
    n: "01",
    title: "Set up your shop",
    body: "Onboard locations, staff, services, and weekly hours in minutes.",
  },
  {
    n: "02",
    title: "Share your booking link",
    body: "Give this link to your customers so they can book appointments online.",
  },
  {
    n: "03",
    title: "Run the day",
    body: "See the calendar fill, messages go out, and AI help with follow-ups.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="bf-marketing-hero relative flex min-h-[100svh] flex-col justify-end overflow-hidden pt-24 pb-0 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 10% 0%, #1a9b74 0%, transparent 55%), radial-gradient(90% 70% at 90% 20%, #0a3d32 0%, transparent 50%), linear-gradient(165deg, #0c5a46 0%, #06352c 45%, #021a16 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-6 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-12 lg:pb-0">
          <div className="bf-marketing-hero-copy max-w-xl pb-4 lg:pb-16">
            <h1 className="font-marketing text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl md:text-7xl">
              BookFlow AI
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/80">
              Booking and shop ops for barbers, salons, and appointment
              businesses — with automation and AI on the same system.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href="/sign-up"
                variant="secondary"
                className="h-11 border-0 bg-white px-5 !text-zinc-900 hover:bg-zinc-100 hover:!text-zinc-900"
              >
                Start free
              </ButtonLink>
              <ButtonLink
                href="/book/bookflow"
                variant="ghost"
                className="h-11 px-5 text-white hover:bg-white/10 hover:text-white"
              >
                Try live booking
              </ButtonLink>
            </div>
          </div>
          <div className="bf-marketing-hero-visual px-2 sm:px-6 lg:px-0">
            <BookingPreview />
          </div>
        </div>
      </section>

      <section
        id="product"
        className="border-b border-[var(--border)] bg-[var(--surface)] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-marketing max-w-2xl text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
            One system from the booking link to the back office
          </h2>
          <p className="mt-3 max-w-xl text-[var(--ink-secondary)]">
            Built for real shops — your branding, plan, and customer data stay
            yours.
          </p>
          <ul className="mt-14 grid gap-10 sm:grid-cols-2">
            {capabilities.map((item, i) => (
              <li
                key={item.title}
                className="bf-marketing-item border-t border-[var(--border)] pt-6"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <h3 className="font-marketing text-xl font-semibold tracking-tight text-[var(--ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 leading-relaxed text-[var(--ink-secondary)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="how"
        className="relative overflow-hidden bg-[var(--bg)] py-20 sm:py-28"
      >
        <div
          className="pointer-events-none absolute top-10 -right-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, #e8f5f0 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <h2 className="font-marketing text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
            Live in three moves
          </h2>
          <p className="mt-3 max-w-lg text-[var(--ink-secondary)]">
            From a new business to accepting appointments, without needing a
            developer.
          </p>
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n}>
                <p className="font-marketing text-sm font-bold tracking-widest text-[var(--accent)]">
                  {step.n}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--ink)] py-20 text-white sm:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="font-marketing text-3xl font-bold tracking-tight sm:text-4xl">
              See a real booking end to end
            </h2>
            <p className="mt-3 text-white/70">
              Open the demo shop, pick a service, and take a time — then start
              your own business free.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              href="/book/bookflow"
              variant="secondary"
              className="h-11 border-0 bg-white px-5 !text-zinc-900 hover:bg-zinc-100 hover:!text-zinc-900"
            >
              Open demo booking
            </ButtonLink>
            <ButtonLink
              href="/sign-up"
              variant="ghost"
              className="h-11 px-5 text-white hover:bg-white/10 hover:text-white"
            >
              Create account
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
