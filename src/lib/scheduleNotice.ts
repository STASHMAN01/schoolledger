import { db } from "@/lib/db";

// Phase 5 "teacher notification" for timetable changes, built on AuditLog
// rather than a new column: a class has an unseen change for a user when
// someone else's latest `schedule.updated` for that class is newer than
// that user's latest `schedule.acknowledged` for it.
export async function hasUnseenScheduleChange(
  organizationId: string,
  userId: string,
  categoryId: string
): Promise<boolean> {
  const [lastUpdate, lastAck] = await Promise.all([
    db.auditLog.findFirst({
      where: {
        organizationId,
        action: "schedule.updated",
        entityType: "Schedule",
        entityId: categoryId,
        NOT: { userId },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.auditLog.findFirst({
      where: {
        organizationId,
        action: "schedule.acknowledged",
        entityType: "Schedule",
        entityId: categoryId,
        userId,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  if (!lastUpdate) return false;
  return !lastAck || lastAck.createdAt < lastUpdate.createdAt;
}
