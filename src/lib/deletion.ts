// Every "permanently delete a record" flow in this app goes through a
// DeletionRequest, never a direct delete — see prisma/schema.prisma's
// comment on that model. This constant is the one place that number lives,
// so the API routes and the UI copy explaining the flow can never drift
// apart.
export const REQUIRED_DELETION_APPROVALS = 2;

// ...except that two approvals are impossible in a school that only has
// one admin, which is most of them: a crèche run by its owner. Before
// 2 Oct 2026 such a school could request a deletion, approve it once, and
// sit at 1/2 forever — nothing could ever be deleted, including a payment
// recorded by mistake. Found in an outside audit of the landing page.
//
// So the requirement is "two admins, or everyone who can approve if that
// is fewer than two". A school with a second admin still gets the
// two-person check; a one-owner school is no longer stuck. Dylan's call,
// 2 Oct 2026.
export function requiredApprovalsFor(eligibleApprovers: number): number {
  // Math.max(1, ...) guards the degenerate zero case: an org with nobody
  // holding APPROVE_DELETION must not end up "0 approvals required",
  // which would delete the record the moment a request was raised.
  return Math.max(1, Math.min(REQUIRED_DELETION_APPROVALS, eligibleApprovers));
}

// "High position" in the product sense (per the org owner's own words) used
// to map onto a single hardcoded role (ADMIN). Replaced 2026-09-21 by the
// APPROVE_DELETION permission (see src/lib/permissions.ts) — ADMIN still
// has it by default (and always, non-overridably), but it's now a
// permission like any other rather than a role literal baked into route
// code, so it can be granted to someone else per-person if ever needed.

// How long a deleted record sits in Settings → Trash, restorable, before a
// trash-page load is allowed to purge it for good.
export const TRASH_RETENTION_DAYS = 30;

export function trashPurgeCutoff(): Date {
  return new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
