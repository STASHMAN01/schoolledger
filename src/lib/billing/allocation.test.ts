import { describe, it, expect } from "vitest";
import { allocateOldestFirst, statusForEntry } from "./allocation";

// This is the single most important function in the product: it decides
// who owes what after money changes hands. Every case here traces back to
// a specific rule in the original product spec (01_PRODUCT_REQUIREMENTS.txt,
// section 7/8) — a failing test here means the waterfall itself is broken,
// not just some UI detail.

describe("allocateOldestFirst", () => {
  it("pays exactly two full months oldest-first (spec worked example: R2,800 across June+July)", () => {
    const entries = [
      { id: "june", amountDueCents: 140_000, amountPaidCents: 0 },
      { id: "july", amountDueCents: 140_000, amountPaidCents: 0 },
    ];
    const { lines, remainingCents } = allocateOldestFirst(entries, 280_000);

    expect(lines).toEqual([
      { entryId: "june", amountCents: 140_000 },
      { entryId: "july", amountCents: 140_000 },
    ]);
    expect(remainingCents).toBe(0);
  });

  it("marks a partial payment as partially paid, with nothing left over", () => {
    const entries = [{ id: "e1", amountDueCents: 140_000, amountPaidCents: 0 }];
    const { lines, remainingCents } = allocateOldestFirst(entries, 70_000);

    expect(lines).toEqual([{ entryId: "e1", amountCents: 70_000 }]);
    expect(remainingCents).toBe(0);
    expect(statusForEntry(140_000, 70_000)).toBe("PARTIALLY_PAID");
  });

  it("turns an overpayment beyond all outstanding entries into a credit remainder", () => {
    const entries = [{ id: "e1", amountDueCents: 140_000, amountPaidCents: 0 }];
    const { lines, remainingCents } = allocateOldestFirst(entries, 200_000);

    expect(lines).toEqual([{ entryId: "e1", amountCents: 140_000 }]);
    expect(remainingCents).toBe(60_000);
    expect(statusForEntry(140_000, 140_000)).toBe("PAID");
  });

  it("tops up an already-partially-paid entry using only what's still due", () => {
    const entries = [{ id: "e1", amountDueCents: 140_000, amountPaidCents: 70_000 }];
    const { lines, remainingCents } = allocateOldestFirst(entries, 70_000);

    expect(lines).toEqual([{ entryId: "e1", amountCents: 70_000 }]);
    expect(remainingCents).toBe(0);
  });

  it("skips entries that are already fully paid rather than double-allocating to them", () => {
    const entries = [
      { id: "paid", amountDueCents: 140_000, amountPaidCents: 140_000 },
      { id: "next", amountDueCents: 140_000, amountPaidCents: 0 },
    ];
    const { lines } = allocateOldestFirst(entries, 140_000);

    expect(lines).toEqual([{ entryId: "next", amountCents: 140_000 }]);
  });

  it("allocates nothing and leaves no remainder for a zero-amount payment", () => {
    const entries = [{ id: "e1", amountDueCents: 140_000, amountPaidCents: 0 }];
    const { lines, remainingCents } = allocateOldestFirst(entries, 0);

    expect(lines).toEqual([]);
    expect(remainingCents).toBe(0);
  });

  it("stops allocating the instant the payment amount is exhausted, even mid-list", () => {
    const entries = [
      { id: "jan", amountDueCents: 100_000, amountPaidCents: 0 },
      { id: "feb", amountDueCents: 100_000, amountPaidCents: 0 },
      { id: "mar", amountDueCents: 100_000, amountPaidCents: 0 },
    ];
    const { lines, remainingCents } = allocateOldestFirst(entries, 150_000);

    expect(lines).toEqual([
      { entryId: "jan", amountCents: 100_000 },
      { entryId: "feb", amountCents: 50_000 },
    ]);
    expect(remainingCents).toBe(0);
  });
});

describe("statusForEntry", () => {
  it("is OUTSTANDING when nothing has been paid", () => {
    expect(statusForEntry(140_000, 0)).toBe("OUTSTANDING");
  });
  it("is PARTIALLY_PAID when some but not all has been paid", () => {
    expect(statusForEntry(140_000, 1)).toBe("PARTIALLY_PAID");
    expect(statusForEntry(140_000, 139_999)).toBe("PARTIALLY_PAID");
  });
  it("is PAID once the full amount (or more) has been paid", () => {
    expect(statusForEntry(140_000, 140_000)).toBe("PAID");
    expect(statusForEntry(140_000, 150_000)).toBe("PAID");
  });
});
