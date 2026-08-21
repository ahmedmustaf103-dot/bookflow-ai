import { SignIn } from "@clerk/nextjs";

import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";
import { safeAuthRedirectPath } from "@/lib/safe-redirect";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const after = safeAuthRedirectPath(redirect_url);

  if (clerkPublishableKeyIsPlaceholder()) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          Sign-in is unavailable in this environment.
        </p>
      </div>
    );
  }
  return (
    <SignIn
      fallbackRedirectUrl={after}
      signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(after)}`}
    />
  );
}
