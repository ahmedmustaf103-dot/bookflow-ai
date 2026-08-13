"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";

const appearance = {
  variables: {
    colorPrimary: "#0f6e56",
    colorText: "#0a0a0a",
    colorBackground: "#ffffff",
    borderRadius: "0.375rem",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-none border border-[var(--border)]",
    formButtonPrimary:
      "bg-[var(--accent)] hover:bg-[var(--accent-hover)] normal-case",
  },
} as const;

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  if (clerkPublishableKeyIsPlaceholder()) {
    return children;
  }
  return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
}
