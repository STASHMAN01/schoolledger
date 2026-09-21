"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useOrg } from "./OrgContext";

// Accounting mode's nav -- everything that was on the single dashboard
// nav before the Phase 1 mode-switch restructure, now scoped under
// /dashboard/accounting. Centre Management has no sub-nav yet (Phase 1
// gives it one page); it'll get its own LINKS list here once Phase 2+
// gives it more than one page to link between.
const ACCOUNTING_LINKS = [
  { href: "/dashboard/accounting", label: "Home", exact: true },
  { href: "/dashboard/accounting/children", label: "Children" },
  { href: "/dashboard/accounting/payments", label: "Payments" },
  { href: "/dashboard/accounting/categories", label: "Classes" },
  { href: "/dashboard/accounting/events", label: "Events" },
  { href: "/dashboard/accounting/reminders", label: "Reminders" },
];

const SETTINGS_LINKS = [
  { href: "/dashboard/accounting/settings/general", label: "General" },
  { href: "/dashboard/accounting/settings/payment-types", label: "Payment types" },
  { href: "/dashboard/accounting/settings/team", label: "Team" },
  { href: "/dashboard/accounting/settings/activity", label: "Activity log" },
  { href: "/dashboard/accounting/settings/trash", label: "Trash" },
  { href: "/dashboard/accounting/settings/billing", label: "Billing" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function NavLinks() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { permissions } = useOrg();
  // Centre Management has nothing to link between yet (Phase 1: one
  // page). Nav (and the Settings dropdown, which is Accounting-only --
  // billing, team, payment types) only renders in Accounting mode.
  const inAccounting = pathname.startsWith("/dashboard/accounting");

  // Native <details> has no click-outside-to-close behavior, which Dylan
  // flagged as a bug (clicking anywhere else left the Settings menu open).
  // This listens for any pointerdown outside the menu and closes it, and
  // also closes on route change / Escape for good measure.
  useEffect(() => {
    if (!settingsOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  // Note: no separate "close on route change" effect — each link inside
  // the menu already closes it directly via its own onClick (see below),
  // and adding a pathname-watching effect just to call setState is an
  // anti-pattern (cascading renders) for no extra benefit here.
  const adminOnlySettings = [
    "/dashboard/accounting/settings/billing",
    "/dashboard/accounting/settings/team",
    "/dashboard/accounting/settings/trash",
  ];
  const settingsVisible = SETTINGS_LINKS.filter(
    (l) => permissions.includes("MANAGE_TEAM") || !adminOnlySettings.includes(l.href)
  );

  if (!inAccounting) return null;

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        {ACCOUNTING_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`transition-standard rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(pathname, l.href, l.exact)
                ? "bg-brand-soft text-brand-soft-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        ))}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className={`transition-standard flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
              pathname.startsWith("/dashboard/accounting/settings")
                ? "bg-brand-soft text-brand-soft-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            Settings
            <svg
              className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
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
          </button>
          {settingsOpen && (
            <div className="animate-in absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
              {settingsVisible.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setSettingsOpen(false)}
                  className={`block px-3 py-2 text-sm ${
                    isActive(pathname, l.href)
                      ? "bg-brand-soft text-brand-soft-foreground"
                      : "text-foreground hover:bg-background"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <button
        type="button"
        aria-label="Toggle menu"
        onClick={() => setMobileOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-background md:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {mobileOpen ? (
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M3 5.5h14M3 10h14M3 14.5h14"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="animate-in absolute inset-x-0 top-full z-20 border-b border-border bg-surface px-4 py-3 shadow-lg md:hidden">
          <div className="flex flex-col gap-1">
            {[...ACCOUNTING_LINKS, ...settingsVisible].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(pathname, l.href, "exact" in l ? Boolean(l.exact) : false)
                    ? "bg-brand-soft text-brand-soft-foreground"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
