import { maskIdNumber } from "@/lib/idMask";

// One place that decides what a Child row looks like when it leaves the
// API (final-inspection fixes R1/R2). Every child response goes through
// here so that:
//   - ID numbers are ALWAYS masked (the audit-logged reveal-id endpoints
//     are the only way to get a full value), and
//   - money (fee override, class fee, plan entries, credit) is blanked out
//     for anyone without VIEW_MONEY. Money fields are emptied rather than
//     deleted so pages that sum them never crash, they just show nothing.
type ChildLike = {
  childIdNumber?: string | null;
  parentIdNumber?: string | null;
  feeOverrideCents?: number | null;
  category?: ({ monthlyFeeCents?: number | null } & object) | null;
  planEntries?: unknown[];
  creditBalance?: unknown;
  guardians?: ({ idNumber?: string | null } & object)[];
};

export function serializeChild<T extends ChildLike>(child: T, canViewMoney: boolean): T {
  const out: T = { ...child };
  // Writes go through a loosely-typed alias: T's exact field types are
  // generic, but every assignment below keeps the same shape.
  const o = out as ChildLike;
  if ("childIdNumber" in child) o.childIdNumber = maskIdNumber(child.childIdNumber ?? null);
  if ("parentIdNumber" in child) o.parentIdNumber = maskIdNumber(child.parentIdNumber ?? null);
  if (child.guardians) {
    o.guardians = child.guardians.map((g) => ({ ...g, idNumber: maskIdNumber(g.idNumber ?? null) }));
  }
  if (!canViewMoney) {
    if ("feeOverrideCents" in child) o.feeOverrideCents = null;
    if (child.category) o.category = { ...child.category, monthlyFeeCents: null };
    if ("planEntries" in child) o.planEntries = [];
    if ("creditBalance" in child) o.creditBalance = null;
  }
  return out;
}
