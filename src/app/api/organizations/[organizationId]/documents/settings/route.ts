import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { DOCUMENT_TYPES, normaliseRequired, requiredDocumentsSchema } from "@/lib/documents";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId);
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { requiredDocuments: true },
    });
    return NextResponse.json({ types: DOCUMENT_TYPES, requiredDocuments: normaliseRequired(org.requiredDocuments) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Which documents every child must have on file.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_SETTINGS");
    const body = requiredDocumentsSchema.parse(await req.json());
    const requiredDocuments = normaliseRequired(body.requiredDocuments);
    await db.organization.update({ where: { id: organizationId }, data: { requiredDocuments } });
    await logAudit({
      organizationId,
      userId,
      action: "documents.requirementsUpdated",
      entityType: "Organization",
      entityId: organizationId,
      metadata: { requiredDocuments },
    });
    return NextResponse.json({ requiredDocuments });
  } catch (err) {
    return handleApiError(err);
  }
}
