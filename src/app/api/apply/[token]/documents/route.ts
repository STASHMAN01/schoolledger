import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { hashInviteToken as hashFormToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { contentTypeOf, documentLabel, documentTypeDef } from "@/lib/documents";
import { publicUploadSchema, stagePendingUpload } from "@/lib/publicDocuments";
import { missingForChild } from "@/lib/childDocuments";

type Params = { params: Promise<{ token: string }> };

// A parent uploads one document through a child's link (Dylan, 30 Sept
// 2026). On a "documents" link it goes straight onto the child's file;
// on a "details" link it waits with the form until staff approve it.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { allowed: ipAllowed } = rateLimit(`apply-doc-ip:${clientIp(req.headers)}`, {
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }
    const { token } = await params;
    const tokenHash = hashFormToken(token);
    const { allowed: tokenAllowed } = rateLimit(`apply-doc-token:${tokenHash}`, {
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!tokenAllowed) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }

    const link = await db.parentFormLink.findUnique({
      where: { tokenHash },
      include: { child: { select: { firstName: true } } },
    });
    const usable =
      link && link.expiresAt >= new Date() && (link.purpose === "documents" || !link.submittedAt);
    if (!link || !usable) {
      return NextResponse.json(
        { error: "This link is invalid, has expired, or has already been used." },
        { status: 404 }
      );
    }

    const body = publicUploadSchema.parse(await req.json());

    if (link.purpose !== "documents") {
      if (!body.uploadKey) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
      const doc = await stagePendingUpload(link.organizationId, body);
      if (!doc) return NextResponse.json({ error: "Too many uploads on this form." }, { status: 429 });
      return NextResponse.json({ document: doc }, { status: 201 });
    }

    // Documents link: only what is still missing for this child (so the
    // link can't be used to pile up files), and a parent's ID must be one
    // of the missing parents.
    const before = await missingForChild(link.organizationId, link.childId);
    const perGuardian = Boolean(documentTypeDef(body.type)?.perGuardian);
    const wanted = before.missing.find(
      (m) => m.type === body.type && (!perGuardian || (m.guardianId ?? null) === (body.guardianId ?? null))
    );
    if (!wanted) {
      return NextResponse.json({ error: "That document is already on file. Thank you!" }, { status: 409 });
    }
    const guardianId = wanted.guardianId ?? null;

    await db.childDocument.create({
      data: {
        organizationId: link.organizationId,
        childId: link.childId,
        guardianId,
        type: body.type,
        fileName: body.fileName ?? null,
        contentType: contentTypeOf(body.file),
        fileData: body.file,
        status: "ACTIVE",
        source: "parent",
      },
    });

    await logAudit({
      organizationId: link.organizationId,
      action: "child.document.parentUploaded",
      entityType: "Child",
      entityId: link.childId,
      metadata: { childFirstName: link.child.firstName, document: documentLabel(body.type) },
    });

    const { missing } = await missingForChild(link.organizationId, link.childId);
    return NextResponse.json({ ok: true, missing }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
