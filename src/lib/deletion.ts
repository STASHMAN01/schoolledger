// Every "permanently delete a record" flow in this app goes through a
// DeletionRequest, never a direct delete — see prisma/schema.prisma's
// comment on that model. This constant is the one place that number lives,
// so the API routes and the UI copy explaining the flow can never drift
// apart.
export const REQUIRED_DELETION_APPROVALS = 2;

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
