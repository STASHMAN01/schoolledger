import { DATE_RE, MAX_THEME_DAYS, addDays, daysApart, isWeekendDate, weekdayOf } from "@/lib/lessonPlan";

// Lesson plan import (Dylan, 5 Oct 2026): a month of themes, daily topics and
// teaching guides from one spreadsheet. One row per class per day:
//
//   Theme | Start date | End date | Class | Date | Topic for the day | Teaching guide
//
// Class can be a class name, several names separated by ";", or "All".
// Date can be a date (2026-10-05 or 05/10/2026) or a weekday ("Monday"),
// which means that weekday inside the theme's dates. A row with no Date and
// no topic only creates the theme. Pure: no db, so it is fully tested.

export type ImportClass = { id: string; name: string };

export type ImportTheme = {
  key: string;
  title: string;
  startDate: string;
  endDate: string;
  /** [] = every class */
  categoryIds: string[];
};

export type ImportDay = {
  themeKey: string;
  categoryId: string;
  date: string;
  topic: string;
  guide: string | null;
};

export type ImportPlan = {
  themes: ImportTheme[];
  days: ImportDay[];
  errors: { row: number; error: string }[];
};

export const MAX_IMPORT_ROWS = 3_000;

const WEEKDAYS: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5,
};

function compact(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const COLUMNS: Record<keyof RawRow, string[]> = {
  theme: ["theme", "weektheme", "themeoftheweek", "topicoftheweek", "weektopic", "maintopic"],
  start: ["startdate", "start", "from", "fromdate", "weekstart"],
  end: ["enddate", "end", "to", "todate"],
  classes: ["class", "classes", "agegroup", "group"],
  date: ["date", "day", "lessondate"],
  topic: ["topicfortheday", "daytopic", "dailytopic", "subtopic", "topic", "lesson", "focus"],
  guide: ["teachingguide", "guide", "whattoteach", "teachernotes", "activities", "howtoteach"],
};

type RawRow = { theme: string; start: string; end: string; classes: string; date: string; topic: string; guide: string };

/** Map a spreadsheet's headings to our columns. Missing required ones are listed. */
export function matchColumns(headers: string[]): { map: Partial<Record<keyof RawRow, number>>; missing: string[] } {
  const map: Partial<Record<keyof RawRow, number>> = {};
  const compacted = headers.map(compact);
  (Object.keys(COLUMNS) as (keyof RawRow)[]).forEach((key) => {
    const idx = compacted.findIndex((h) => COLUMNS[key].includes(h));
    if (idx >= 0) map[key] = idx;
  });
  const missing: string[] = [];
  if (map.theme === undefined) missing.push("Theme");
  if (map.start === undefined) missing.push("Start date");
  if (map.end === undefined) missing.push("End date");
  if (map.classes === undefined) missing.push("Class");
  return { map, missing };
}

/** yyyy-mm-dd, dd/mm/yyyy or dd-mm-yyyy (South African day first). */
export function readDate(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (!m) return null;
    [y, mo, d] = [+m[3], +m[2], +m[1]];
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const iso = date.toISOString().slice(0, 10);
  return DATE_RE.test(iso) ? iso : null;
}

/** "Monday" inside [start, end] -> its first date in that range. */
export function weekdayInRange(name: string, start: string, end: string): string | null {
  const want = WEEKDAYS[name.trim().toLowerCase().replace(/[^a-z]/g, "")];
  if (!want) return null;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (weekdayOf(d) === want) return d;
  }
  return null;
}

function resolveClasses(cell: string, classes: ImportClass[]): { ids: string[]; all: boolean; unknown: string[] } {
  const parts = cell
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.some((p) => /^all( classes)?$/i.test(p))) {
    return { ids: classes.map((c) => c.id), all: true, unknown: [] };
  }
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const c = classes.find((k) => k.name.trim().toLowerCase() === p.toLowerCase());
    if (c) ids.push(c.id);
    else unknown.push(p);
  }
  return { ids, all: false, unknown };
}

/**
 * Turn spreadsheet rows (first row = headings) into themes and class-days.
 * Every problem is reported against its spreadsheet row number (1-based,
 * counting the heading row), and a row with a problem is skipped.
 */
