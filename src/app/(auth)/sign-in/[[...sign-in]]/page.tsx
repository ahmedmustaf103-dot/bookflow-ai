import { SignIn } from "@clerk/nextjs";

import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";

export default function SignInPage() {
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
  return <SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" />;
}
