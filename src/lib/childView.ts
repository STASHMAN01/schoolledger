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

// What a Teacher gets (Dylan, 4 Oct 2026): name, class, gender, age
// (date of birth), allergies and emergency contact. Nothing else leaves
// the server for a Teacher -- no parent details, ID numbers, address,
// photo, documents or money. Built as an allowlist so a new Child column
// is never exposed to teachers by accident.
type TeacherChildSource = {
  id: string;
  categoryId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  enrollmentDate: Date;
  exitDate: Date | null;
  archived: boolean;
  category?: { id: string; name: string } | null;
};

export function serializeChildForTeacher(child: TeacherChildSource) {
  return {
    id: child.id,
    categoryId: child.categoryId,
    category: child.category ? { id: child.category.id, name: child.category.name, monthlyFeeCents: null } : null,
    firstName: child.firstName,
    lastName: child.lastName,
    dateOfBirth: child.dateOfBirth,
    gender: child.gender,
    allergies: child.allergies,
    emergencyContactName: child.emergencyContactName,
    emergencyContactRelationship: child.emergencyContactRelationship,
    emergencyContactPhone: child.emergencyContactPhone,
    enrollmentDate: child.enrollmentDate,
    exitDate: child.exitDate,
    archived: child.archived,
    // Empty rather than missing so pages that read them don't crash.
    guardians: [],
    planEntries: [],
    creditBalance: null,
    deletionRequest: null,
    teacherView: true,
  };
}
