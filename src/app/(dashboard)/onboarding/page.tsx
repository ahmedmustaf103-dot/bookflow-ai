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
      <div>
        <p className="text-sm font-medium tracking-[0.16em] text-[var(--color-accent)] uppercase">
          Get started
        </p>
        <h1 className="font-display mt-2 text-4xl tracking-tight">
          Set up your business
        </h1>
        <p className="mt-3 text-[var(--color-ink)]/70">
          Pick your business type, then we&apos;ll create your organization, a
          main location, default hours, and starter services.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
