import { describe, expect, it } from "vitest";
import { TRASH_RETENTION_DAYS, finalReviewWindow, trashDaysRemaining, trashPurgeCutoff } from "./deletion";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);

function deletedDaysAgo(days: number) {
  return new Date(NOW - days * DAY);
}

function inFinalReview(deletedAt: Date) {
  const w = finalReviewWindow(NOW);
  return deletedAt >= w.gte && deletedAt < w.lt;
}

describe("Trash timing", () => {
  it("purges only after the full retention period", () => {
    const cutoff = trashPurgeCutoff(NOW);
    expect(deletedDaysAgo(TRASH_RETENTION_DAYS + 0.01) < cutoff).toBe(true);
    expect(deletedDaysAgo(TRASH_RETENTION_DAYS - 0.01) < cutoff).toBe(false);
  });

  it("shows the final review only on the last day", () => {
    expect(inFinalReview(deletedDaysAgo(29.5))).toBe(true);
    expect(inFinalReview(deletedDaysAgo(28.9))).toBe(false);
    expect(inFinalReview(deletedDaysAgo(1))).toBe(false);
    // Past 30 days (e.g. a child kept because of payment history): not on
    // the to-do list forever.
    expect(inFinalReview(deletedDaysAgo(31))).toBe(false);
  });

  it("counts the days left", () => {
    expect(trashDaysRemaining(deletedDaysAgo(0), NOW)).toBe(TRASH_RETENTION_DAYS);
    expect(trashDaysRemaining(deletedDaysAgo(29.5), NOW)).toBe(1);
    expect(trashDaysRemaining(deletedDaysAgo(40), NOW)).toBe(0);
  });
});
