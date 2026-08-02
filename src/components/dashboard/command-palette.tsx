"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Kbd } from "@/components/ui/kbd";

type NavItem = { href: string; label: string };

export function CommandPalette({ nav }: { nav: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("bookflow:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("bookflow:command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nav;
    return nav.filter((item) => item.label.toLowerCase().includes(q));
  }, [nav, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <span className="text-[var(--ink-tertiary)]" aria-hidden>
            ⌕
          </span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[var(--ink-tertiary)]"
            aria-label="Search navigation"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox">
          {results.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className="flex w-full items-center rounded-[var(--radius-control)] px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[var(--ink-tertiary)]">
              No matches
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
