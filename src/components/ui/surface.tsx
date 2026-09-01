import type { ComponentProps } from "react";

type Props = ComponentProps<"div"> & {
  padding?: "none" | "sm" | "md";
};

const pad = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

export function Surface({ className = "", padding = "md", ...props }: Props) {
  return (
    <div
      className={`rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${pad[padding]} ${className}`}
      {...props}
    />
  );
}
