import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { buildFormFilename } from "@/lib/forms/formPdf";
import { FORM_TYPE_LABELS } from "@/lib/forms/types";

type Params = { params: Promise<{ organizationId: string; childId: string; formId: string }> };

// Serves one previously-generated form PDF and logs exactly who
// downloaded it and when -- the same "distinct, audited action" pattern
// as the ID-number reveal endpoint, since these documents can carry real
// ID numbers, addresses and (for Fee Agreement) a fee amount.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, formId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId);

    const child = await db.child.findFirst({ where: { id: childId, organizationId } });
    if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const document = await db.formDocument.findFirst({
      where: { id: formId, childId, organizationId },
    });
    if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await logAudit({
      organizationId,
      userId,
      action: "form.downloaded",
      entityType: "Child",
      entityId: childId,
      metadata: { formType: document.formType, formLabel: FORM_TYPE_LABELS[document.formType], documentId: document.id },
    });

    const match = /^data:application\/pdf;base64,(.+)$/.exec(document.pdf);
    if (!match) {
      return NextResponse.json({ error: "That document is corrupted." }, { status: 500 });
    }
    const bytes = Buffer.from(match[1], "base64");
    const filename = buildFormFilename(child.firstName, child.lastName, FORM_TYPE_LABELS[document.formType], document.generatedAt);

    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
