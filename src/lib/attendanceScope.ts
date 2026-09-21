import type { Role } from "@prisma/client";

// Phase 3 Session 1 -- shared "which class(es) can this caller see/mark
// attendance for" resolution, used by every /attendance/* route. Mirrors
// the same override rule the children GET route already uses for TEACHER
// (their assignedCategoryId always wins over whatever the client asked
// for, it never widens it) — kept in one place so the four attendance
// routes can't drift from each other on this.
export type AttendanceScope =
  | { mode: "single"; categoryId: string }
  | { mode: "all" }
  | { mode: "none" }; // TEACHER with no assigned class yet

export function resolveAttendanceScope(
  role: Role,
  assignedCategoryId: string | null,
  requestedCategoryId: string | null | undefined
): AttendanceScope {
  if (role === "TEACHER") {
    if (!assignedCategoryId) return { mode: "none" };
    return { mode: "single", categoryId: assignedCategoryId };
  }
  if (requestedCategoryId) {
    return { mode: "single", categoryId: requestedCategoryId };
  }
  return { mode: "all" };
}
