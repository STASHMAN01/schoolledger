// Which AuditLog.entityType values belong to which mode, for the
// Phase 1 "activity feed splits by mode" requirement. Centre Management
// only has Child and Class(Category) actions to show for now — Phase 2/3
// (admissions, attendance, to-dos) will add more CENTRE-area entity types
// here as those features land. Everything else (payments, statements,
// reminders, team/invites, org settings) is Accounting for Phase 1: those
// areas don't have a Centre-side equivalent yet, so there's nowhere else
// for them to show.
export const CENTRE_ENTITY_TYPES = ["Child", "Category", "Guardian"] as const;

export const ACCOUNTING_ENTITY_TYPES = [
  "Payment",
  "PaymentType",
  "Statement",
  "Reminder",
  "Event",
  "Invite",
  "Membership",
  "Organization",
] as const;
