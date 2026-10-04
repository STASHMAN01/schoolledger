import type { Permission, Role } from "@prisma/client";
import { TEACHER_PERMISSION_CEILING } from "@/lib/teacherAccess";

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
  "MANAGE_REPORTS",
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
    label: "Request deletion (no longer used)",
    description:
      "Deleting is one step for admins since 4 Oct 2026, so this no longer does anything. See \"Delete records\".",
  },
  APPROVE_DELETION: {
    label: "Delete records",
    description:
      "Can delete a class or child (to Trash for 30 days), delete a payment (reversed at once, needs a reason), and restore from Trash.",
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
  MANAGE_REPORTS: {
    label: "Manage reports",
    description:
      "Can write and edit incident, academic and disciplinary reports. A Teacher with this is limited to their own assigned class.",
  },
};

// The DEFAULT permission set for each role — the "hardcode the default,
// editable later" half of the model. ADMIN is handled separately (always
// every permission, not editable — see getEffectivePermissions) so it has
// no entry here. These defaults mirror what the app already enforced
// per-role before this file existed, with two deliberate tightenings
// flagged inline below (MANAGER and VIEWER no longer default to seeing
// money) — an admin can grant either back per-person via an override.
// What each role is CALLED on screen. VIEWER is shown as "Read-only
// (Accounting)" (Dylan, 24 Sept 2026: keep the role for a business partner
// or outside accountant who should only look, but make the name say so).
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  MANAGER: "Manager",
  VIEWER: "Read-only (Accounting)",
  TEACHER: "Teacher",
  RECEPTIONIST: "Receptionist",
};

export function roleLabel(role: string): string {
  return (ROLE_LABEL as Record<string, string>)[role] ?? role;
}

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
    "MANAGE_REPORTS",
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
  // Also the ceiling for every Teacher (TEACHER_PERMISSION_CEILING in
  // src/lib/teacherAccess.ts, Dylan 4 Oct 2026): no managing children, no
  // activity log. All scoped server-side to Membership.assignedCategoryId.
  TEACHER: ["VIEW_CENTRE", "MANAGE_ATTENDANCE", "MANAGE_REPORTS"],
  RECEPTIONIST: [
    "VIEW_CENTRE",
    "MANAGE_CHILDREN", // org-wide, unlike TEACHER
    "MANAGE_ATTENDANCE", // org-wide, unlike TEACHER
    "MANAGE_REPORTS", // org-wide, unlike TEACHER
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
// Class profiles (shared classroom tablets, see src/lib/profiles.ts) never
// get these, whatever their role or override rows say: a tablet sits where
// anyone can pick it up.
export const PROFILE_BLOCKED_PERMISSIONS: Permission[] = [
  "VIEW_ACCOUNTING",
  "VIEW_MONEY",
  "RECORD_PAYMENTS",
  "MANAGE_TEAM",
  "MANAGE_BILLING",
  "MANAGE_SETTINGS",
  "EXPORT_DATA",
  "APPROVE_DELETION",
  "REQUEST_DELETION",
  "SEND_REMINDERS",
  "MANAGE_EVENTS",
  "MANAGE_CLASSES",
  // The activity feed names every staff member and what they did, money
  // included -- not for a shared screen.
  "VIEW_ACTIVITY_LOG",
];

/** Strip anything a class profile must never have. */
export function limitProfilePermissions(permissions: Permission[]): Permission[] {
  const blocked = new Set(PROFILE_BLOCKED_PERMISSIONS);
  return permissions.filter((p) => !blocked.has(p));
}

export function getEffectivePermissions(
  role: Role,
  overrides: PermissionOverride[] = [],
  options: { isProfile?: boolean } = {}
): Permission[] {
  if (options.isProfile) {
    // A profile is only ever a TEACHER; anything else gets nothing.
    if (role !== "TEACHER") return [];
    return limitProfilePermissions(getEffectivePermissions(role, overrides));
  }
  if (role === "ADMIN") return [...ALL_PERMISSIONS];
  if (role === "TEACHER") {
    // Every Teacher is capped (Dylan, 4 Oct 2026): register, routine and
    // incident reports only, whatever per-person ticks exist. See
    // src/lib/teacherAccess.ts for the rest of the teacher rules.
    const ceiling = new Set<Permission>(TEACHER_PERMISSION_CEILING);
    return applyOverrides(role, overrides).filter((p) => ceiling.has(p));
  }
  return applyOverrides(role, overrides);
}

function applyOverrides(role: Exclude<Role, "ADMIN">, overrides: PermissionOverride[]): Permission[] {
  const effective = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]);
  for (const o of overrides) {
    if (o.granted) effective.add(o.permission);
    else effective.delete(o.permission);
  }
  return Array.from(effective);
}

