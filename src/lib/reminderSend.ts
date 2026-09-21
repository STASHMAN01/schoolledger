// Separate from REQUIRED_DELETION_APPROVALS (src/lib/deletion.ts) even
// though it's currently the same number — these are two different
// policies (one for deleting records, one for bulk-emailing parents)
// that happen to agree today but shouldn't be forced to stay in lockstep
// just because they share a value.
export const REQUIRED_REMINDER_SEND_APPROVALS = 2;

// Who may request/approve a "send all reminders" blast, or edit the
// reminder wording: reused directly from the VIEW_MONEY permission (see
// src/lib/permissions.ts) rather than a separate permission — sending a
// bulk email that states exactly what each parent owes is a "who can see
// money" action, and by default that's exactly ADMIN/ACCOUNTANT, matching
// the org owner's original spec ("either 2 admins or 2 accountants...
// never a manager or viewer"). Call sites check
// permissions.includes("VIEW_MONEY") directly.
