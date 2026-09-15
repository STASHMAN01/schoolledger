import type { Role } from "@prisma/client";

// Separate from REQUIRED_DELETION_APPROVALS (src/lib/deletion.ts) even
// though it's currently the same number — these are two different
// policies (one for deleting records, one for bulk-emailing parents)
// that happen to agree today but shouldn't be forced to stay in lockstep
// just because they share a value.
export const REQUIRED_REMINDER_SEND_APPROVALS = 2;

// Who may request and approve a "send all reminders" blast: ADMIN or
// ACCOUNTANT, any combination of 2 distinct people, never a MANAGER or
// VIEWER — per the org owner's own spec ("either 2 admins or 2
// directors or 2 accountants or 1 admin and 1 director... never a
// viewer"; "director" already maps to ADMIN elsewhere in this app, see
// isHighPositionRole in src/lib/deletion.ts).
export function canHandleReminderSend(role: Role) {
  return role === "ADMIN" || role === "ACCOUNTANT";
}
