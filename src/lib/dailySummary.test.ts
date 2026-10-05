import { describe, expect, it } from "vitest";
import { decideDailySummary, isSummaryDue, schoolClock, schoolDateRange } from "./dailySummary";

describe("schoolClock", () => {
  it("uses the school's time zone, not the server's", () => {
    // 14:30 UTC on Monday 5 Oct 2026 is 16:30 in Johannesburg.
    const c = schoolClock("Africa/Johannesburg", new Date("2026-10-05T14:30:00Z"));
    expect(c).toEqual({ date: "2026-10-05", minutes: 16 * 60 + 30, weekday: 1 });
  });

  it("rolls the date over at the school's midnight", () => {
    // 22:30 UTC Sunday is 00:30 Monday in Johannesburg.
    const c = schoolClock("Africa/Johannesburg", new Date("2026-10-04T22:30:00Z"));
    expect(c.date).toBe("2026-10-05");
    expect(c.weekday).toBe(1);
  });
});

describe("isSummaryDue", () => {
  it("is due on weekdays from 12:00", () => {
    expect(isSummaryDue({ date: "x", minutes: 11 * 60 + 59, weekday: 2 })).toBe(false);
    expect(isSummaryDue({ date: "x", minutes: 12 * 60, weekday: 2 })).toBe(true);
    expect(isSummaryDue({ date: "x", minutes: 13 * 60, weekday: 5 })).toBe(true);
  });

  it("is never due at the weekend", () => {
    expect(isSummaryDue({ date: "x", minutes: 17 * 60, weekday: 6 })).toBe(false);
    expect(isSummaryDue({ date: "x", minutes: 17 * 60, weekday: 7 })).toBe(false);
  });
});

describe("schoolDateRange", () => {
  it("covers exactly one school date", () => {
    const r = schoolDateRange("2026-10-05");
    expect(r.gte.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(r.lt.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});

describe("decideDailySummary", () => {
  // The other four answers, all "fine".
  const fine = { anyoneIll: false, routineFollowed: "YES" as const };

  it("accepts 'nobody was hurt' and a fine day", () => {
    expect(decideDailySummary({ anyoneHurt: false, ...fine }, 0)).toEqual({
      ok: true,
      anyoneHurt: false,
      incidentReported: null,
      noReportReason: null,
      anyoneIll: false,
      illDetails: null,
      routineFollowed: "YES",
      routineNote: null,
      childrenNote: null,
      needsNote: null,
    });
  });

  it("asks whether a report was made when someone was hurt", () => {
    expect(decideDailySummary({ anyoneHurt: true, ...fine }, 0).ok).toBe(false);
  });

  it("only accepts 'I made a report' if one exists for today", () => {
    expect(decideDailySummary({ anyoneHurt: true, incidentReported: true, ...fine }, 0).ok).toBe(false);
    expect(decideDailySummary({ anyoneHurt: true, incidentReported: true, ...fine }, 1)).toMatchObject({
      ok: true,
      incidentReported: true,
    });
  });

  it("needs a reason when no report was made", () => {
    expect(decideDailySummary({ anyoneHurt: true, incidentReported: false, ...fine }, 0).ok).toBe(false);
    expect(
      decideDailySummary({ anyoneHurt: true, incidentReported: false, noReportReason: "  ", ...fine }, 0).ok
    ).toBe(false);
    expect(
      decideDailySummary(
        { anyoneHurt: true, incidentReported: false, noReportReason: "Small scrape, parent saw it", ...fine },
        0
      )
    ).toMatchObject({ ok: true, incidentReported: false, noReportReason: "Small scrape, parent saw it" });
  });

  it("needs details when a child was unwell", () => {
    expect(decideDailySummary({ anyoneHurt: false, anyoneIll: true, routineFollowed: "YES" }, 0).ok).toBe(false);
    expect(
      decideDailySummary(
        { anyoneHurt: false, anyoneIll: true, illDetails: "Warm, sent home at 10:30", routineFollowed: "YES" },
        0
      )
    ).toMatchObject({ ok: true, anyoneIll: true, illDetails: "Warm, sent home at 10:30" });
  });

  it("needs a note when the routine wasn't fully followed", () => {
    expect(decideDailySummary({ anyoneHurt: false, anyoneIll: false, routineFollowed: "MOSTLY" }, 0).ok).toBe(false);
    expect(
      decideDailySummary(
        { anyoneHurt: false, anyoneIll: false, routineFollowed: "NO", routineNote: "Rain: no outdoor play" },
        0
      )
    ).toMatchObject({ ok: true, routineFollowed: "NO", routineNote: "Rain: no outdoor play" });
  });

  it("keeps the optional notes, trimmed, and drops blanks", () => {
    expect(
      decideDailySummary({ anyoneHurt: false, ...fine, childrenNote: "  Sam was very tearful  ", needsNote: " " }, 0)
    ).toMatchObject({ childrenNote: "Sam was very tearful", needsNote: null });
  });
});
