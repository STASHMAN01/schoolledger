import { db } from "@/lib/db";
import { monthRange } from "@/lib/files";
import { gradeRankMap, sortChildrenByGrade } from "@/lib/classGroups";

// One class's attendance for one month (Dylan, 15 Oct 2026): shared by the
// printable PDF (attendance/register/pdf) and the on-screen month view on
// the Attendance page (attendance/register/month), so both always show the
// same children and marks.
//
// Children are the class's current members, the same rule the PDF has
// always used: attendance isn't stored per class, so a child who moved class
// mid-month appears in their new class with all of that month's marks.
// Archived children only appear if they have marks in the month.

export type MonthMark = "PRESENT" | "ABSENT";

export type MonthRow = {
  childId: string;
  firstName: string;
  lastName: string;
  // Grade within a class group (label only); null for a child with none.
  gradeId: string | null;
  gradeName: string | null;
  // day-of-month (1-31) -> status
  marks: Map<number, MonthMark>;
};

export async function loadMonthlyRegister(
  organizationId: string,
  categoryId: string,
  month: string
): Promise<MonthRow[]> {
  // Attendance dates are stored as midnight UTC of the calendar day, so
  // the month's range here is plain UTC, not the school's timezone.
  const { start, end } = monthRange(month, "UTC");

  const [children, records] = await Promise.all([
    db.child.findMany({
      where: { organizationId, categoryId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        archived: true,
        subCategoryId: true,
        subCategory: { select: { id: true, name: true, createdAt: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.attendanceRecord.findMany({
      where: { organizationId, child: { categoryId }, date: { gte: start, lt: end } },
      select: { childId: true, date: true, status: true },
    }),
  ]);

  const marksByChild = new Map<string, Map<number, MonthMark>>();
  for (const r of records) {
    const marks = marksByChild.get(r.childId) ?? new Map<number, MonthMark>();
    marks.set(r.date.getUTCDate(), r.status);
    marksByChild.set(r.childId, marks);
  }

  const rows = children
    .filter((c) => !c.archived || marksByChild.has(c.id))
    .map((c) => ({
      childId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      gradeId: c.subCategory?.id ?? null,
      gradeName: c.subCategory?.name ?? null,
      marks: marksByChild.get(c.id) ?? new Map<number, MonthMark>(),
    }));

  // A class group: sort by grade (display order), then first name, last name.
  const gradeRows = new Map(children.flatMap((c) => (c.subCategory ? [[c.subCategory.id, c.subCategory] as const] : [])));
  if (gradeRows.size === 0) return rows;
  const rank = gradeRankMap([...gradeRows.values()]);
  const byFirstName = [...rows].sort(
    (a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)
  );
  return sortChildrenByGrade(
    byFirstName.map((r) => ({ ...r, subCategoryId: r.gradeId })),
    rank,
    "firstName"
  );
}
