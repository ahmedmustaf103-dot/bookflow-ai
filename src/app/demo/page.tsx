import Link from "next/link";

import { EnterDemoForm } from "@/app/demo/enter-demo-form";
import { ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { onboardingCopy } from "@/lib/onboarding/copy";
import { getOptionalClerkUserId } from "@/server/auth/clerk-id";

export const metadata = {
  title: "Try the Demo",
  description:
    "Explore a sample BookFlow business and see how the dashboard works.",
};

export default async function DemoEntryPage() {
  const userId = await getOptionalClerkUserId();
  const copy = onboardingCopy.tryDemo;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
        {copy.kicker}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)]">
        {userId ? copy.signedInTitle : copy.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
        {userId ? copy.signedInBody : copy.body}
      </p>

      {userId ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/dashboard">{copy.dashboard}</ButtonLink>
          <ButtonLink href="/book/bookflow-demo" variant="secondary">
            {copy.book}
          </ButtonLink>
        </div>
      ) : (
        <Surface className="mt-8">
          <EnterDemoForm />
          <p className="mt-3 text-center text-xs text-[var(--ink-tertiary)]">
            Or{" "}
            <Link href="/book/bookflow-demo" className="underline">
              {copy.book}
            </Link>{" "}
            as a customer.
          </p>
        </Surface>
      )}
    </div>
  );
}
