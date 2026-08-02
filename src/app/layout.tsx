import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "BookFlow AI",
    template: "%s · BookFlow AI",
  },
  description:
    "AI-powered booking and business management for barbers, salons, and service businesses.",
  openGraph: {
    title: "BookFlow AI",
    description:
      "AI-powered booking and business management for service businesses.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body
        className={`${GeistSans.className} min-h-screen font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
