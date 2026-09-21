"use client";

// Top-left mode switch between Centre Management and Accounting (Phase 1
// centre-management restructure). "Top-left" per the plan -- this is
// rendered as the leftmost element in the dashboard header, ahead of the
// org logo/name, since it's now the primary way of moving around the app.
//
// Persistence: a plain (non-httpOnly) cookie, since this is only a UI
// preference (which mode /dashboard redirects to next time), never
// anything sensitive. Read server-side by src/app/dashboard/page.tsx.
import { usePathname, useRouter } from "next/navigation";

export const MODE_COOKIE = "crechely-mode";

type Mode = "accounting" | "centre";

function modeFromPathname(pathname: string): Mode {
  return pathname.startsWith("/dashboard/centre") ? "centre" : "accounting";
}

function setModeCookie(mode: Mode) {
  // 1 year, path-scoped to the whole app (not just /dashboard) so it's
  // still there if we ever read it from outside /dashboard.
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function ModeSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const mode = modeFromPathname(pathname);

  function go(next: Mode) {
    if (next === mode) return;
    setModeCookie(next);
    router.push(next === "accounting" ? "/dashboard/accounting" : "/dashboard/centre");
  }

  return (
    <div
      role="tablist"
      aria-label="Mode"
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 text-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "centre"}
        title="Centre Management"
        onClick={() => go("centre")}
        className={`transition-standard rounded-md px-2.5 py-1.5 font-medium sm:px-3 ${
          mode === "centre"
            ? "bg-brand text-brand-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="sm:hidden">Centre</span>
        <span className="hidden sm:inline">Centre Management</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "accounting"}
        onClick={() => go("accounting")}
        className={`transition-standard rounded-md px-2.5 py-1.5 font-medium sm:px-3 ${
          mode === "accounting"
            ? "bg-brand text-brand-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Accounting
      </button>
    </div>
  );
}
