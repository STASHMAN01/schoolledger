// What a Teacher may do in the app (Dylan, 4 Oct 2026). A teacher's job
// here is: mark the register, look at the routine and lesson plan,
// record classwork, write incident reports, and see the children in their own class -- name, class,
// gender, age, allergies and emergency contact only. Everything else
// (forms, admissions, documents, files, classes, staff, communication,
// settings, money, parent details) is admin work.
//
// This is enforced on the SERVER, for every Teacher (tablet profiles and
// email logins alike), whatever per-person ticks an admin has set:
//  - teacherMayCall: requireMembership refuses any API call not listed
//    here (default-deny, so a new endpoint is closed to teachers until it
//    is deliberately added);
//  - TEACHER_PERMISSION_CEILING: the most a Teacher's permissions can be;
//  - TEACHER_PAGES: the Centre pages their menu shows (and the page guard
//    sends them back home from anything else).
//
// No imports on purpose: middleware-adjacent code may load this.

/** The most a Teacher can ever hold, whatever overrides exist. */
export const TEACHER_PERMISSION_CEILING = ["VIEW_CENTRE", "MANAGE_ATTENDANCE", "MANAGE_REPORTS"] as const;

/** Report types a Teacher may write (and read). */
export const TEACHER_REPORT_TYPES = ["INCIDENT"] as const;

const ID = "[^/]+";

// [method, path after /api/organizations/<orgId>]
const ALLOWED: [string, RegExp][] = [
  ["GET", /^\/categories$/], // class names only (fees are blanked without VIEW_MONEY)
  ["GET", /^\/children$/], // own class, trimmed by serializeChildForTeacher
  ["GET", new RegExp(`^/children/${ID}$`)], // same
  ["GET", /^\/attendance\/register$/],
  ["POST", /^\/attendance\/register$/], // same-day only, checked in the route
  ["GET", /^\/attendance\/summary$/],
  ["GET", /^\/events\/upcoming$/],
  ["GET", /^\/schedule$/],
  ["POST", /^\/schedule\/acknowledge$/],
  ["GET", /^\/reports$/], // incident reports only, checked in the route
  ["POST", /^\/reports$/], // new incident reports only
  ["GET", new RegExp(`^/reports/${ID}$`)],
  ["GET", new RegExp(`^/reports/${ID}/pdf$`)],
  ["GET", /^\/todos$/],
  ["POST", /^\/tour$/], // "seen the walkthrough"
  ["GET", /^\/daily-summary$/], // own class's end-of-day summary
  ["POST", /^\/daily-summary$/],
  ["GET", /^\/lesson-plans$/], // own class's lesson plan, read-only
  ["GET", /^\/classwork$/], // own class's classwork
  ["POST", /^\/classwork$/], // add an entry for today
  ["GET", /^\/tasks$/], // tasks assigned to their own class
  ["POST", new RegExp(`^/tasks/${ID}/acknowledge$`)],
  ["POST", new RegExp(`^/tasks/${ID}/complete$`)],
];

/** The part of an API path after /api/organizations/<orgId>, or null. */
export function orgApiSubpath(path: string): string | null {
  const m = /^\/api\/organizations\/[^/]+(\/.*)?$/.exec(path.split("?")[0]);
  if (!m) return null;
  return (m[1] ?? "/").replace(/\/+$/, "") || "/";
}

export function teacherMayCall(method: string, path: string): boolean {
  const sub = orgApiSubpath(path);
  // Not an organization API path (e.g. a server-rendered page calling
  // requireMembership): nothing to check here.
  if (sub === null) return true;
  const m = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  return ALLOWED.some(([am, re]) => am === m && re.test(sub));
}

/** Centre pages a Teacher may open (exact page or anything below it). */
export const TEACHER_PAGES = [
  "/dashboard/centre",
  "/dashboard/centre/enrolled",
  "/dashboard/centre/children",
  "/dashboard/centre/attendance",
  "/dashboard/centre/reports",
  "/dashboard/centre/schedule",
  "/dashboard/centre/events",
  "/dashboard/centre/daily-summary",
  "/dashboard/centre/lesson-plan",
  "/dashboard/centre/classwork",
  "/dashboard/centre/tasks",
];

export function teacherMayOpen(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/centre") return true;
  // The absent-children page shows parents' contact details: admin only.
  if (pathname.startsWith("/dashboard/centre/attendance/absent")) return false;
  return TEACHER_PAGES.some((p) => p !== "/dashboard/centre" && (pathname === p || pathname.startsWith(p + "/")));
}
