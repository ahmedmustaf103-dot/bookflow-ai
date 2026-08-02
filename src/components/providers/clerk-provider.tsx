"use client";

import { ClerkProvider } from "@clerk/nextjs";

const appearance = {
  variables: {
    colorPrimary: "#1F4B3A",
    colorText: "#1a1a1a",
    colorBackground: "#F7F4EF",
    borderRadius: "0.375rem",
    fontFamily: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-none border border-[var(--color-border)]",
    formButtonPrimary:
      "bg-[var(--color-accent)] hover:opacity-90 normal-case",
  },
} as const;

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
}
