import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getActiveOrganization } from "@/server/tenant/context";

export default async function OnboardingPage() {
  await auth.protect();

  const ctx = await getActiveOrganization();
  if (ctx.organization) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="bf-page-enter">
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
          Get started
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Set up your business
        </h1>
        <p className="mt-3 text-sm text-[var(--ink-secondary)]">
          Two quick steps — then you&apos;re live with a booking page.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
