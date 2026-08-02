import { AppClerkProvider } from "@/components/providers/clerk-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppClerkProvider>
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        {children}
      </div>
    </AppClerkProvider>
  );
}
