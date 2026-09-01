"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { onboardingCopy, type TourStepDef } from "@/lib/onboarding/copy";
import {
  browserStorage,
  isTourCompleted,
  markTourCompleted,
} from "@/lib/onboarding/tour-storage";

export type ProductTourStep = TourStepDef;

type Hole = { top: number; left: number; width: number; height: number };

const PAD = 8;
const TOOLTIP_GAP = 12;
const VIEW_PAD = 16;

function isVisible(el: Element) {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  return true;
}

function findVisibleTarget(selector: string) {
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const node of nodes) {
    if (isVisible(node)) return node;
  }
  return null;
}

function holeFromRect(rect: DOMRect): Hole {
  const top = Math.max(VIEW_PAD / 2, rect.top - PAD);
  const left = Math.max(VIEW_PAD / 2, rect.left - PAD);
  const right = Math.min(window.innerWidth - VIEW_PAD / 2, rect.right + PAD);
  const bottom = Math.min(window.innerHeight - VIEW_PAD / 2, rect.bottom + PAD);
  return {
    top,
    left,
    width: Math.max(24, right - left),
    height: Math.max(24, bottom - top),
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ProductTour({
  storageKey,
  steps,
  enabled,
  onStepChange,
  onDismiss,
}: {
  storageKey: string;
  steps: readonly ProductTourStep[];
  enabled: boolean;
  onStepChange?: (index: number) => void;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const titleId = useId();
  const bodyId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 80, left: 16 });

  const finish = useCallback(() => {
    markTourCompleted(storageKey, browserStorage());
    setOpen(false);
    onDismiss?.();
  }, [onDismiss, storageKey]);

  useEffect(() => {
    setMounted(true);
    if (!enabled) return;
    if (isTourCompleted(storageKey, browserStorage())) return;
    setOpen(true);
    setIndex(0);
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!open) return;
    onStepChange?.(index);
  }, [index, open, onStepChange]);

  const updateHole = useCallback(() => {
    const step = steps[index];
    if (!step || !open) return;
    const el = findVisibleTarget(step.target);
    if (el) {
      setHole(holeFromRect(el.getBoundingClientRect()));
    } else {
      setHole(null);
    }
  }, [index, open, steps]);

  const measure = useCallback(async () => {
    const step = steps[index];
    if (!step || !open) return;

    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) {
      window.dispatchEvent(
        new Event(
          step.openNav ? "bookflow:open-mobile-nav" : "bookflow:close-mobile-nav",
        ),
      );
      await new Promise((r) => window.setTimeout(r, 80));
    }

    const visible = findVisibleTarget(step.target);
    const any = document.querySelector<HTMLElement>(step.target);
    if (!any && step.href && pathname !== step.href) {
      router.push(step.href);
      return;
    }

    const el = visible ?? any;
    if (el) {
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      await new Promise((r) =>
        window.setTimeout(r, prefersReducedMotion() ? 0 : 80),
      );
    }
    updateHole();
  }, [index, open, pathname, router, steps, updateHole]);

  useLayoutEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void measure();
    }, 50);
    return () => window.clearTimeout(t);
  }, [measure, open, pathname, index]);

  useEffect(() => {
    if (!open) return;
    function onWin() {
      updateHole();
    }
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updateHole]);

  useLayoutEffect(() => {
    if (!open) return;
    const tip = tooltipRef.current;
    if (!tip) return;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    if (hole) {
      const below = hole.top + hole.height + TOOLTIP_GAP;
      const above = hole.top - th - TOOLTIP_GAP;
      top = below + th + VIEW_PAD <= vh ? below : Math.max(VIEW_PAD, above);
      left = hole.left + hole.width / 2 - tw / 2;
    } else {
      top = Math.max(VIEW_PAD, (vh - th) / 2);
      left = Math.max(VIEW_PAD, (vw - tw) / 2);
    }

    left = Math.min(Math.max(VIEW_PAD, left), vw - tw - VIEW_PAD);
    top = Math.min(Math.max(VIEW_PAD, top), vh - th - VIEW_PAD);
    setTooltipPos({ top, left });
  }, [hole, index, open]);

  useEffect(() => {
    if (!open) return;
    const first = tooltipRef.current?.querySelector<HTMLButtonElement>("button");
    first?.focus();
  }, [index, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, open]);

  if (!mounted || !open || steps.length === 0) return null;

  const step = steps[index]!;
  const last = index === steps.length - 1;
  const copy = onboardingCopy.common;
  const dim = "fixed z-[80] bg-[var(--ink)]/55";

  const overlay = (
    <div className="contents">
      {hole ? (
        <>
          <div
            className={dim}
            style={{ top: 0, left: 0, right: 0, height: hole.top }}
            aria-hidden
          />
          <div
            className={dim}
            style={{
              top: hole.top + hole.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            aria-hidden
          />
          <div
            className={dim}
            style={{
              top: hole.top,
              left: 0,
              width: hole.left,
              height: hole.height,
            }}
            aria-hidden
          />
          <div
            className={dim}
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed z-[81] rounded-[var(--radius-panel)] ring-2 ring-white ring-offset-2 ring-offset-transparent"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
            aria-hidden
          />
        </>
      ) : (
        <div className={`${dim} inset-0`} aria-hidden />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="fixed z-[90] max-h-[min(70vh,24rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <p className="text-[11px] font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
          {copy.stepOf(index + 1, steps.length)}
        </p>
        <h2 id={titleId} className="mt-1 text-base font-semibold text-[var(--ink)]">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
          {step.body}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 sm:h-8"
            onClick={finish}
            aria-label={copy.close}
          >
            {copy.skip}
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-11 min-w-[5.5rem] sm:h-8"
            onClick={() => {
              if (last) {
                finish();
                return;
              }
              setIndex((i) => i + 1);
            }}
          >
            {last ? copy.done : copy.next}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
