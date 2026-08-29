/** Same-origin relative paths only. Used after Clerk sign-in/up. */
export function safeAuthRedirectPath(value: string | null | undefined) {
  if (!value) return "/dashboard";

  let path = value.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      const app = new URL(
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      );
      const host = url.hostname.toLowerCase();
      const appHost = app.hostname.toLowerCase();
      const local =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".localhost");
      if (host !== appHost && !local) return "/dashboard";
      path = `${url.pathname}${url.search}`;
    } catch {
      return "/dashboard";
    }
  }

  if (!path.startsWith("/")) return "/dashboard";
  if (path.startsWith("//")) return "/dashboard";
  if (path.includes("\\")) return "/dashboard";
  return path;
}
