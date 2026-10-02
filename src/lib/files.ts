import type { Permission } from "@prisma/client";

// The Files section (Dylan, 2 Oct 2026): a folder view of every document
// the app produces, so a school owner on a phone can find "James's
// September statement" without hunting through child profiles.
//
//   Accounting:  Statements > September 2026 > Butterfly > James
//   Centre:      the same, plus enrolment forms, re-registration forms,
//                academic / incident / disciplinary reports and attendance
//                registers.
//
// Nothing here is stored separately: every folder is a view over data the
// app already keeps (FormDocument, ChildReport, AttendanceRecord and the
// audit log). This file holds the pure parts -- which folders exist, who
// may open them, and month maths -- so they can be tested without a
// database. The queries live in the /files API route.

export type FilesMode = "accounting" | "centre";

export const FOLDER_KEYS = [
  "statements",
  "enrolment",
  "re-registration",
  "academic",
  "incident",
  "disciplinary",
  "attendance",
] as const;
export type FolderKey = (typeof FOLDER_KEYS)[number];

export function isFolderKey(value: string | null | undefined): value is FolderKey {
  return !!value && (FOLDER_KEYS as readonly string[]).includes(value);
}

type FolderInfo = {
  label: string;
  hint: string;
  // Any one of these is enough -- the same permission the matching page
  // in the app already asks for, so Files never shows someone a document
  // they couldn't open from its own page.
  requires: Permission[];
  modes: FilesMode[];
};

export const FOLDERS: Record<FolderKey, FolderInfo> = {
  statements: {
    label: "Statements",
    hint: "Fee statements, by month and class.",
    requires: ["VIEW_MONEY"],
    modes: ["accounting", "centre"],
  },
  enrolment: {
    label: "Filled enrolment forms",
    hint: "Enrolment forms generated for each child.",
    requires: ["MANAGE_CHILDREN"],
    modes: ["centre"],
  },
  "re-registration": {
    label: "Filled re-registration forms",
    hint: "Re-registration forms generated for each child.",
    requires: ["MANAGE_CHILDREN"],
    modes: ["centre"],
  },
  academic: {
    label: "Academic reports",
    hint: "Term progress reports, by month and class.",
    requires: ["MANAGE_REPORTS"],
    modes: ["centre"],
  },
  incident: {
    label: "Incident reports",
    hint: "Injuries and accidents, by month and class.",
    requires: ["MANAGE_REPORTS"],
    modes: ["centre"],
  },
  disciplinary: {
    label: "Disciplinary reports",
    hint: "Behaviour reports, by month and class.",
    requires: ["MANAGE_REPORTS"],
    modes: ["centre"],
  },
  attendance: {
    label: "Attendance registers",
    hint: "A register for each class, month by month.",
    requires: ["MANAGE_ATTENDANCE"],
    modes: ["centre"],
  },
};

export function canSeeFolder(
  key: FolderKey,
  mode: FilesMode,
  permissions: readonly string[]
): boolean {
  const info = FOLDERS[key];
  return info.modes.includes(mode) && info.requires.some((p) => permissions.includes(p));
}

export function visibleFolders(mode: FilesMode, permissions: readonly string[]): FolderKey[] {
  return FOLDER_KEYS.filter((k) => canSeeFolder(k, mode, permissions));
}

// The permission needed to open Files at all in each mode -- the same one
// the mode switch uses.
export const MODE_PERMISSION: Record<FilesMode, Permission> = {
  accounting: "VIEW_ACCOUNTING",
  centre: "VIEW_CENTRE",
};

export function isFilesMode(value: string | null | undefined): value is FilesMode {
  return value === "accounting" || value === "centre";
}

// ---------------------------------------------------------------- months

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string | null | undefined): value is string {
  return !!value && MONTH_KEY.test(value);
}

export function monthLabel(key: string): string {
  const m = MONTH_KEY.exec(key);
  if (!m) return key;
  return `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}`;
}

export function monthShort(key: string): string {
  const m = MONTH_KEY.exec(key);
  return m ? MONTH_SHORT[Number(m[2]) - 1] : key;
}

export function monthYear(key: string): number {
  const m = MONTH_KEY.exec(key);
  return m ? Number(m[1]) : new Date().getFullYear();
}

// The "YYYY-MM" an instant falls in, as seen on a wall clock in `timeZone`
// (a school's timezone, Organization.timezone). Matters at month ends: a
// statement made at 23:30 in Johannesburg on 30 September is still
// September for the school, even though it is 21:30 UTC.
export function monthKeyOf(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

// Attendance (and the other date-only fields in this app) are stored as
// midnight UTC of the intended calendar day, so their month is simply the
// UTC one -- applying a timezone would only risk shifting the 1st.
export function monthKeyOfDateOnly(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// [start, end) of a calendar month on the school's wall clock, as UTC
// instants, for database range filters.
export function monthRange(key: string, timeZone: string): { start: Date; end: Date } {
  const m = MONTH_KEY.exec(key);
  if (!m) throw new Error(`Bad month key: ${key}`);
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const startOf = (y: number, mi: number) => {
    const guess = new Date(Date.UTC(y, mi, 1));
    return new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
  };
  return {
    start: startOf(year, monthIndex),
    end: monthIndex === 11 ? startOf(year + 1, 0) : startOf(year, monthIndex + 1),
  };
}

// Newest month first.
export function sortMonthsDesc(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort().reverse();
}

export function dayMonthYear(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// What a statement is called in the Files list, e.g. "James Sep Statement".
export function statementDisplayName(firstName: string, monthKey: string): string {
  return `${firstName} ${monthShort(monthKey)} Statement`;
}

// ------------------------------------------------- API response shapes

export type FileEntry = {
  id: string;
  name: string;
  detail: string;
  href: string;
  downloadHref: string;
  // Show a Share button (statements: the phone's share sheet, e.g. WhatsApp).
  shareable?: boolean;
};

export type ChildEntry = {
  id: string;
  name: string;
  files: FileEntry[];
  // Shown when `files` is empty, e.g. "No statement generated".
  emptyText: string;
};

export type FilesResponse =
  | { level: "root"; folders: { key: FolderKey; label: string; hint: string }[] }
  | { level: "months"; folder: { key: FolderKey; label: string }; months: { key: string; label: string }[] }
  | {
      level: "classes";
      folder: { key: FolderKey; label: string };
      month: { key: string; label: string };
      classes: { id: string; name: string; summary: string }[];
    }
  | {
      level: "class";
      folder: { key: FolderKey; label: string };
      month: { key: string; label: string };
      className: string;
      children: ChildEntry[];
      files: FileEntry[];
    };

export function withDownload(href: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}download=1`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
