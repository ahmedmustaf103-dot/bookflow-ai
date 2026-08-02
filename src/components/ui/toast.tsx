"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<ToastTone, string> = {
  success: "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]",
  error: "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto bf-toast-enter rounded-[var(--radius-panel)] border px-3.5 py-2.5 text-sm shadow-[var(--shadow-sm)] ${toneClass[item.tone]}`}
            role={item.tone === "error" ? "alert" : "status"}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{item.message}</p>
              <button
                type="button"
                className="text-xs opacity-60 hover:opacity-100"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (() => undefined) as ToastContextValue["toast"],
    };
  }
  return ctx;
}

/** Optional: listen for custom events from non-React code */
export function ToastEventBridge() {
  const { toast } = useToast();
  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<{ message: string; tone?: ToastTone }>)
        .detail;
      if (detail?.message) toast(detail.message, detail.tone ?? "info");
    }
    window.addEventListener("bookflow:toast", onToast);
    return () => window.removeEventListener("bookflow:toast", onToast);
  }, [toast]);
  return null;
}
