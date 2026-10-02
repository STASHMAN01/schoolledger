import type { ReactNode } from "react";

/**
 * The real Crechely chrome, redrawn.
 *
 * This exists because of a mistake worth not repeating: the first animated
 * panels on the homepage copied the chrome of the reference concept Dylan
 * was shown — a dark navy sidebar and browser window dots. Crechely has no
 * sidebar. It is a top-nav app: a mode switch and the school name on the
 * first row, page tabs on the second, light surfaces, and cards with a
 * solid blue header bar. Advertising a different interface to the one
 * someone gets after signing up is the kind of thing that costs a sale on
 * day one, and Dylan caught it before it went out (2 Oct 2026).
 *
 * Everything below is matched against the captured screenshots in
 * scratchpad/screenshots-raw. If the app's chrome changes, this has to
 * change with it — or go back to being a plain screenshot.
 */

const NAV = ["Home", "Children", "Payments", "Classes", "Events", "Reminders"] as const;

export function AppFrame({
  tab,
  children,
}: {
  tab: (typeof NAV)[number];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-background shadow-[var(--shadow-lift)]">
      {/* Row 1: mode switch, school, utilities. */}
      <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <span className="whitespace-nowrap rounded-md px-1.5 py-1 text-[9px] font-medium text-muted-foreground">
              Centre Management
            </span>
            <span className="whitespace-nowrap rounded-md bg-brand px-1.5 py-1 text-[9px] font-semibold text-brand-foreground">
              Accounting
            </span>
          </div>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-brand text-[8px] font-bold text-brand-foreground">
            S
          </span>
          <span className="truncate font-display text-[11px] font-semibold text-foreground">
            School Demo
          </span>
        </div>
        <div className="hidden shrink-0 items-center gap-2.5 text-[9px] text-muted-foreground sm:flex">
          <span>Take a tour</span>
          <span>Support</span>
          <span>Log out</span>
        </div>
      </div>

      {/* Row 2: page tabs. */}
      <div className="flex min-w-0 items-center gap-0.5 overflow-hidden border-b border-border bg-surface px-2 py-1.5">
        {NAV.map((item) => (
          <span
            key={item}
            className={`whitespace-nowrap rounded-md px-1.5 py-1 text-[9px] ${
              item === tab
                ? "bg-brand-soft font-semibold text-brand-soft-foreground"
                : "text-muted-foreground"
            }`}
          >
            {item}
          </span>
        ))}
        <span className="whitespace-nowrap px-1.5 py-1 text-[9px] text-muted-foreground">
          Settings
        </span>
      </div>

      <div className="min-w-0 overflow-hidden p-3 sm:p-3.5">{children}</div>
    </div>
  );
}

/**
 * A stat tile: white card, solid blue header bar, big figure, small note.
 * This blue-header card is the most recognisable thing about the real
 * Accounting screen, so it is what the homepage should show.
 */
export function StatTile({
  label,
  value,
  note,
  noteTone,
  changed = false,
}: {
  label: string;
  value: string;
  note: string;
  noteTone?: "danger";
  changed?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <p className="bg-brand px-2 py-1 text-[9px] font-semibold text-brand-foreground">{label}</p>
      <div className="px-2 py-1.5">
        <p
          key={value}
          className={`font-display text-sm font-semibold text-foreground ${
            changed ? "demo-settle" : ""
          }`}
        >
          {value}
        </p>
        <p
          className={`mt-0.5 text-[8px] ${
            noteTone === "danger" ? "text-danger" : "text-muted-foreground"
          }`}
        >
          {note}
        </p>
      </div>
    </div>
  );
}

/**
 * The notification strip used by both demos.
 *
 * It sits in reserved space at the bottom of the panel rather than floating
 * over the content: an absolutely-positioned toast covered the very figures
 * the panel exists to show. The slot keeps its height whether or not a
 * message is in it, so nothing jumps when one appears.
 */
export function DemoToastSlot({ children }: { children?: ReactNode }) {
  return (
    <div className="mt-2 min-h-[26px]">
      {children ? (
        <p className="demo-toast rounded-lg bg-foreground px-2.5 py-1.5 text-[9px] font-medium text-background">
          {children}
        </p>
      ) : null}
    </div>
  );
}
