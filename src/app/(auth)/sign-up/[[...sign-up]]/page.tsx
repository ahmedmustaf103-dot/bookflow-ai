import { SignUp } from "@clerk/nextjs";

import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";
import { safeAuthRedirectPath } from "@/lib/safe-redirect";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const after = safeAuthRedirectPath(redirect_url);

  if (clerkPublishableKeyIsPlaceholder()) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold">Create an account</h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          Sign-up is unavailable in this environment.
        </p>
      </div>
    );
  }
  return (
    <SignUp
      fallbackRedirectUrl={after}
      signInUrl={`/sign-in?redirect_url=${encodeURIComponent(after)}`}
    />
  );
}
