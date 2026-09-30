import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { documentLabel } from "@/lib/documents";

type Params = { params: Promise<{ organizationId: string; childId: string; documentId: string }> };

// Remove a document from the child's file (wrong photo, replaced, ...).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, documentId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_CHILDREN");
    const doc = await db.childDocument.findFirst({
      where: { id: documentId, organizationId, childId },
      select: { id: true, type: true, child: { select: { categoryId: true, firstName: true } } },
    });
    if (!doc || !doc.child || (role === "TEACHER" && doc.child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await db.childDocument.delete({ where: { id: doc.id } });
    await logAudit({
      organizationId,
      userId,
      action: "child.document.removed",
      entityType: "Child",
      entityId: childId,
      metadata: { childFirstName: doc.child.firstName, document: documentLabel(doc.type) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
