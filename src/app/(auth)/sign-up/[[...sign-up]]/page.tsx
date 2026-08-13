import { SignUp } from "@clerk/nextjs";

import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";

export default function SignUpPage() {
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
  return <SignUp fallbackRedirectUrl="/dashboard" signInUrl="/sign-in" />;
}
