import type { Permission, Role } from "@prisma/client";

// The full closed set, used for ADMIN (who always has everything, see
// getEffectivePermissions) and to validate override rows.
export const ALL_PERMISSIONS: Permission[] = [
  "VIEW_CENTRE",
  "VIEW_ACCOUNTING",
  "VIEW_MONEY",
  "RECORD_PAYMENTS",
  "MANAGE_CHILDREN",
  "MANAGE_CLASSES",
  "MANAGE_EVENTS",
  "SEND_REMINDERS",
  "REQUEST_DELETION",
  "APPROVE_DELETION",
  "MANAGE_TEAM",
  "MANAGE_BILLING",
  "MANAGE_SETTINGS",
  "VIEW_ACTIVITY_LOG",
  "MANAGE_ATTENDANCE",
  "EXPORT_DATA",
];

// A short label + a longer hover-tooltip description for every
// permission — shown on the Team page next to each toggle, and next to a
// member's role badge to summarize what that role currently grants. This
// is the ONE place that wording lives, so the UI and any future docs
// can't drift apart.
export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  VIEW_CENTRE: {
    label: "View Centre Management",
    description: "Can switch into Centre Management mode and see its pages.",
  },
  VIEW_ACCOUNTING: {
    label: "View Accounting",
    description: "Can switch into Accounting mode and see its pages (billing lives here).",
  },
  VIEW_MONEY: {
    label: "See money",
    description:
      "Can see payment amounts, statements, and financial totals (dashboard, payments list, exports).",
  },
  RECORD_PAYMENTS: {
    label: "Record payments",
    description: "Can record a new payment against a child's account.",
  },
  MANAGE_CHILDREN: {
    label: "Manage children",
    description:
      "Can add, edit, and archive children. A Teacher with this is limited to their own assigned class.",
  },
  MANAGE_CLASSES: {
    label: "Manage classes",
    description: "Can add, edit, and archive classes.",
  },
  MANAGE_EVENTS: {
    label: "Manage events",
    description: "Can create one-time class-wide charges (e.g. a school trip).",
  },
  SEND_REMINDERS: {
    label: "Send reminders",
    description:
      "Can mark a payment reminder as sent. Combined with \"See money\", can also request/approve a bulk \"send all reminders\".",
  },
  REQUEST_DELETION: {
    label: "Request deletion",
    description:
      "Can request that a class, child, or payment be permanently deleted (still needs 2 approvals).",
  },
  APPROVE_DELETION: {
    label: "Approve deletion",
    description:
      "Can approve a pending deletion request, restore something from Trash, and request a child's deletion.",
  },
  MANAGE_TEAM: {
    label: "Manage team",
    description: "Can invite/remove people and change what any member can see and do.",
  },
  MANAGE_BILLING: {
    label: "Manage billing",
    description: "Can subscribe, change plan, or cancel the school's own subscription.",
  },
  MANAGE_SETTINGS: {
    label: "Manage settings",
    description: "Can edit the school's profile/letterhead/bank details and payment types.",
  },
  VIEW_ACTIVITY_LOG: {
    label: "View activity log",
    description: "Can see the \"who did what, when\" activity feed.",
  },
  MANAGE_ATTENDANCE: {
    label: "Manage attendance",
    description:
      "Can take/edit daily attendance and email absent children's parents. A Teacher with this is limited to their own assigned class.",
  },
  EXPORT_DATA: {
    label: "Backup & export",
    description:
      "Can download a full password-protected backup of the organization's data (records, forms, statements, payments).",
  },
};

// The DEFAULT permission set for each role — the "hardcode the default,
// editable later" half of the model. ADMIN is handled separately (always
// every permission, not editable — see getEffectivePermissions) so it has
// no entry here. These defaults mirror what the app already enforced
// per-role before this file existed, with two deliberate tightenings
// flagged inline below (MANAGER and VIEWER no longer default to seeing
// money) — an admin can grant either back per-person via an override.
export const ROLE_DEFAULT_PERMISSIONS: Record<Exclude<Role, "ADMIN">, Permission[]> = {
  ACCOUNTANT: [
    "VIEW_ACCOUNTING",
    "VIEW_MONEY",
    "RECORD_PAYMENTS",
    "MANAGE_CHILDREN",
    "MANAGE_CLASSES",
    "MANAGE_EVENTS",
    "SEND_REMINDERS",
    "REQUEST_DELETION",
    "VIEW_ACTIVITY_LOG",
    // Deliberately no VIEW_CENTRE — an accountant's dashboard doesn't even
    // show the Centre/Accounting mode switch, per Dylan's own example.
  ],
  MANAGER: [
    "VIEW_CENTRE",
    "VIEW_ACCOUNTING",
    "MANAGE_CHILDREN",
    "MANAGE_CLASSES",
    "MANAGE_ATTENDANCE",
    "SEND_REMINDERS",
    "REQUEST_DELETION",
    "VIEW_ACTIVITY_LOG",
    // Tightened 2026-09-21: MANAGER no longer defaults to VIEW_MONEY /
    // RECORD_PAYMENTS. The plan always claimed "managers cannot see
    // money" but nothing server-side actually enforced it — this is that
    // fix. Grant VIEW_MONEY back per-person via an override if needed.
  ],
  VIEWER: [
    "VIEW_ACCOUNTING",
    "VIEW_ACTIVITY_LOG",
    // Tightened 2026-09-21 alongside MANAGER, for the same reason — a
    // read-only role shouldn't default to full financial visibility
    // either. Grant VIEW_MONEY per-person if this viewer should be a
    // bookkeeper-style read-only accountant.
  ],
  TEACHER: [
    "VIEW_CENTRE",
    "MANAGE_CHILDREN", // scoped server-side to Membership.assignedCategoryId
    "MANAGE_ATTENDANCE", // scoped server-side to Membership.assignedCategoryId
    "VIEW_ACTIVITY_LOG",
  ],
  RECEPTIONIST: [
    "VIEW_CENTRE",
    "MANAGE_CHILDREN", // org-wide, unlike TEACHER
    "MANAGE_ATTENDANCE", // org-wide, unlike TEACHER
    "VIEW_ACTIVITY_LOG",
  ],
};

export type PermissionOverride = { permission: Permission; granted: boolean };

// Resolve a membership's actual permission set: ADMIN always gets
// everything (not overridable — "admin is the highest level of access,
// they see everything"); anyone else starts from their role's default and
// has each override row applied on top (granted: true adds it even if the
// role default doesn't include it, granted: false removes it even if the
// role default does).
export function getEffectivePermissions(
  role: Role,
  overrides: PermissionOverride[] = []
): Permission[] {
  if (role === "ADMIN") return [...ALL_PERMISSIONS];

  const effective = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]);
  for (const o of overrides) {
    if (o.granted) effective.add(o.permission);
    else effective.delete(o.permission);
  }
  return Array.from(effective);
}

export function hasPermission(
  role: Role,
  overrides: PermissionOverride[],
  permission: Permission
): boolean {
  if (role === "ADMIN") return true;
  return getEffectivePermissions(role, overrides).includes(permission);
}
