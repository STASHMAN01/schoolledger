// Shared rules for files kept in object storage: who may attach one, and
// who may look at it. Kept out of the route files so the upload, confirm,
// view and delete endpoints can't drift apart on permissions.
import { z } from "zod";
import { db } from "@/lib/db";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, deleteObject } from "@/lib/storage";
import { MAX_GROUP_PHOTOS } from "@/lib/lessonPlan";
import { isStaged } from "@/lib/classwork";

/** A PENDING staged upload this young may still be in flight, so it counts toward the cap. */
const STAGED_IN_FLIGHT_MS = 5 * 60 * 1000;

export const FILE_KINDS = ["CLASSWORK", "REPORT"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** How many photos one incident/academic/disciplinary report may carry. */
export const MAX_FILES_PER_ITEM = 12;

export const uploadRequestSchema = z
  .object({
    kind: z.enum(FILE_KINDS),
    contentType: z.enum(ALLOWED_UPLOAD_TYPES),
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    caption: z.string().trim().max(200).optional(),
    classworkEntryId: z.string().cuid().optional(),
    childReportId: z.string().cuid().optional(),
    // Only meaningful for an INDIVIDUAL-activity classwork entry: which
    // child this photo is of. Ignored for REPORT and for GROUP entries.
    childId: z.string().cuid().optional(),
  })
  // A CLASSWORK upload with no classworkEntryId is a "staged" photo, taken
  // before the entry exists (Dylan, 15 Oct 2026). Reports still need theirs.
  .refine((v) => (v.kind === "CLASSWORK" ? true : !!v.childReportId), {
    message: "The file must be attached to something.",
  });

export type Access = {
  role: string;
  assignedCategoryId: string | null;
  permissions: readonly string[];
  /** Needed to view a staged photo, which only its uploader may see. */
  userId?: string;
};

/**
 * Checks a teacher may stage a classwork photo (one taken before the entry
 * exists). Only a teacher with an assigned class records classwork. A
 * failed earlier try for the same child (a PENDING row) is cleared here so
 * a retry isn't blocked by it.
 */
export async function canStageClasswork(
  organizationId: string,
  userId: string,
  access: Access,
  since: Date,
  childId?: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!access.permissions.includes("VIEW_CENTRE")) {
    return { ok: false, status: 403, error: "Not allowed." };
  }
  if (access.role !== "TEACHER" || !access.assignedCategoryId) {
    return { ok: false, status: 403, error: "Only a class teacher records classwork." };
  }
  // Only photos staged today count (`since` is the start of the school's
  // day): yesterday's leftovers never block today's entry.
  const mine = {
    organizationId,
    kind: "CLASSWORK",
    classworkEntryId: null,
    uploadedByUserId: userId,
    createdAt: { gte: since },
  } as const;
  // A photo that is uploaded (ACTIVE), or is still being uploaded right now.
  const live = [
    { status: "ACTIVE" },
    { status: "PENDING", createdAt: { gte: new Date(Date.now() - STAGED_IN_FLIGHT_MS) } },
  ];

  // One activity at a time: group and individual photos can't be mixed.
  const other = await db.storedFile.findFirst({
    where: { ...mine, OR: live, childId: childId ? null : { not: null } },
    select: { id: true },
  });
  if (other) {
    return {
      ok: false,
      status: 400,
      error: childId
        ? "You already have group photos waiting. Start over to switch to an individual activity."
        : "You already have photos of individual children waiting. Start over to switch to a group activity.",
    };
  }

  if (childId) {
    const child = await db.child.findFirst({
      where: {
        id: childId,
        organizationId,
        categoryId: access.assignedCategoryId,
        archived: false,
        deletedAt: null,
        exitDate: null,
      },
      select: { id: true },
    });
    if (!child) return { ok: false, status: 404, error: "That child isn't in this class." };
    // Staging is idempotent per child: one photo each, never a second.
    const already = await db.storedFile.findFirst({
      where: { ...mine, OR: live, childId },
      select: { id: true },
    });
    if (already) {
      return { ok: false, status: 400, error: "This child already has a photo waiting. Remove it first to replace it." };
    }
    // A failed earlier try (PENDING for a while) is cleared so a retry works.
    const stale = await db.storedFile.findMany({
      where: { ...mine, childId, status: "PENDING" },
      select: { id: true, key: true },
    });
    for (const f of stale) {
      if (f.key) await deleteObject(f.key).catch(() => {});
      await db.storedFile.deleteMany({ where: { id: f.id, classworkEntryId: null, status: "PENDING" } });
    }
    return { ok: true };
  }

  const count = await db.storedFile.count({ where: { ...mine, OR: live } });
  if (count >= MAX_GROUP_PHOTOS) {
    return { ok: false, status: 400, error: `A group activity can have up to ${MAX_GROUP_PHOTOS} photos.` };
  }
  return { ok: true };
}

