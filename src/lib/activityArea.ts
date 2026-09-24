// Which AuditLog.entityType values belong to which mode, for the
// Phase 1 "activity feed splits by mode" requirement. Centre Management
// only has Child and Class(Category) actions to show for now — Phase 2/3
// (admissions, attendance, to-dos) will add more CENTRE-area entity types
// here as those features land. Everything else (payments, statements,
// reminders, team/invites, org settings) is Accounting for Phase 1: those
// areas don't have a Centre-side equivalent yet, so there's nowhere else
// for them to show.
export const CENTRE_ENTITY_TYPES = [
  "Child",
  "Category",
  "Guardian",
  "Attendance",
  "Schedule",
  // Online submissions / parent form links (were in neither feed before).
  "ParentSubmission",
  "ParentFormLink",
] as const;

// POPIA (24 Sept 2026): who LOOKED at children's records, as opposed to
// who changed them. Shown only in the admin-only "Privacy log" view of
// Settings -> Activity log, never in the dashboard feeds (profile opens
// would drown out everything else). Profile opens use their own entity
// type so neither mode's feed picks them up.
export const PRIVACY_ACTIONS = [
  "child.profile.viewed",
  "child.idNumber.revealed",
  "parentSubmission.viewed",
] as const;
export const PROFILE_VIEW_ENTITY_TYPE = "ChildProfileView";

export const ACCOUNTING_ENTITY_TYPES = [
  "Payment",
  "PaymentType",
  "Statement",
  "Reminder",
  "Event",
  "Invite",
  "Membership",
  "Organization",
  "Export",
] as const;