export function planImport(table: string[][], classes: ImportClass[]): ImportPlan {
  const errors: ImportPlan["errors"] = [];
  if (table.length < 2) return { themes: [], days: [], errors: [{ row: 1, error: "The file has no rows under the headings." }] };
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { themes: [], days: [], errors: [{ row: 1, error: `Import up to ${MAX_IMPORT_ROWS} rows at a time.` }] };
  }
  const { map, missing } = matchColumns(table[0]);
  if (missing.length) {
    return { themes: [], days: [], errors: [{ row: 1, error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` }] };
  }
  const cell = (r: string[], k: keyof RawRow) => (map[k] === undefined ? "" : String(r[map[k]!] ?? "").trim());

  const themes = new Map<string, ImportTheme & { all: boolean; ids: Set<string> }>();
  const days = new Map<string, ImportDay>();

  table.slice(1).forEach((r, i) => {
    const row = i + 2;
    if (r.every((c) => !String(c ?? "").trim())) return; // blank line
    const title = cell(r, "theme");
    const start = readDate(cell(r, "start"));
    const end = readDate(cell(r, "end"));
    if (title.length < 2) return void errors.push({ row, error: "Theme is empty." });
    if (title.length > 120) return void errors.push({ row, error: "Theme is longer than 120 characters." });
    if (!start) return void errors.push({ row, error: "Start date isn't a date (use 2026-10-05 or 05/10/2026)." });
    if (!end) return void errors.push({ row, error: "End date isn't a date (use 2026-10-09 or 09/10/2026)." });
    if (end < start) return void errors.push({ row, error: "End date is before the start date." });
    if (daysApart(start, end) + 1 > MAX_THEME_DAYS) {
      return void errors.push({ row, error: `A theme can run for up to ${MAX_THEME_DAYS} days.` });
    }

    const cls = resolveClasses(cell(r, "classes"), classes);
    if (cls.unknown.length) {
      return void errors.push({ row, error: `No class called ${cls.unknown.map((u) => `"${u}"`).join(", ")}.` });
    }

    const key = `${title.toLowerCase()}|${start}|${end}`;
    const theme = themes.get(key) ?? { key, title, startDate: start, endDate: end, categoryIds: [], all: false, ids: new Set() };
    if (cls.all) theme.all = true;
    cls.ids.forEach((id) => theme.ids.add(id));
    themes.set(key, theme);

    const dateCell = cell(r, "date");
    const topic = cell(r, "topic");
    const guide = cell(r, "guide");
    if (!dateCell && !topic && !guide) return; // theme-only row

    const date = dateCell ? readDate(dateCell) ?? weekdayInRange(dateCell, start, end) : null;
    if (!date) return void errors.push({ row, error: dateCell ? `"${dateCell}" isn't a date or a weekday inside the theme's dates.` : "Date is empty." });
    if (date < start || date > end) return void errors.push({ row, error: "Date is outside the theme's start and end dates." });
    if (isWeekendDate(date)) return void errors.push({ row, error: "Date is on a weekend." });
    if (!topic) return void errors.push({ row, error: "Topic for the day is empty." });
    if (topic.length > 200) return void errors.push({ row, error: "Topic for the day is longer than 200 characters." });
    if (guide.length > 5_000) return void errors.push({ row, error: "Teaching guide is longer than 5,000 characters." });

    for (const categoryId of cls.ids) {
      // A later row for the same class and day wins.
      days.set(`${categoryId}|${date}`, { themeKey: key, categoryId, date, topic, guide: guide || null });
    }
  });

  return {
    themes: [...themes.values()].map(({ all, ids, ...t }) => ({ ...t, categoryIds: all ? [] : [...ids] })),
    days: [...days.values()].sort((a, b) => (a.date === b.date ? a.categoryId.localeCompare(b.categoryId) : a.date.localeCompare(b.date))),
    errors,
  };
}

/** The template rows offered for download (and what Claude fills in). */
export const IMPORT_TEMPLATE: string[][] = [
  ["Theme", "Start date", "End date", "Class", "Date", "Topic for the day", "Teaching guide"],
  ["Numbers and shapes", "2026-10-05", "2026-10-09", "Butterfly", "2026-10-05", "Counting 1 to 10", "Count out loud together using fingers. Count 10 blocks into a basket. Song: Ten little ducks."],
  ["Numbers and shapes", "2026-10-05", "2026-10-09", "Butterfly", "2026-10-06", "Circles and squares", "Find circle and square things in the classroom. Trace a circle and a square in sand."],
  ["Numbers and shapes", "2026-10-05", "2026-10-09", "All", "2026-10-09", "Shape hunt", ""],
];
