import { describe, expect, it } from "vitest";
import { MAX_GROUP_PHOTOS } from "./lessonPlan";
import {
  STAGED_PHOTO_HOURS,
  checkClassworkPhotos,
  expiredStagedWhere,
  isExpiredStaged,
  isStaged,
  schoolDayStart,
  stagedCutoff,
} from "./classwork";

// Obviously fake children only (POPIA): no real names anywhere.
const present = [
  { id: "c1", firstName: "Testchild-A" },
  { id: "c2", firstName: "Testchild-B" },
  { id: "c3", firstName: "Testchild-C" },
];

describe("checkClassworkPhotos: group activity", () => {
  it("refuses a group activity with no photos", () => {
    const r = checkClassworkPhotos({ activityType: "GROUP", photos: [], presentChildren: [], registerTaken: false });
    expect(r).toEqual({ ok: false, error: "Add at least one photo of the activity before describing it." });
  });

  it("accepts one photo, without needing the register", () => {
    const r = checkClassworkPhotos({
      activityType: "GROUP",
      photos: [{ childId: null }],
      presentChildren: [],
      registerTaken: false,
    });
    expect(r.ok).toBe(true);
  });

  it("refuses photos tagged to a child", () => {
    const r = checkClassworkPhotos({
      activityType: "GROUP",
      photos: [{ childId: "c1" }],
      presentChildren: present,
      registerTaken: true,
    });
    expect(r.ok).toBe(false);
  });

  it("refuses more than the group maximum", () => {
    const photos = Array.from({ length: MAX_GROUP_PHOTOS + 1 }, () => ({ childId: null }));
    const r = checkClassworkPhotos({ activityType: "GROUP", photos, presentChildren: [], registerTaken: false });
    expect(r.ok).toBe(false);
  });
});

describe("checkClassworkPhotos: individual activity", () => {
  const base = { activityType: "INDIVIDUAL" as const, presentChildren: present, registerTaken: true };

  it("needs the register taken first", () => {
    const r = checkClassworkPhotos({ ...base, registerTaken: false, photos: [] });
    expect(r).toEqual({
      ok: false,
      error: "Take today's register first, so we know which children need a photo.",
    });
  });

  it("refuses when nobody is present", () => {
    const r = checkClassworkPhotos({ ...base, presentChildren: [], photos: [] });
    expect(r.ok).toBe(false);
  });

  it("names the children still missing a photo, by first name", () => {
    const r = checkClassworkPhotos({ ...base, photos: [{ childId: "c2" }] });
    expect(r).toEqual({
      ok: false,
      error: "Still need a photo of: Testchild-A, Testchild-C.",
      missingChildIds: ["c1", "c3"],
    });
  });

  it("refuses a photo of a child who isn't present", () => {
    const r = checkClassworkPhotos({
      ...base,
      photos: [{ childId: "c1" }, { childId: "c2" }, { childId: "c3" }, { childId: "absent" }],
    });
    expect(r.ok).toBe(false);
  });

  it("refuses two photos of the same child", () => {
    const r = checkClassworkPhotos({
      ...base,
      photos: [{ childId: "c1" }, { childId: "c1" }, { childId: "c2" }, { childId: "c3" }],
    });
    expect(r).toEqual({ ok: false, error: "Each child can only have one photo." });
  });

  it("refuses a photo that isn't of any child", () => {
    const r = checkClassworkPhotos({ ...base, photos: [{ childId: null }] });
    expect(r.ok).toBe(false);
  });

  it("accepts exactly one photo of every child marked present", () => {
    const r = checkClassworkPhotos({
      ...base,
      photos: [{ childId: "c3" }, { childId: "c1" }, { childId: "c2" }],
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("staged photo cleanup selection", () => {
  const now = new Date("2026-10-16T01:00:00.000Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  it("expires staged classwork photos older than 24 hours", () => {
    expect(STAGED_PHOTO_HOURS).toBe(24);
    expect(isExpiredStaged({ kind: "CLASSWORK", classworkEntryId: null, createdAt: hoursAgo(25) }, now)).toBe(true);
  });

  it("keeps staged photos from the last 24 hours", () => {
    expect(isExpiredStaged({ kind: "CLASSWORK", classworkEntryId: null, createdAt: hoursAgo(23) }, now)).toBe(false);
  });

  it("never touches photos attached to an entry", () => {
    expect(isExpiredStaged({ kind: "CLASSWORK", classworkEntryId: "e1", createdAt: hoursAgo(100) }, now)).toBe(false);
  });

  it("never touches report photos", () => {
    expect(isExpiredStaged({ kind: "REPORT", classworkEntryId: null, createdAt: hoursAgo(100) }, now)).toBe(false);
    expect(isStaged({ kind: "REPORT", classworkEntryId: null })).toBe(false);
  });

  it("builds a database filter on the same cutoff and without a status filter", () => {
    const where = expiredStagedWhere(now);
    expect(where.kind).toBe("CLASSWORK");
    expect(where.classworkEntryId).toBeNull();
    expect(where.createdAt.lt).toEqual(stagedCutoff(now));
    expect("status" in where).toBe(false); // ACTIVE and PENDING both go
  });
});

describe("schoolDayStart", () => {
  it("is the start of the school's day: 10:30 school time is 630 minutes after it", () => {
    // 08:30 UTC is 10:30 in South Africa (UTC+2).
    const now = new Date("2026-10-15T08:30:45.000Z");
    expect(schoolDayStart({ minutes: 630 }, now)).toEqual(new Date("2026-10-14T22:00:00.000Z"));
  });

  it("treats a photo from last night as not staged today", () => {
    const start = schoolDayStart({ minutes: 630 }, new Date("2026-10-15T08:30:00.000Z"));
    expect(new Date("2026-10-14T21:59:00.000Z") < start).toBe(true);
    expect(new Date("2026-10-14T22:01:00.000Z") >= start).toBe(true);
  });
});
