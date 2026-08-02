"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Surface } from "@/components/ui/surface";
import { fireConfetti } from "@/lib/confetti";

type Props = {
  orgId: string;
  hasServices: boolean;
  hasResources: boolean;
  hasBookings: boolean;
  bookPath: string;
};

export function SetupChecklist({
  orgId,
  hasServices,
  hasResources,
  hasBookings,
  bookPath,
}: Props) {
  const shareKey = `bf_link_shared_${orgId}`;
  const celebKey = `bf_setup_celebrated_${orgId}`;
  const [shared, setShared] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setShared(localStorage.getItem(shareKey) === "1");
      setDismissed(localStorage.getItem(celebKey) === "1");
    } catch {
      // ignore
    }
  }, [shareKey, celebKey]);

  useEffect(() => {
    function onStorage() {
      try {
        setShared(localStorage.getItem(shareKey) === "1");
      } catch {
        // ignore
      }
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("bookflow:link-shared", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bookflow:link-shared", onStorage);
    };
  }, [shareKey]);

  const items = [
    {
      id: "services",
      label: "Review your services",
      done: hasServices,
      href: "/dashboard/services",
    },
    {
      id: "staff",
      label: "Confirm staff & hours",
      done: hasResources,
      href: "/dashboard/availability",
    },
    {
      id: "share",
      label: "Share your booking link",
      done: shared,
      href: bookPath,
    },
    {
      id: "booking",
      label: "Get your first booking",
      done: hasBookings,
      href: bookPath,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const complete = doneCount === items.length;

  useEffect(() => {
    if (!complete || dismissed) return;
    try {
      if (localStorage.getItem(celebKey) === "1") return;
      localStorage.setItem(celebKey, "1");
      fireConfetti();
      setDismissed(true);
    } catch {
      // ignore
    }
  }, [complete, dismissed, celebKey]);

  if (complete && dismissed) return null;
  if (complete) return null;

  return (
    <Surface className="mb-6 bf-page-enter">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
            Getting started
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {doneCount} of {items.length} complete
          </p>
        </div>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="bf-row-hover flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-sm hover:bg-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  item.done
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border border-[var(--border-strong)] text-[var(--ink-tertiary)]"
                }`}
                aria-hidden
              >
                {item.done ? "✓" : ""}
              </span>
              <span
                className={
                  item.done
                    ? "text-[var(--ink-tertiary)] line-through"
                    : "text-[var(--ink)]"
                }
              >
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

export function markBookingLinkShared(orgId: string) {
  try {
    localStorage.setItem(`bf_link_shared_${orgId}`, "1");
    window.dispatchEvent(new Event("bookflow:link-shared"));
  } catch {
    // ignore
  }
}