/**
 * Checks the thing a file hangs off exists in this school and that the
 * caller may touch it. A teacher is held to their own class, exactly as on
 * the classwork and report pages themselves.
 */
export async function canAttachTo(
  organizationId: string,
  kind: FileKind,
  targetId: string,
  access: Access,
  childId?: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (kind === "CLASSWORK") {
    if (!access.permissions.includes("VIEW_CENTRE")) {
      return { ok: false, status: 403, error: "Not allowed." };
    }
    const entry = await db.classworkEntry.findFirst({
      where: { id: targetId, organizationId },
      select: { categoryId: true, activityType: true },
    });
    if (!entry) return { ok: false, status: 404, error: "Not found." };
    if (access.role === "TEACHER" && entry.categoryId !== access.assignedCategoryId) {
      return { ok: false, status: 403, error: "Not allowed for your class." };
    }
    if (entry.activityType === "INDIVIDUAL") {
      if (!childId) return { ok: false, status: 400, error: "Pick which child this photo is of." };
      const child = await db.child.findFirst({
        where: { id: childId, organizationId, categoryId: entry.categoryId, deletedAt: null },
        select: { id: true },
      });
      if (!child) return { ok: false, status: 404, error: "That child isn't in this class." };
      const already = await db.storedFile.findFirst({
        where: { classworkEntryId: targetId, childId, status: { in: ["ACTIVE", "PENDING"] } },
        select: { id: true },
      });
      if (already) return { ok: false, status: 400, error: "This child already has a photo for today." };
    } else {
      if (childId) return { ok: false, status: 400, error: "A group activity's photos aren't tagged to one child." };
      const count = await db.storedFile.count({
        where: { classworkEntryId: targetId, status: { in: ["ACTIVE", "PENDING"] } },
      });
      if (count >= MAX_GROUP_PHOTOS) {
        return { ok: false, status: 400, error: `A group activity can have up to ${MAX_GROUP_PHOTOS} photos.` };
      }
    }
    return { ok: true };
  }

  if (!access.permissions.includes("MANAGE_REPORTS")) {
    return { ok: false, status: 403, error: "Not allowed." };
  }
  const report = await db.childReport.findFirst({
    where: { id: targetId, organizationId },
    select: { categoryId: true },
  });
  if (!report) return { ok: false, status: 404, error: "Not found." };
  if (access.role === "TEACHER" && report.categoryId !== access.assignedCategoryId) {
    return { ok: false, status: 403, error: "Not allowed for your class." };
  }
  return { ok: true };
}

/** Viewing follows the same rule as attaching, minus the write permission. */
export async function canView(
  organizationId: string,
  file: { kind: string; classworkEntryId: string | null; childReportId: string | null; uploadedByUserId?: string },
  access: Access
): Promise<boolean> {
  if (!access.permissions.includes("VIEW_CENTRE")) return false;
  // A staged photo hangs off nothing yet: only the teacher who took it sees it.
  if (isStaged(file)) {
    return access.role === "TEACHER" && !!access.userId && file.uploadedByUserId === access.userId;
  }
  const targetId = file.kind === "CLASSWORK" ? file.classworkEntryId : file.childReportId;
  if (!targetId) return false;
  const categoryId =
    file.kind === "CLASSWORK"
      ? (await db.classworkEntry.findFirst({ where: { id: targetId, organizationId }, select: { categoryId: true } }))
          ?.categoryId
      : (await db.childReport.findFirst({ where: { id: targetId, organizationId }, select: { categoryId: true } }))
          ?.categoryId;
  if (!categoryId) return false;
  if (access.role === "TEACHER" && categoryId !== access.assignedCategoryId) return false;
  return true;
}
