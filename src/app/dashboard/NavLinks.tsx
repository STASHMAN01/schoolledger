"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useOrg } from "./OrgContext";

const LINKS = [
  { href: "/dashboard", label: "Home", exact: true },
  { href: "/dashboard/children", label: "Children" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/reminders", label: "Reminders" },
];

const SETTINGS_LINKS = [
  { href: "/dashboard/settings/general", label: "General" },
  { href: "/dashboard/settings/payment-types", label: "Payment types" },
  { href: "/dashboard/settings/team", label: "Team" },
  { href: "/dashboard/settings/activity", label: "Activity log" },
  { href: "/dashboard/settings/billing", label: "Billing" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function NavLinks() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useOrg();
  const settingsVisible = SETTINGS_LINKS.filter(
    (l) => role === "ADMIN" || (l.href !== "/dashboard/settings/billing" && l.href !== "/dashboard/settings/team")
  );

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
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
        <div className="relative">
          <details className="group">
            <summary
              className={`transition-standard flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
                pathname.startsWith("/dashboard/settings")
                  ? "bg-brand-soft text-brand-soft-foreground"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              Settings
              <svg
                className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
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
            <div className="animate-in absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
              {settingsVisible.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
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
          </details>
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
            {[...LINKS, ...settingsVisible].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(pathname, l.href, "exact" in l ? l.exact : false)
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
