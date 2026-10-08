// Shared rules for files kept in object storage: who may attach one, and
// who may look at it. Kept out of the route files so the upload, confirm,
// view and delete endpoints can't drift apart on permissions.
import { z } from "zod";
import { db } from "@/lib/db";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const FILE_KINDS = ["CLASSWORK", "REPORT"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** How many photos one classwork entry or report may carry. */
export const MAX_FILES_PER_ITEM = 12;

export const uploadRequestSchema = z
  .object({
    kind: z.enum(FILE_KINDS),
    contentType: z.enum(ALLOWED_UPLOAD_TYPES),
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    caption: z.string().trim().max(200).optional(),
    classworkEntryId: z.string().cuid().optional(),
    childReportId: z.string().cuid().optional(),
  })
  .refine((v) => (v.kind === "CLASSWORK" ? !!v.classworkEntryId : !!v.childReportId), {
    message: "The file must be attached to something.",
  });

export type Access = {
  role: string;
  assignedCategoryId: string | null;
  permissions: readonly string[];
};

/**
 * Checks the thing a file hangs off exists in this school and that the
 * caller may touch it. A teacher is held to their own class, exactly as on
 * the classwork and report pages themselves.
 */
export async function canAttachTo(
  organizationId: string,
  kind: FileKind,
  targetId: string,
  access: Access
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (kind === "CLASSWORK") {
    if (!access.permissions.includes("VIEW_CENTRE")) {
      return { ok: false, status: 403, error: "Not allowed." };
    }
    const entry = await db.classworkEntry.findFirst({
      where: { id: targetId, organizationId },
      select: { categoryId: true },
    });
    if (!entry) return { ok: false, status: 404, error: "Not found." };
    if (access.role === "TEACHER" && entry.categoryId !== access.assignedCategoryId) {
      return { ok: false, status: 403, error: "Not allowed for your class." };
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
  file: { kind: string; classworkEntryId: string | null; childReportId: string | null },
  access: Access
): Promise<boolean> {
  if (!access.permissions.includes("VIEW_CENTRE")) return false;
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
