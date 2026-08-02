import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90",
  secondary:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-muted)]",
  ghost: "text-[var(--color-ink)] hover:bg-[var(--color-muted)]",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
};

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
