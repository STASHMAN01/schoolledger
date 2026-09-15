import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Small shared UI primitives so every page in the app renders the same
// buttons, cards, inputs and badges instead of each page hand-rolling its
// own Tailwind classes — that drift is exactly how an app ends up looking
// inconsistent page to page. Keep these dumb and presentational; pages own
// all state/logic.

// Buttons get a small hover lift + press-down (motion-safe only, and
// skipped whenever disabled) — real feedback that a control is
// interactive, not just a color swap. `disabled:transform-none` keeps a
// disabled button inert even if a parent still triggers :hover.
const MOTION = "motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 disabled:transform-none";

const buttonVariants = {
  primary: `bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-50 disabled:pointer-events-none ${MOTION}`,
  secondary: `bg-surface text-foreground border border-border-strong hover:bg-background disabled:opacity-50 disabled:pointer-events-none ${MOTION}`,
  ghost: `text-foreground hover:bg-background disabled:opacity-50 disabled:pointer-events-none ${MOTION}`,
  danger: `bg-danger text-danger-foreground hover:brightness-95 disabled:opacity-50 disabled:pointer-events-none ${MOTION}`,
} as const;

const buttonSizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={`transition-standard inline-flex items-center justify-center gap-2 rounded-lg font-medium ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`transition-standard inline-flex items-center justify-center gap-2 rounded-lg font-medium ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({
  className = "",
  as = "div",
  ...props
}: ComponentProps<"div"> & { as?: "div" | "button" }) {
  const Comp = as as "div";
  return (
    <Comp
      className={`rounded-xl border border-border bg-surface shadow-sm ${className}`}
      {...(props as ComponentProps<"div">)}
    />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return (
    <label
      className={`text-sm font-medium text-muted-foreground ${className}`}
      {...props}
    />
  );
}

const badgeVariants = {
  neutral: "bg-background text-muted-foreground border-border-strong",
  brand: "bg-brand-soft text-brand-soft-foreground border-transparent",
  accent: "bg-accent-soft text-accent-soft-foreground border-transparent",
  success: "bg-success-soft text-success border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
} as const;

export function Badge({
  variant = "neutral",
  className = "",
  children,
}: {
  variant?: keyof typeof badgeVariants;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeVariants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// A collapsible section for long settings-style forms — closed by default
// so a page reads as a list of named buttons to open rather than one long
// scroll of fields the visitor has to hunt through. Built on native
// <details>/<summary> (same pattern as the "Settings" nav dropdown) so it
// needs no JS state and stays keyboard/screen-reader accessible for free.
export function Disclosure({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border bg-surface"
    >
      <summary className="transition-standard flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-background">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <svg
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-border px-5 py-5">{children}</div>
    </details>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-in flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
      <p className="font-display text-base font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
