import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { contentTypeOf, documentTypeDef, documentUploadSchema, normaliseRequired } from "@/lib/documents";

// Documents parents upload through an online form (Dylan, 30 Sept 2026).
// Each file is sent on its own as soon as it's picked (one photo per
// request keeps every request small); the form's final submit then lists
// the uploads it made, and they wait (PENDING) until staff approve.

export const publicUploadSchema = documentUploadSchema.extend({
  uploadKey: z.string().uuid().optional(),
});

export type RequiredDocInfo = { type: string; label: string; hint: string; perGuardian: boolean };

export function requiredDocInfo(required: readonly string[]): RequiredDocInfo[] {
  return normaliseRequired(required).map((t) => {
    const d = documentTypeDef(t)!;
    return { type: t, label: d.label, hint: d.hint, perGuardian: Boolean(d.perGuardian) };
  });
}

// A form never needs more than a handful of documents.
const MAX_STAGED_PER_FORM = 15;

/** Stage one upload, or null when this form already has too many. */
export async function stagePendingUpload(
  organizationId: string,
  body: z.infer<typeof publicUploadSchema>
) {
  const already = await db.childDocument.count({
    where: { organizationId, uploadKey: body.uploadKey, status: "PENDING", submissionId: null },
  });
  if (already >= MAX_STAGED_PER_FORM) return null;
  return db.childDocument.create({
    data: {
      organizationId,
      childId: null,
      guardianIndex: body.guardianIndex ?? null,
      type: body.type,
      fileName: body.fileName ?? null,
      contentType: contentTypeOf(body.file),
      fileData: body.file,
      status: "PENDING",
      source: "parent",
      uploadKey: body.uploadKey,
    },
    select: { id: true, type: true, guardianIndex: true },
  });
}

type Staged = { id: string; type: string; guardianIndex: number | null };

/** The uploads a submission lists, checked to belong to this browser's form. */
export async function findStaged(
  organizationId: string,
  uploadKey: string | undefined,
  documentIds: string[] | undefined
): Promise<Staged[] | null> {
  const ids = [...new Set(documentIds ?? [])];
  if (ids.length === 0) return [];
  if (!uploadKey) return null;
  const docs = await db.childDocument.findMany({
    where: { id: { in: ids }, organizationId, uploadKey, status: "PENDING", submissionId: null },
    select: { id: true, type: true, guardianIndex: true },
  });
  return docs.length === ids.length ? docs : null;
}

/**
 * Which required documents a form still lacks. `stillNeeded` = the
 * once-per-child types that must be uploaded (for an existing child, only
 * those not already on file); every submitted parent needs their own ID
 * when GUARDIAN_ID is required.
 */
export function uncoveredRequirements(
  required: readonly string[],
  stillNeeded: readonly string[],
  guardianCount: number,
  staged: Staged[]
): string[] {
  const problems: string[] = [];
  for (const t of normaliseRequired(required)) {
    const def = documentTypeDef(t)!;
    if (def.perGuardian) {
      for (let i = 0; i < guardianCount; i++) {
        if (!staged.some((d) => d.type === t && d.guardianIndex === i)) {
          problems.push(`${def.label} for parent/guardian ${i + 1}`);
        }
      }
    } else if (stillNeeded.includes(t) && !staged.some((d) => d.type === t)) {
      problems.push(def.label);
    }
  }
  return problems;
}

/** Attach the uploads to the submission; false if any were taken meanwhile. */
export async function attachStaged(tx: Tx, docs: Staged[], submissionId: string) {
  if (docs.length === 0) return true;
  const { count } = await tx.childDocument.updateMany({
    where: { id: { in: docs.map((d) => d.id) }, status: "PENDING", submissionId: null },
    data: { submissionId },
  });
  return count === docs.length;
}

/**
 * On approval: the submission's uploads go onto the child's file, parent
 * IDs linked to the guardians just created (same order as submitted).
 */
export async function activateSubmissionDocuments(
  tx: Tx,
  submissionId: string,
  childId: string,
  createdGuardianIds: string[]
) {
  const docs = await tx.childDocument.findMany({
    where: { submissionId, status: "PENDING" },
    select: { id: true, guardianIndex: true },
  });
  for (const d of docs) {
    await tx.childDocument.update({
      where: { id: d.id },
      data: {
        status: "ACTIVE",
        childId,
        guardianId: d.guardianIndex !== null ? createdGuardianIds[d.guardianIndex] ?? null : null,
        uploadKey: null,
      },
    });
  }
}
