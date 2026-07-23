import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";

import { AppClerkProvider } from "@/components/providers/clerk-provider";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BookFlow AI",
    template: "%s · BookFlow AI",
  },
  description:
    "AI-powered booking and business management for barbers, salons, and service businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} min-h-screen font-sans antialiased`}
      >
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
