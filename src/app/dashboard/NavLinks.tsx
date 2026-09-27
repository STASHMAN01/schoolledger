"use client";

// Dashboard navigation. Reworked 23 Sept (Dylan: "the tabs are crashing
// into each other"):
//   - Row 1 of the header: mode switch far left, school name, then a small
//     utility cluster on the right (<UtilityLinks/>: Communication in
//     Centre mode, Platform, Support) plus theme and Log out.
//   - Row 2 (tablet/desktop only): the mode's main tabs (<NavBar/>), spread
//     out with room to wrap instead of overlapping.
//   - Phones: row 2 and the utility links live in the ☰ menu (<MobileMenu/>)
//     with full-size tap targets.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useOrg } from "./OrgContext";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavLink = { href: string; label: string; exact?: boolean };

const ACCOUNTING_LINKS: NavLink[] = [
  { href: "/dashboard/accounting", label: "Home", exact: true },
  { href: "/dashboard/accounting/children", label: "Children" },
  { href: "/dashboard/accounting/payments", label: "Payments" },
  { href: "/dashboard/accounting/classes", label: "Classes" },
  { href: "/dashboard/accounting/events", label: "Events" },
  { href: "/dashboard/accounting/reminders", label: "Reminders" },
];

// Centre Management, in the order of Dylan's mock-up (23 Sept). Children
// are reached through Enrolled/Admissions now (no separate tab), online
// submissions live inside Admissions, and Reports stays hidden until it's
// defined. Communication sits in the top-right utility cluster.
const CENTRE_LINKS: NavLink[] = [
  { href: "/dashboard/centre", label: "Home", exact: true },
  { href: "/dashboard/centre/forms", label: "Forms" },
  { href: "/dashboard/centre/enrolled", label: "Enrolled" },
  { href: "/dashboard/centre/admissions", label: "Admissions" },
  { href: "/dashboard/centre/attendance", label: "Attendance" },
  { href: "/dashboard/centre/classes", label: "Classes" },
  { href: "/dashboard/centre/schedule", label: "Timetable" },
  { href: "/dashboard/centre/events", label: "Events" },
  { href: "/dashboard/centre/staff", label: "Staff" },
];

const SETTINGS_LINKS: NavLink[] = [
  { href: "/dashboard/accounting/settings/general", label: "General" },
  { href: "/dashboard/accounting/settings/payment-types", label: "Payment types" },
  { href: "/dashboard/accounting/settings/team", label: "Team" },
  { href: "/dashboard/accounting/settings/activity", label: "Activity log" },
  { href: "/dashboard/accounting/settings/trash", label: "Trash" },
  { href: "/dashboard/accounting/settings/billing", label: "Billing" },
  { href: "/dashboard/accounting/settings/backup", label: "Backup & export" },
];

// Which permission(s) a nav link needs -- any one of them is enough. A
// link is hidden when its page would only show an error or "no
// permission" for this person (final inspection B1). Links not listed
// here are visible to everyone who can see the mode at all.
const LINK_REQUIRES: Record<string, string[]> = {
  "/dashboard/accounting/payments": ["VIEW_MONEY"],
  "/dashboard/accounting/events": ["VIEW_MONEY"],
  "/dashboard/accounting/reminders": ["VIEW_MONEY"],
  "/dashboard/centre/forms": ["MANAGE_CHILDREN"],
  "/dashboard/centre/attendance": ["MANAGE_ATTENDANCE"],
  "/dashboard/centre/staff": ["MANAGE_CLASSES", "MANAGE_TEAM"],
  "/dashboard/centre/communication": ["MANAGE_CHILDREN"],
  "/dashboard/accounting/settings/payment-types": ["MANAGE_SETTINGS"],
  "/dashboard/accounting/settings/team": ["MANAGE_TEAM"],
  "/dashboard/accounting/settings/billing": ["MANAGE_TEAM"],
  "/dashboard/accounting/settings/trash": ["MANAGE_TEAM"],
  "/dashboard/accounting/settings/activity": ["VIEW_ACTIVITY_LOG"],
  "/dashboard/accounting/settings/backup": ["EXPORT_DATA"],
};

function canSeeLink(href: string, permissions: readonly string[]): boolean {
  const needed = LINK_REQUIRES[href];
  return !needed || needed.some((p) => permissions.includes(p));
}

// Which of the guided walkthrough's steps a nav link is (see
// src/lib/tourSteps.ts). Only links not already covered by a dashboard
// tile need one.
const TOUR_ID: Record<string, string> = {
  "/dashboard/centre/forms": "nav-forms",
  "/dashboard/accounting/payments": "nav-payments",
  "/dashboard/accounting/classes": "nav-classes-accounting",
  "/dashboard/accounting/events": "nav-events-accounting",
};

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

