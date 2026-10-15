// Database side of staged classwork photos (Dylan, 15 Oct 2026): who is
// present today, and the daily cleanup of photos nobody submitted.
import { db } from "@/lib/db";
import { deleteObjectStrict, storageConfigured } from "@/lib/storage";
import { schoolClock, schoolDateRange } from "@/lib/dailySummary";
import { expiredStagedWhere, schoolDayStart } from "@/lib/classwork";

/**
 * Today's register for one class, as the individual-activity photo rule
 * needs it. `date` is the school's date ("YYYY-MM-DD"); AttendanceRecord
 * dates are midnight UTC of the school day.
 */
/** The instant today's school day began, in the school's own time zone. */
export async function stagedSince(organizationId: string): Promise<Date> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  return schoolDayStart(schoolClock(org?.timezone ?? "Africa/Johannesburg"));
}

/**
 * Removes this teacher's staged classwork photos from before today (bucket
 * and database), so leftovers from an earlier day never get in the way. A
 * photo whose bucket delete fails stays in the database; the daily cleanup
 * retries it, and every staged query already ignores it.
 */
export async function clearOldStaged(organizationId: string, userId: string, since: Date): Promise<void> {
  const old = await db.storedFile.findMany({
    where: { organizationId, uploadedByUserId: userId, kind: "CLASSWORK", classworkEntryId: null, createdAt: { lt: since } },
    select: { id: true, key: true },
  });
  for (const file of old) {
    try {
      if (file.key && storageConfigured()) await deleteObjectStrict(file.key);
    } catch {
      continue;
    }
    await db.storedFile.deleteMany({ where: { id: file.id, classworkEntryId: null } });
  }
}

export async function presentToday(organizationId: string, categoryId: string, date: string) {
  const { gte, lt } = schoolDateRange(date);
  const [presentChildren, recordCount] = await Promise.all([
    db.child.findMany({
      where: {
        organizationId,
        categoryId,
        archived: false,
        deletedAt: null,
        exitDate: null, // same children as the register itself
        attendanceRecords: { some: { organizationId, date: { gte, lt }, status: "PRESENT" } },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.attendanceRecord.count({
      where: { organizationId, date: { gte, lt }, child: { categoryId, archived: false, deletedAt: null, exitDate: null } },
    }),
  ]);
  return { presentChildren, registerTaken: recordCount > 0 };
}

/**
 * Daily cleanup: staged classwork photos (on no entry) older than 24 hours,
 * ACTIVE or still PENDING, leave the bucket and the database (the row stays
 * if the bucket delete fails, so the object is never orphaned). Report photos
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
      if (file.key && storageConfigured()) await deleteObjectStrict(file.key);
    } catch {
      // The bucket delete failed: keep the row so tomorrow's run retries it.
      continue;
    }
    const { count } = await db.storedFile.deleteMany({ where: { id: file.id, classworkEntryId: null } });
    removed += count;
  }
  return removed;
}
