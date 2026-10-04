// Deleting (Dylan, 4 Oct 2026): one step for an admin, no approvals. A
// deleted class or child goes to Settings -> Trash for TRASH_RETENTION_DAYS,
// restorable, and admins get a "final review" to-do on the last day
// before it is removed for good. The delete itself is in
// src/lib/deletionExecute.ts; the purge is purgeExpiredTrash below.

// How long a deleted class or child sits in Trash, restorable.
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Anything deleted before this moment is past its 30 days. */
export function trashPurgeCutoff(now: number = Date.now()): Date {
  return new Date(now - TRASH_RETENTION_DAYS * DAY_MS);
}

/**
 * The deletedAt range whose records are on their last day: deleted
 * between 30 and 29 days ago, so permanently removed within 24 hours.
 * Only that one-day window, so a child kept forever because of payment
 * history (see purgeExpiredTrash) doesn't sit on the to-do list forever.
 */
export function finalReviewWindow(now: number = Date.now()): { gte: Date; lt: Date } {
  return {
    gte: trashPurgeCutoff(now),
    lt: new Date(now - (TRASH_RETENTION_DAYS - 1) * DAY_MS),
  };
}

/** Whole days left before a record deleted at `deletedAt` is purged. */
export function trashDaysRemaining(deletedAt: Date, now: number = Date.now()): number {
  const purgeAt = deletedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((purgeAt - now) / DAY_MS));
}
