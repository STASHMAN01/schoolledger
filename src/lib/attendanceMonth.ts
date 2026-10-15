import { db } from "@/lib/db";
import { monthRange } from "@/lib/files";

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
      select: { id: true, firstName: true, lastName: true, archived: true },
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

  return children
    .filter((c) => !c.archived || marksByChild.has(c.id))
    .map((c) => ({
      childId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      marks: marksByChild.get(c.id) ?? new Map<number, MonthMark>(),
    }));
}
