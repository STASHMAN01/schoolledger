import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { deleteObject, statObject } from "@/lib/storage";
import { canView } from "@/lib/storedFiles";

type Params = { params: Promise<{ organizationId: string; fileId: string }> };

// Step 2: the tablet says the upload finished. We check the file really
// arrived in the bucket before showing it to anyone, so a failed upload
// never appears as a broken photo.
export async function PUT(_req: Request, { params }: Params) {
  try {
    const { organizationId, fileId } = await params;
    const { role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const file = await db.storedFile.findFirst({
      where: { id: fileId, organizationId },
      select: { id: true, key: true, kind: true, classworkEntryId: true, childReportId: true },
    });
    if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(await canView(organizationId, file, { role, assignedCategoryId, permissions }))) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const stat = await statObject(file.key);
    if (!stat) return NextResponse.json({ error: "The upload didn't arrive. Try again." }, { status: 400 });

    await db.storedFile.update({
      where: { id: file.id },
      data: { status: "ACTIVE", sizeBytes: stat.sizeBytes },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Removing a photo takes the file out of the bucket as well: a deleted
// injury photo should not sit in storage afterwards (POPIA).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { organizationId, fileId } = await params;
    const { userId, role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const file = await db.storedFile.findFirst({
      where: { id: fileId, organizationId },
      select: { id: true, key: true, kind: true, classworkEntryId: true, childReportId: true },
    });
    if (!file) return NextResponse.json({ ok: true });
    if (!(await canView(organizationId, file, { role, assignedCategoryId, permissions }))) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    await deleteObject(file.key);
    await db.storedFile.delete({ where: { id: file.id } });
    await logAudit({
      organizationId,
      userId,
      action: "file.deleted",
      entityType: "StoredFile",
      entityId: file.id,
      metadata: { kind: file.kind },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
