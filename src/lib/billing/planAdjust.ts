// What happens to a child's monthly fee charges when their details change
// after they were added (Dylan, 25 Sept: "Edit details" for name, class,
// start/leaving date, own fee). Pure functions, so the rules are testable
// and the same code produces the preview and the real change.
//
// The rules, in plain words:
//   - Only MONTHLY charges of the school-fee type are ever touched. Events,
//     registration and anything else stay exactly as they are.
//   - A charge that has ANY money against it (paid or part-paid) is never
//     changed, repriced or cancelled. History stays history.
//   - New fee (class move or own fee): unpaid monthly charges from THIS
//     month onward get the new amount. Earlier months keep the old one.
//   - Start date later / leaving date earlier: unpaid monthly charges now
//     outside the enrolled months are cancelled.
//   - Start date earlier / leaving date later or removed: monthly charges
//     that were cancelled but are inside the enrolled months again come
//     back (missing months are then created by the normal yearly plan).

export type PlanEntryLite = {
  id: string;
  paymentTypeId: string;
  year: number;
  month: number | null;
  amountDueCents: number;
  amountPaidCents: number;
  status: "OUTSTANDING" | "PARTIALLY_PAID" | "PAID" | "UPCOMING" | "CANCELLED";
};

export type YearMonth = { year: number; month: number };

export type EntryUpdate = {
  id: string;
  amountDueCents?: number;
  status: PlanEntryLite["status"];
  kind: "repriced" | "cancelled" | "restored";
};

const key = (ym: YearMonth) => ym.year * 12 + (ym.month - 1);
const ymOf = (e: PlanEntryLite): YearMonth => ({ year: e.year, month: e.month ?? 1 });

export function ymFromDate(d: Date): YearMonth {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

// A charge nobody owes anything on (R0) counts as settled, not outstanding.
function statusFor(dueCents: number, paidCents: number): PlanEntryLite["status"] {
  if (dueCents <= 0) return "PAID";
  if (paidCents <= 0) return "OUTSTANDING";
  return paidCents >= dueCents ? "PAID" : "PARTIALLY_PAID";
}

function isUntouchedMonthly(e: PlanEntryLite, recurringTypeId: string) {
  return (
    e.paymentTypeId === recurringTypeId &&
    e.month !== null &&
    e.amountPaidCents === 0 &&
    (e.status === "OUTSTANDING" || e.status === "UPCOMING")
  );
}

/**
 * Works out every change to a child's monthly charges for new details.
 * `newFeeCents` is the fee the child should pay from now on. `exit` null =
 * no leaving date. Nothing happens unless `feeChanged` or `datesChanged`
 * is true, so saving (say) a spelling fix never touches any charge.
 */
export function planAdjustments(args: {
  entries: PlanEntryLite[];
  recurringTypeId: string;
  today: YearMonth;
  newFeeCents: number;
  start: YearMonth;
  exit: YearMonth | null;
  feeChanged: boolean;
  datesChanged: boolean;
}): EntryUpdate[] {
  const { entries, recurringTypeId, today, newFeeCents, start, exit, feeChanged, datesChanged } = args;
  if (!feeChanged && !datesChanged) return [];
  const inRange = (ym: YearMonth) => key(ym) >= key(start) && (exit === null || key(ym) <= key(exit));
  const updates: EntryUpdate[] = [];

  for (const e of entries) {
    if (e.paymentTypeId !== recurringTypeId || e.month === null) continue;
    const ym = ymOf(e);

    if (e.status === "CANCELLED") {
      if (!datesChanged) continue;
      // Bring back a cancelled month that's inside the enrolled months
      // again, at the fee that applies to it.
      if (inRange(ym)) {
        const due = key(ym) >= key(today) && e.amountPaidCents === 0 ? newFeeCents : e.amountDueCents;
        updates.push({ id: e.id, amountDueCents: due, status: statusFor(due, e.amountPaidCents), kind: "restored" });
      }
      continue;
    }

    if (!isUntouchedMonthly(e, recurringTypeId)) continue;

    if (!inRange(ym)) {
      if (datesChanged) updates.push({ id: e.id, status: "CANCELLED", kind: "cancelled" });
    } else if (feeChanged && key(ym) >= key(today) && e.amountDueCents !== newFeeCents) {
      updates.push({
        id: e.id,
        amountDueCents: newFeeCents,
        status: statusFor(newFeeCents, 0),
        kind: "repriced",
      });
    }
  }
  return updates;
}

/** Short counts for the "what will this change?" preview. */
export function summariseAdjustments(updates: EntryUpdate[]) {
  return {
    repriced: updates.filter((u) => u.kind === "repriced").length,
    cancelled: updates.filter((u) => u.kind === "cancelled").length,
    restored: updates.filter((u) => u.kind === "restored").length,
  };
}
