// Database side of staged classwork photos (Dylan, 15 Oct 2026): who is
// present today, and the daily cleanup of photos nobody submitted.
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { schoolDateRange } from "@/lib/dailySummary";
import { expiredStagedWhere } from "@/lib/classwork";

/**
 * Today's register for one class, as the individual-activity photo rule
 * needs it. `date` is the school's date ("YYYY-MM-DD"); AttendanceRecord
 * dates are midnight UTC of the school day.
 */
export async function presentToday(organizationId: string, categoryId: string, date: string) {
  const { gte, lt } = schoolDateRange(date);
  const [presentChildren, recordCount] = await Promise.all([
    db.child.findMany({
      where: {
        organizationId,
        categoryId,
        archived: false,
        deletedAt: null,
        attendanceRecords: { some: { organizationId, date: { gte, lt }, status: "PRESENT" } },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.attendanceRecord.count({
      where: { organizationId, date: { gte, lt }, child: { categoryId } },
    }),
  ]);
  return { presentChildren, registerTaken: recordCount > 0 };
}

/**
 * Daily cleanup: staged classwork photos (on no entry) older than 24 hours,
 * ACTIVE or still PENDING, leave the bucket and the database. Report photos
 * and photos on a saved entry are never selected. Returns how many went.
 */
export async function purgeStagedClassworkPhotos(now: Date = new Date()): Promise<number> {
  const stale = await db.storedFile.findMany({
    where: expiredStagedWhere(now),
    select: { id: true, key: true },
    take: 1000,
  });
  let removed = 0;
  for (const file of stale) {
    try {
      if (file.key) await deleteObject(file.key);
    } catch {
      // Storage not configured or unreachable: nothing to remove there.
    }
    const { count } = await db.storedFile.deleteMany({ where: { id: file.id, classworkEntryId: null } });
    removed += count;
  }
  return removed;
}
