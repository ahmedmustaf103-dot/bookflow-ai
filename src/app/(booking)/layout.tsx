import { ToastEventBridge, ToastProvider } from "@/components/ui/toast";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ToastEventBridge />
      {children}
    </ToastProvider>
  );
}
