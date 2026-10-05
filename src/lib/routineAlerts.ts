// Routine sounds (Dylan, 4 Oct 2026): a chime on the class tablet whenever
// the day's routine moves on. Pure helpers, no db and no browser APIs, so
// they can be tested; the sound itself lives in RoutineSounds.tsx.

export type RoutineItem = {
  dayOfWeek: number;
  startTime: string; // "HH:MM", school time
  endTime: string | null;
  activity: string;
};

/** Which sound an activity gets. */
export type SoundId =
  | "chime"
  | "arrival"
  | "meal"
  | "nap"
  | "outdoor"
  | "wash"
  | "story"
  | "music"
  | "art"
  | "departure"
  | "end";

/** Picks a sound from the activity's name, so lunch sounds different from nap time. */
export function soundFor(activity: string): SoundId {
  const a = activity.toLowerCase();
  if (/depart|home time|going home|pick.?up/.test(a)) return "departure";
  if (/nap|sleep|rest/.test(a)) return "nap";
  if (/breakfast|lunch|snack|refreshment|meal|supper|fruit/.test(a)) return "meal";
  if (/wash|toilet|hands|potty/.test(a)) return "wash";
  if (/outdoor|outside|playground|garden/.test(a)) return "outdoor";
  if (/story|book|reading/.test(a)) return "story";
  if (/music|movement|song|dance|rhyme/.test(a)) return "music";
  if (/art|craft|paint|life skills|creative/.test(a)) return "art";
  if (/arriv|welcome|register/.test(a)) return "arrival";
  return "chime";
}

export type RoutineAlert = {
  /** Minutes since midnight, school time. */
  minutes: number;
  kind: "start" | "end";
  /** What the banner says, e.g. "Circle time" or "Routine finished". */
  label: string;
  sound: SoundId;
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
      // Two things starting together keep the first one's sound.
      sound: existing ? existing.sound : soundFor(i.activity),
    });
  }
  const ends = today.map((i) => (i.endTime ? toMinutes(i.endTime) : toMinutes(i.startTime)));
  if (ends.length > 0) {
    const last = Math.max(...ends);
    // An end that lands on another activity's start is just that start.
    if (!byMinute.has(last)) byMinute.set(last, { minutes: last, kind: "end", label: "Routine finished", sound: "end" });
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

export type ItemStatus = "past" | "current" | "upcoming";
export type RoutineRow<T extends RoutineItem> = T & { status: ItemStatus; endMinutes: number };

/**
 * Today's items in order, each marked past / current / upcoming at
 * `nowMinutes`. An item with no end time runs until the next item starts
 * (or for 15 minutes if it is the last), so a one-line "Light refreshments"
 * still fades out once the next thing begins.
 */
export function markProgress<T extends RoutineItem>(items: T[], weekday: number, nowMinutes: number): RoutineRow<T>[] {
  const today = items.filter((i) => i.dayOfWeek === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
  return today.map((i, idx) => {
    const start = toMinutes(i.startTime);
    let end: number;
    if (i.endTime) end = toMinutes(i.endTime);
    else {
      const next = today.slice(idx + 1).find((n) => toMinutes(n.startTime) > start);
      end = next ? toMinutes(next.startTime) : start + 15;
    }
    const status: ItemStatus = nowMinutes >= end ? "past" : nowMinutes >= start ? "current" : "upcoming";
    return { ...i, status, endMinutes: end };
  });
}

/**
 * For the home page: the last `before` finished items, whatever is
 * happening now, then the next `after` items.
 */
export function aroundNow<T extends RoutineItem>(
  rows: RoutineRow<T>[],
  before = 3,
  after = 3
): { earlier: RoutineRow<T>[]; now: RoutineRow<T>[]; later: RoutineRow<T>[] } {
  const past = rows.filter((r) => r.status === "past");
  const upcoming = rows.filter((r) => r.status === "upcoming");
  return {
    earlier: past.slice(-before),
    now: rows.filter((r) => r.status === "current"),
    later: upcoming.slice(0, after),
  };
}
