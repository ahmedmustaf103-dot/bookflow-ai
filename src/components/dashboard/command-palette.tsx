"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Kbd } from "@/components/ui/kbd";

type NavItem = { href: string; label: string };

const RECENT_KEY = "bf_cmd_recent";

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  try {
    const next = [href, ...readRecent().filter((h) => h !== href)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function CommandPalette({ nav }: { nav: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

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
    if (!open) {
      setQuery("");
      setActive(0);
      return;
    }
    setRecent(readRecent());
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? nav
      : nav.filter((item) => item.label.toLowerCase().includes(q));

    if (!q && recent.length > 0) {
      const recentItems = recent
        .map((href) => nav.find((n) => n.href === href))
        .filter(Boolean) as NavItem[];
      const rest = filtered.filter((n) => !recent.includes(n.href));
      return [...recentItems, ...rest];
    }
    return filtered;
  }, [nav, query, recent]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(href: string) {
    pushRecent(href);
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bf-dialog-enter w-full max-w-lg overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <span className="text-[var(--ink-tertiary)]" aria-hidden>
            ⌕
          </span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active]!.href);
              }
            }}
            placeholder="Jump to…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[var(--ink-tertiary)]"
            aria-label="Search navigation"
            aria-controls="cmd-results"
            aria-activedescendant={
              results[active] ? `cmd-${results[active]!.href}` : undefined
            }
          />
          <Kbd>esc</Kbd>
        </div>
        <ul
          id="cmd-results"
          className="max-h-72 overflow-y-auto p-1.5"
          role="listbox"
        >
          {results.map((item, i) => (
            <li key={item.href} role="option" aria-selected={i === active}>
              <button
                id={`cmd-${item.href}`}
                type="button"
                className={`flex w-full items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors ${
                  i === active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--ink)] hover:bg-[var(--muted)]"
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
              >
                <span>{item.label}</span>
                {!query && recent.includes(item.href) && i < recent.length ? (
                  <span className="text-[10px] text-[var(--ink-tertiary)] uppercase">
                    Recent
                  </span>
                ) : null}
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
