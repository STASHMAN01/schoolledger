import { z } from "zod";

// The class teacher's end-of-day summary (Dylan, 4 Oct 2026). Every
// weekday from DUE_HOUR school time, each class with a teacher answers:
// did any child get hurt under your supervision today? If yes, either an
// incident report exists for today or the teacher gives a reason.
// Submitted once per class per day, and never changed afterwards (teachers
// add, they don't edit).

export const DUE_HOUR = 16;

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

/** Whether today's summary should be asked for yet: weekdays from 16:00. */
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

export const dailySummarySchema = z.object({
  anyoneHurt: z.boolean(),
  incidentReported: z.boolean().optional(),
  noReportReason: z.string().trim().max(2000).optional(),
});

export type DailySummaryInput = z.infer<typeof dailySummarySchema>;

export type DailySummaryDecision =
  | { ok: true; anyoneHurt: boolean; incidentReported: boolean | null; noReportReason: string | null }
  | { ok: false; error: string };

/**
 * The rules for one submission, given how many incident reports the class
 * already has for today. "Yes, I made a report" is only accepted if a
 * report really exists; "no report" needs a reason.
 */
export function decideDailySummary(input: DailySummaryInput, incidentsToday: number): DailySummaryDecision {
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
