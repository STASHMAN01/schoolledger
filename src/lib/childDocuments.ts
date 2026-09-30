import { db } from "@/lib/db";
import { missingDocuments, normaliseRequired, type MissingDocument } from "@/lib/documents";

// Server-side helpers for the documents feature (see src/lib/documents.ts).

export async function requiredDocumentsFor(organizationId: string): Promise<string[]> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { requiredDocuments: true },
  });
  return normaliseRequired(org?.requiredDocuments);
}

export type ChildMissing = {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  missing: MissingDocument[];
};

/**
 * Every current child (not archived, not left, not deleted) that is missing
 * at least one required document. A TEACHER only sees their own class.
 */
export async function childrenMissingDocuments(
  organizationId: string,
  opts: { categoryId?: string | null; childId?: string } = {}
): Promise<{ required: string[]; children: ChildMissing[] }> {
  const required = await requiredDocumentsFor(organizationId);
  if (required.length === 0) return { required, children: [] };
  const now = new Date();
  const kids = await db.child.findMany({
    where: {
      organizationId,
      archived: false,
      deletedAt: null,
      OR: [{ exitDate: null }, { exitDate: { gte: now } }],
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts.childId ? { id: opts.childId } : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentPhone: true,
      parentEmail: true,
      category: { select: { name: true } },
      guardians: { orderBy: { createdAt: "asc" }, select: { id: true, firstName: true, lastName: true } },
      documents: { where: { status: "ACTIVE" }, select: { type: true, guardianId: true } },
    },
  });
  const children: ChildMissing[] = [];
  for (const k of kids) {
    const missing = missingDocuments(k.guardians, k.documents, required);
    if (missing.length) {
      children.push({
        id: k.id,
        firstName: k.firstName,
        lastName: k.lastName,
        className: k.category.name,
        parentName: k.parentName,
        parentPhone: k.parentPhone,
        parentEmail: k.parentEmail,
        missing,
      });
    }
  }
  return { required, children };
}

/** Missing documents for one child (whatever its status), for its profile. */
export async function missingForChild(organizationId: string, childId: string) {
  const required = await requiredDocumentsFor(organizationId);
  const child = await db.child.findFirst({
    where: { id: childId, organizationId },
    select: {
      guardians: { orderBy: { createdAt: "asc" }, select: { id: true, firstName: true, lastName: true } },
      documents: { where: { status: "ACTIVE" }, select: { type: true, guardianId: true } },
    },
  });
  if (!child) return { required, missing: [] as MissingDocument[] };
  return { required, missing: missingDocuments(child.guardians, child.documents, required) };
}

/** A pending upload's metadata, safe to send to the browser (no file). */
export const documentListSelect = {
  id: true,
  type: true,
  guardianId: true,
  guardianIndex: true,
  fileName: true,
  contentType: true,
  source: true,
  status: true,
  createdAt: true,
} as const;

// Parent uploads in an online form that were never submitted.
export async function purgeAbandonedUploads(olderThanDays = 2): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const { count } = await db.childDocument.deleteMany({
    where: { status: "PENDING", submissionId: null, createdAt: { lt: cutoff } },
  });
  return count;
}
