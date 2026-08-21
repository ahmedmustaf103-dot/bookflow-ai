"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Surface } from "@/components/ui/surface";
import { fireConfetti } from "@/lib/confetti";
import {
  requiredSetupComplete,
  type SetupItem,
} from "@/server/onboarding/setup-items";

type Props = {
  orgId: string;
  items: SetupItem[];
  bookPath: string;
};

export function SetupChecklist({ orgId, items, bookPath }: Props) {
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

  const resolved = useMemo(
    () =>
      items.map((item) =>
        item.id === "link" ? { ...item, done: shared, href: bookPath } : item,
      ),
    [items, shared, bookPath],
  );

  const requiredDone = requiredSetupComplete(resolved);
  const optionalLeft = resolved.filter((i) => i.optional && !i.done);
  const doneCount = resolved.filter((i) => !i.optional && i.done).length;
  const requiredCount = resolved.filter((i) => !i.optional).length;

  useEffect(() => {
    if (!requiredDone || dismissed) return;
    try {
      if (localStorage.getItem(celebKey) === "1") return;
      localStorage.setItem(celebKey, "1");
      fireConfetti();
      setDismissed(true);
    } catch {
      // ignore
    }
  }, [requiredDone, dismissed, celebKey]);

  if (requiredDone && optionalLeft.length === 0) return null;

  if (requiredDone) {
    return (
      <Surface className="mb-6 bf-page-enter">
        <p className="text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
          Optional
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {optionalLeft.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="bf-row-hover flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
              >
                <span>{item.label}</span>
                <span className="text-[11px] font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
                  Not set up
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--ink-tertiary)]">
          Skip Google Calendar if you do not need appointments on your personal
          calendar. Bookings still work.
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="mb-6 bf-page-enter">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
            Getting started
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {doneCount} of {requiredCount} complete
          </p>
        </div>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${(doneCount / requiredCount) * 100}%` }}
          />
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {resolved.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="bf-row-hover flex items-center justify-between gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-sm hover:bg-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              <span className="flex items-center gap-2.5">
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
                      ? "text-[var(--ink-tertiary)]"
                      : "text-[var(--ink)]"
                  }
                >
                  {item.label}
                  {item.optional ? (
                    <span className="ml-1 text-[11px] uppercase">optional</span>
                  ) : null}
                </span>
              </span>
              <span
                className={`text-[11px] font-medium tracking-wide uppercase ${
                  item.done
                    ? "text-[var(--accent)]"
                    : "text-[var(--ink-tertiary)]"
                }`}
              >
                {item.done ? "Done" : "Not set up"}
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
