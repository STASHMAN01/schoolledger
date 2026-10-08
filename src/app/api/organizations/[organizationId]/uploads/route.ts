import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { buildKey, signUpload, storageConfigured } from "@/lib/storage";
import { MAX_FILES_PER_ITEM, canAttachTo, uploadRequestSchema } from "@/lib/storedFiles";

type Params = { params: Promise<{ organizationId: string }> };

// Step 1 of an upload: the tablet asks where to put the file. It gets back a
// link straight to the bucket that works for five minutes, so the photo never
// passes through the website. The row is PENDING until the tablet confirms.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    if (!storageConfigured()) {
      return NextResponse.json({ error: "Photo storage isn't set up yet." }, { status: 503 });
    }

    const body = uploadRequestSchema.parse(await req.json());
    const targetId = (body.kind === "CLASSWORK" ? body.classworkEntryId : body.childReportId)!;
    const allowed = await canAttachTo(organizationId, body.kind, targetId, { role, assignedCategoryId, permissions });
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

    const already = await db.storedFile.count({
      where:
        body.kind === "CLASSWORK"
          ? { classworkEntryId: targetId, status: "ACTIVE" }
          : { childReportId: targetId, status: "ACTIVE" },
    });
    if (already >= MAX_FILES_PER_ITEM) {
      return NextResponse.json({ error: `That already has ${MAX_FILES_PER_ITEM} photos.` }, { status: 400 });
    }

    const file = await db.storedFile.create({
      data: {
        organizationId,
        key: "", // set below, once we know the id
        kind: body.kind,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
        caption: body.caption || null,
        uploadedByUserId: userId,
        classworkEntryId: body.kind === "CLASSWORK" ? targetId : null,
        childReportId: body.kind === "REPORT" ? targetId : null,
      },
      select: { id: true },
    });
    const key = buildKey(organizationId, body.kind, file.id, body.contentType);
    await db.storedFile.update({ where: { id: file.id }, data: { key } });

    return NextResponse.json({
      fileId: file.id,
      uploadUrl: await signUpload(key, body.contentType),
      contentType: body.contentType,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
