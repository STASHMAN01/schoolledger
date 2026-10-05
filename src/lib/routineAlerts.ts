// Routine sounds (Dylan, 4 Oct 2026): a chime on the class tablet whenever
// the day's routine moves on. Pure helpers, no db and no browser APIs, so
// they can be tested; the sound itself lives in RoutineSounds.tsx.

export type RoutineItem = {
  dayOfWeek: number;
  startTime: string; // "HH:MM", school time
  endTime: string | null;
  activity: string;
};

export type RoutineAlert = {
  /** Minutes since midnight, school time. */
  minutes: number;
  kind: "start" | "end";
  /** What the banner says, e.g. "Circle time" or "Routine finished". */
  label: string;
};

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Every moment today the tablet should chime: each activity's start time,
 * plus one closing chime when the last activity of the day ends. Two
 * activities starting at the same minute give one alert.
 */
export function alertsForDay(items: RoutineItem[], weekday: number): RoutineAlert[] {
  const today = items.filter((i) => i.dayOfWeek === weekday);
  const byMinute = new Map<number, RoutineAlert>();
  for (const i of [...today].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const minutes = toMinutes(i.startTime);
    const existing = byMinute.get(minutes);
    byMinute.set(minutes, {
      minutes,
      kind: "start",
      label: existing ? `${existing.label} / ${i.activity}` : i.activity,
    });
  }
  const ends = today.map((i) => (i.endTime ? toMinutes(i.endTime) : toMinutes(i.startTime)));
  if (ends.length > 0) {
    const last = Math.max(...ends);
    // An end that lands on another activity's start is just that start.
    if (!byMinute.has(last)) byMinute.set(last, { minutes: last, kind: "end", label: "Routine finished" });
  }
  return [...byMinute.values()].sort((a, b) => a.minutes - b.minutes);
}

/** Longest gap we still chime for after a late timer (a tablet that napped). */
export const CATCH_UP_MINUTES = 5;

/**
 * The alert to play now, if any: the latest one that fell in
 * (previous check, now]. A tablet that was asleep for an hour doesn't
 * replay the morning; it only catches up on the last few minutes.
 */
export function dueAlert(alerts: RoutineAlert[], previousMinutes: number, nowMinutes: number): RoutineAlert | null {
  const from = Math.max(previousMinutes, nowMinutes - CATCH_UP_MINUTES);
  const hits = alerts.filter((a) => a.minutes > from && a.minutes <= nowMinutes);
  return hits.length > 0 ? hits[hits.length - 1] : null;
}
