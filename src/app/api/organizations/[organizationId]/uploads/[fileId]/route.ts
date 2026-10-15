import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { deleteObject, statObject } from "@/lib/storage";
import { canView } from "@/lib/storedFiles";
import { isStaged } from "@/lib/classwork";

type Params = { params: Promise<{ organizationId: string; fileId: string }> };

// Step 2: the tablet says the upload finished. We check the file really
// arrived in the bucket before showing it to anyone, so a failed upload
// never appears as a broken photo.
export async function PUT(_req: Request, { params }: Params) {
  try {
    const { organizationId, fileId } = await params;
    const { userId, role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const file = await db.storedFile.findFirst({
      where: { id: fileId, organizationId },
      select: { id: true, key: true, kind: true, classworkEntryId: true, childReportId: true, uploadedByUserId: true },
    });
    if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(await canView(organizationId, file, { role, assignedCategoryId, permissions, userId }))) {
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
// injury photo should not sit in storage afterwards (POPIA). Admin-only
// (Dylan, 8 Oct 2026: "the admin is the only one who can delete the
// uploaded pictures") -- a teacher can add photos but never remove one,
// including their own, once it's uploaded.
//
// One exception (Dylan, 15 Oct 2026): a teacher may remove a STAGED photo of
// their own -- one not yet on a saved entry -- so a wrong photo can be fixed
// before the entry is submitted.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { organizationId, fileId } = await params;
    const { userId, role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const file = await db.storedFile.findFirst({
      where: { id: fileId, organizationId },
      select: { id: true, key: true, kind: true, classworkEntryId: true, childReportId: true, uploadedByUserId: true },
    });
    const ownStaged = !!file && isStaged(file) && role === "TEACHER" && file.uploadedByUserId === userId;
    if (role !== "ADMIN" && !ownStaged) {
      return NextResponse.json({ error: "Only an admin can delete a photo." }, { status: 403 });
    }
    if (!file) return NextResponse.json({ ok: true });
    if (!(await canView(organizationId, file, { role, assignedCategoryId, permissions, userId }))) {
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
