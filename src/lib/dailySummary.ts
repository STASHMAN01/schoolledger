import { z } from "zod";

// The class teacher's end-of-day summary (Dylan, 4 Oct 2026). Every
// weekday from DUE_HOUR school time, each class with a teacher answers:
// did any child get hurt under your supervision today? If yes, either an
// incident report exists for today or the teacher gives a reason.
// Submitted once per class per day, and never changed afterwards (teachers
// add, they don't edit).

export const DUE_HOUR = 12;

export type SchoolClock = {
  /** The school's date, "YYYY-MM-DD". */
  date: string;
  /** Minutes since midnight, school time. */
  minutes: number;
  /** ISO weekday, 1 = Monday ... 7 = Sunday. */
  weekday: number;
};

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The school's own date and time, from its IANA time zone. */
export function schoolClock(timeZone: string, now: Date = new Date()): SchoolClock {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return schoolClock("Africa/Johannesburg", now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: WEEKDAYS[get("weekday")] ?? 1,
  };
}

/** Whether today's summary should be asked for yet: weekdays from 12:00. */
export function isSummaryDue(clock: SchoolClock): boolean {
  return clock.weekday <= 5 && clock.minutes >= DUE_HOUR * 60;
}

/** The school date as the stored date-only value (UTC midnight). */
export function schoolDateValue(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** [start, end) of a school date, for matching report occurredAt values. */
export function schoolDateRange(date: string): { gte: Date; lt: Date } {
  const gte = schoolDateValue(date);
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

export const ROUTINE_ANSWERS = ["YES", "MOSTLY", "NO"] as const;
export type RoutineAnswer = (typeof ROUTINE_ANSWERS)[number];

// The five questions (Dylan, 5 Oct 2026):
//  1. Was any child hurt under your supervision?  (+ incident report logic)
//  2. Did any child fall ill or show symptoms?    (+ details)
//  3. Did the day follow the routine and lesson plan? (+ what changed)
//  4. Anything about a child's behaviour, mood or progress? (optional)
//  5. Anything that needs attention: supplies, repairs, safety, a parent? (optional)
export const dailySummarySchema = z.object({
  anyoneHurt: z.boolean(),
  incidentReported: z.boolean().optional(),
  noReportReason: z.string().trim().max(2000).optional(),
  anyoneIll: z.boolean(),
  illDetails: z.string().trim().max(2000).optional(),
  routineFollowed: z.enum(ROUTINE_ANSWERS),
  routineNote: z.string().trim().max(2000).optional(),
  childrenNote: z.string().trim().max(3000).optional(),
  needsNote: z.string().trim().max(3000).optional(),
});

export type DailySummaryInput = z.infer<typeof dailySummarySchema>;

export type DailySummaryDecision =
  | {
      ok: true;
      anyoneHurt: boolean;
      incidentReported: boolean | null;
      noReportReason: string | null;
      anyoneIll: boolean;
      illDetails: string | null;
      routineFollowed: RoutineAnswer;
      routineNote: string | null;
      childrenNote: string | null;
      needsNote: string | null;
    }
  | { ok: false; error: string };

type HurtPart =
  | { ok: true; anyoneHurt: boolean; incidentReported: boolean | null; noReportReason: string | null }
  | { ok: false; error: string };

function decideHurt(input: DailySummaryInput, incidentsToday: number): HurtPart {
  if (!input.anyoneHurt) {
    return { ok: true, anyoneHurt: false, incidentReported: null, noReportReason: null };
  }
  if (input.incidentReported === undefined) {
    return { ok: false, error: "Say whether you made an incident report." };
  }
  if (input.incidentReported) {
    if (incidentsToday === 0) {
      return {
        ok: false,
        error: "There's no incident report for your class today yet. Make the report now, or give a reason.",
      };
    }
    return { ok: true, anyoneHurt: true, incidentReported: true, noReportReason: null };
  }
  const reason = input.noReportReason?.trim() ?? "";
  if (reason.length < 3) {
    return { ok: false, error: "Give a reason why no incident report was made." };
  }
  return { ok: true, anyoneHurt: true, incidentReported: false, noReportReason: reason };
}

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * The rules for one submission, given how many incident reports the class
 * already has for today. "Yes, I made a report" is only accepted if a
 * report really exists; "no report" needs a reason; an illness needs
 * details; a day that didn't fully follow the routine needs a note.
 */
export function decideDailySummary(input: DailySummaryInput, incidentsToday: number): DailySummaryDecision {
  const hurt = decideHurt(input, incidentsToday);
  if (!hurt.ok) return hurt;
  if (input.anyoneIll && (input.illDetails?.trim().length ?? 0) < 3) {
    return { ok: false, error: "Say who was unwell and what you noticed." };
  }
  if (input.routineFollowed !== "YES" && (input.routineNote?.trim().length ?? 0) < 3) {
    return { ok: false, error: "Say what changed or was missed in today's routine." };
  }
  return {
    ...hurt,
    anyoneIll: input.anyoneIll,
    illDetails: input.anyoneIll ? blank(input.illDetails) : null,
    routineFollowed: input.routineFollowed,
    routineNote: input.routineFollowed === "YES" ? null : blank(input.routineNote),
    childrenNote: blank(input.childrenNote),
    needsNote: blank(input.needsNote),
  };
}
