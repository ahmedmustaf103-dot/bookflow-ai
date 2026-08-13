/** True only in isolated CI/E2E builds that use dummy Clerk keys. */
export function clerkPublishableKeyIsPlaceholder() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  return key.includes("placeholder") || key === "pk_test_ci";
}

export function clerkKeysArePlaceholders() {
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  return (
    clerkPublishableKeyIsPlaceholder() ||
    secret.includes("placeholder") ||
    secret === "sk_test_ci"
  );
}
