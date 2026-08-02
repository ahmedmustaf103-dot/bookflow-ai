"use client";

import type { CSSProperties, ReactNode } from "react";

/** Stagger children entrance; no-op under reduced motion via CSS. */
export function Stagger({
  children,
  className = "",
  max = 6,
}: {
  children: ReactNode[];
  className?: string;
  max?: number;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <div
          key={i}
          className="bf-stagger-item"
          style={{ "--bf-i": Math.min(i, max) } as CSSProperties}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
