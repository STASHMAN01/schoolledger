import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Write an audit trail entry. Call this for anything a school admin would
 * reasonably want to know "who did this" for later — payments recorded,
 * children/categories archived, statements generated/viewed, invites sent,
 * settings changed, login from a new device, etc.
 *
 * This is intentionally fire-and-forget from the caller's perspective but
 * awaited internally: a failed audit write should not silently vanish, but
 * it also should not be allowed to fail the user's actual request. Errors
 * are logged, not thrown.
 */
export async function logAudit(entry: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata:
          entry.metadata !== undefined
            ? (entry.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log entry", entry.action, err);
  }
}
