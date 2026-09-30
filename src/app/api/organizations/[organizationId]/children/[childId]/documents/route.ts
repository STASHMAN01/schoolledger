import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { contentTypeOf, documentLabel, documentUploadSchema } from "@/lib/documents";
import { documentListSelect, missingForChild } from "@/lib/childDocuments";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

async function accessibleChild(organizationId: string, childId: string, role: string, assignedCategoryId: string | null) {
  const child = await db.child.findFirst({
    where: { id: childId, organizationId },
    select: { id: true, categoryId: true, firstName: true },
  });
  if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) return null;
  return child;
}

// The child's documents on file (no file contents -- those come from
// /documents/[documentId]) plus what is still missing.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);
    if (!(await accessibleChild(organizationId, childId, role, assignedCategoryId))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const documents = await db.childDocument.findMany({
      where: { organizationId, childId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: documentListSelect,
    });
    const { required, missing } = await missingForChild(organizationId, childId);
    return NextResponse.json({ documents, required, missing });
  } catch (err) {
    return handleApiError(err);
  }
}

// Staff upload one document for this child (a parent's ID names the
// guardian it belongs to).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_CHILDREN");
    const child = await accessibleChild(organizationId, childId, role, assignedCategoryId);
    if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const body = documentUploadSchema.parse(await req.json());
    let guardianId: string | null = null;
    if (body.guardianId) {
      const g = await db.guardian.findFirst({
        where: { id: body.guardianId, childId, organizationId },
        select: { id: true },
      });
      if (!g) return NextResponse.json({ error: "That parent/guardian isn't on file." }, { status: 400 });
      guardianId = g.id;
    }

    const doc = await db.childDocument.create({
      data: {
        organizationId,
        childId,
        guardianId,
        type: body.type,
        fileName: body.fileName ?? null,
        contentType: contentTypeOf(body.file),
        fileData: body.file,
        status: "ACTIVE",
        source: "staff",
        uploadedByUserId: userId,
      },
      select: documentListSelect,
    });

    await logAudit({
      organizationId,
      userId,
      action: "child.document.uploaded",
      entityType: "Child",
      entityId: childId,
      metadata: { childFirstName: child.firstName, document: documentLabel(body.type) },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
