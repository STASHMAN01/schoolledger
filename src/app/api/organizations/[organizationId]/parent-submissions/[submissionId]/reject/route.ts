import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

type Params = { params: Promise<{ organizationId: string; submissionId: string }> };

const rejectSchema = z.object({
  reviewNotes: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(500).optional()),
});

// Discards the submission -- nothing it contained is ever written to the
// real Child/Guardian records. The parent gets no automatic notification
// (nothing in this app emails a parent proactively yet); staff follow up
// however they normally would.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, submissionId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const submission = await db.parentSubmission.findFirst({
      where: { id: submissionId, organizationId },
      include: { link: { include: { child: true } } },
    });

    if (!submission) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (submission.status !== "PENDING") {
      return NextResponse.json({ error: "This submission was already reviewed." }, { status: 400 });
    }

    // A new family (no link/child yet) is outside any class, so a TEACHER
    // never reviews those.
    const child = submission.link?.child ?? null;
    if (role === "TEACHER" && (!child || child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = rejectSchema.parse(await req.json().catch(() => ({})));

    await db.parentSubmission.update({
      where: { id: submission.id },
      data: {
        status: "REJECTED",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNotes: body.reviewNotes ?? null,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "parentSubmission.rejected",
      entityType: "ParentSubmission",
      entityId: submission.id,
      metadata: { childId: child?.id ?? null, reviewNotes: body.reviewNotes ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
