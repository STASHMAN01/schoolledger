import { describe, expect, it } from "vitest";
import { planAdjustments, summariseAdjustments, type PlanEntryLite } from "./planAdjust";

const FEES = "pt-fees";
const EVENT = "pt-event";

// Sept–Dec 2026 school fees at R2,200; September is paid, October part-paid.
function entries(): PlanEntryLite[] {
  const e = (id: string, month: number, paid: number, status: PlanEntryLite["status"]): PlanEntryLite => ({
    id,
    paymentTypeId: FEES,
    year: 2026,
    month,
    amountDueCents: 220000,
    amountPaidCents: paid,
    status,
  });
  return [
    e("sep", 9, 220000, "PAID"),
    e("oct", 10, 100000, "PARTIALLY_PAID"),
    e("nov", 11, 0, "OUTSTANDING"),
    e("dec", 12, 0, "OUTSTANDING"),
    { id: "trip", paymentTypeId: EVENT, year: 2026, month: null, amountDueCents: 5000, amountPaidCents: 0, status: "OUTSTANDING" },
  ];
}

const base = {
  recurringTypeId: FEES,
  today: { year: 2026, month: 9 },
  start: { year: 2026, month: 9 },
  exit: null,
};

describe("planAdjustments", () => {
  it("changes nothing when neither the fee nor the dates changed (e.g. a name fix)", () => {
    expect(
      planAdjustments({ ...base, entries: entries(), newFeeCents: 250000, feeChanged: false, datesChanged: false })
    ).toEqual([]);
  });

  it("new fee: reprices only unpaid monthly charges from this month on", () => {
    const u = planAdjustments({ ...base, entries: entries(), newFeeCents: 250000, feeChanged: true, datesChanged: false });
    expect(u.map((x) => x.id).sort()).toEqual(["dec", "nov"]);
    expect(u.every((x) => x.amountDueCents === 250000 && x.status === "OUTSTANDING")).toBe(true);
  });

  it("never touches paid or part-paid months, or event charges", () => {
    const u = planAdjustments({
      ...base,
      entries: entries(),
      newFeeCents: 250000,
      exit: { year: 2026, month: 8 },
      feeChanged: true,
      datesChanged: true,
    });
    const ids = u.map((x) => x.id);
    expect(ids).not.toContain("sep");
    expect(ids).not.toContain("oct");
    expect(ids).not.toContain("trip");
  });

  it("does not reprice months before this month", () => {
    const u = planAdjustments({
      ...base,
      today: { year: 2026, month: 12 },
      entries: entries(),
      newFeeCents: 250000,
      feeChanged: true,
      datesChanged: false,
    });
    expect(u.map((x) => x.id)).toEqual(["dec"]);
  });

  it("leaving date: cancels unpaid months after it", () => {
    const u = planAdjustments({
      ...base,
      entries: entries(),
      newFeeCents: 220000,
      exit: { year: 2026, month: 11 },
      feeChanged: false,
      datesChanged: true,
    });
    expect(u).toEqual([{ id: "dec", status: "CANCELLED", kind: "cancelled" }]);
  });

  it("removing the leaving date brings cancelled months back at the current fee", () => {
    const withCancelled = entries().map((e) => (e.id === "dec" ? { ...e, status: "CANCELLED" as const } : e));
    const u = planAdjustments({
      ...base,
      entries: withCancelled,
      newFeeCents: 230000,
      exit: null,
      feeChanged: false,
      datesChanged: true,
    });
    expect(u).toEqual([{ id: "dec", amountDueCents: 230000, status: "OUTSTANDING", kind: "restored" }]);
  });

  it("a later start date cancels unpaid months before it", () => {
    const u = planAdjustments({
      ...base,
      entries: entries(),
      newFeeCents: 220000,
      start: { year: 2026, month: 12 },
      feeChanged: false,
      datesChanged: true,
    });
    expect(u.map((x) => x.id)).toEqual(["nov"]);
    expect(summariseAdjustments(u)).toEqual({ repriced: 0, cancelled: 1, restored: 0 });
  });

  it("a R0 fee counts as settled, not outstanding", () => {
    const u = planAdjustments({ ...base, entries: entries(), newFeeCents: 0, feeChanged: true, datesChanged: false });
    expect(u.every((x) => x.status === "PAID" && x.amountDueCents === 0)).toBe(true);
  });
});
