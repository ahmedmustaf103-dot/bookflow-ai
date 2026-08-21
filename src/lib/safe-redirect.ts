/** Same-origin relative paths only. Used after Clerk sign-in/up. */
export function safeAuthRedirectPath(value: string | null | undefined) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  if (value.includes("\\")) return "/dashboard";
  return value;
}
