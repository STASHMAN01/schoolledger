import type { Role } from "@prisma/client";

// Every "permanently delete a record" flow in this app goes through a
// DeletionRequest, never a direct delete — see prisma/schema.prisma's
// comment on that model. This constant is the one place that number lives,
// so the API routes and the UI copy explaining the flow can never drift
// apart.
export const REQUIRED_DELETION_APPROVALS = 2;

// "High position" in the product sense (per the org owner's own words) maps
// onto the one elevated role this schema actually has — ADMIN. There's no
// separate "Director" role today; if that distinction matters later it's a
// small follow-up (a new Role value plus this check), not a redesign.
export function isHighPositionRole(role: Role) {
  return role === "ADMIN";
}

// How long a deleted record sits in Settings → Trash, restorable, before a
// trash-page load is allowed to purge it for good.
export const TRASH_RETENTION_DAYS = 30;

export function trashPurgeCutoff(): Date {
  return new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