function useNav() {
  const pathname = usePathname();
  const { permissions } = useOrg();
  const inAccounting = pathname.startsWith("/dashboard/accounting");
  const links = (inAccounting ? ACCOUNTING_LINKS : CENTRE_LINKS).filter((l) =>
    canSeeLink(l.href, permissions)
  );
  const settings = inAccounting ? SETTINGS_LINKS.filter((l) => canSeeLink(l.href, permissions)) : [];
  const communication: NavLink | null =
    !inAccounting && canSeeLink("/dashboard/centre/communication", permissions)
      ? { href: "/dashboard/centre/communication", label: "Communication" }
      : null;
  // Replays that mode's guided walkthrough -- the home page's mount effect
  // watches for ?tour=1 (see CentreManagementHomePage/AccountingHomePage).
  const tourHref = inAccounting ? "/dashboard/accounting?tour=1" : "/dashboard/centre?tour=1";
  return { pathname, links, settings, communication, tourHref };
}

const tabClass = (active: boolean) =>
  `transition-standard whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
    active
      ? "bg-brand-soft text-brand-soft-foreground"
      : "text-muted-foreground hover:bg-background hover:text-foreground"
  }`;

/** Row 2 of the header on tablet/desktop: the mode's main tabs. */
export function NavBar() {
  const { pathname, links, settings } = useNav();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close the Settings menu on an outside click or Escape.
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

  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5" aria-label="Main">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          data-tour={TOUR_ID[l.href]}
          className={tabClass(isActive(pathname, l.href, l.exact))}
        >
          {l.label}
        </Link>
      ))}
      {settings.length > 0 && (
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            data-tour="nav-settings"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className={`${tabClass(pathname.startsWith("/dashboard/accounting/settings"))} flex items-center gap-1`}
          >
            Settings
            <svg
              className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {settingsOpen && (
            <div className="animate-in absolute left-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
              {settings.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setSettingsOpen(false)}
                  className={`block px-3 py-2 text-sm ${
                    isActive(pathname, l.href) ? "bg-brand-soft text-brand-soft-foreground" : "text-foreground hover:bg-background"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

/** Top-right utility links on tablet/desktop (Communication, Platform, Support). */
export function UtilityLinks({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const { pathname, communication, tourHref } = useNav();
  const small = (active: boolean) =>
    `transition-standard hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium md:inline-flex ${
      active ? "bg-brand-soft text-brand-soft-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"
    }`;
  return (
    <>
      {communication && (
        <Link
          href={communication.href}
          data-tour="header-communication"
          className={small(isActive(pathname, communication.href))}
        >
          Communication
        </Link>
      )}
      {isPlatformAdmin && (
        <Link href="/platform" className={small(false)}>
          Platform
        </Link>
      )}
      <Link href={tourHref} title="Replay the guided walkthrough" className={small(false)}>
        Take a tour
      </Link>
      <Link
        href="/support"
        title="Support & how to use Crechely"
        data-tour="header-support"
        className={small(false)}
      >
        Support
      </Link>
    </>
  );
}

/** Phones: ☰ button + full menu (main tabs, settings, utility links). */
export function MobileMenu({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const { pathname, links, settings, communication, tourHref } = useNav();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on an outside tap or Escape (final inspection B6).
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Grouped so Settings items don't read as main pages (mobile pass).
  const groups: { label: string | null; items: NavLink[] }[] = [
    { label: null, items: [...links, ...(communication ? [communication] : [])] },
    ...(settings.length > 0 ? [{ label: "Settings", items: settings }] : []),
    {
      label: "More",
      items: [
        ...(isPlatformAdmin ? [{ href: "/platform", label: "Platform" }] : []),
        { href: tourHref, label: "Take a tour" },
        { href: "/support", label: "Support" },
      ],
    },
  ];

  return (
    <div ref={menuRef} className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-background"
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          ) : (
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div className="animate-in absolute inset-x-0 top-full z-30 max-h-[75vh] overflow-y-auto border-b border-border bg-surface px-4 py-3 shadow-lg">
          {groups.map((g) => (
            <div key={g.label ?? "main"} className={g.label ? "mt-2 border-t border-border pt-2" : ""}>
              {g.label && (
                <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</p>
              )}
              <div className="flex flex-col gap-1">
                {g.items.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center rounded-lg px-3 text-base font-medium ${
                      isActive(pathname, l.href, l.exact)
                        ? "bg-brand-soft text-brand-soft-foreground"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {/* Theme and Log out live here on phones (hidden from the
              header row there so the school name fits). */}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ThemeToggle />
              <span>Light / dark</span>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
