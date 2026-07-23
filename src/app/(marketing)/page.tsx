import { ButtonLink } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-16 pb-24">
      <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-accent)] uppercase">
        Booking OS for service businesses
      </p>
      <h1 className="font-display max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
        BookFlow AI
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-[var(--color-ink)]/75">
        AI-powered booking and operations for barbers and salons — built to
        expand to dentists, tutors, gyms, and any appointment-based business.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/sign-up">Create account</ButtonLink>
        <ButtonLink href="/sign-in" variant="secondary">
          Sign in
        </ButtonLink>
      </div>
      <p className="text-sm text-[var(--color-ink)]/50">
        Phase 0 foundation — auth, database, and app shell.
      </p>
    </section>
  );
}
