import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { maskIdNumber } from "@/lib/idMask";

// Masks every "...idNumber" string anywhere in the submitted answers
// (child and each guardian), same default as the rest of the app. The
// ID-document photos stay visible -- checking them IS the review.
function maskIdsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskIdsDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        /idnumber$/i.test(k) && typeof v === "string" ? maskIdNumber(v) : maskIdsDeep(v),
      ])
    );
  }
  return value;
}

type Params = { params: Promise<{ organizationId: string; submissionId: string }> };

// Full review detail: the parent's submitted answers, the attachment
// photos (unmasked -- reviewing these IS the point of this page, same
// reasoning as the ID-number reveal endpoint, just folded into one view
// instead of a separate reveal click), and the child's *current* profile
// + guardians so staff can eyeball what would change on approval. Viewing
// an attachment here is audit-logged the same as any other ID reveal.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, submissionId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const submission = await db.parentSubmission.findFirst({
      where: { id: submissionId, organizationId },
      include: {
        link: {
          include: {
            child: { include: { guardians: true } },
          },
        },
        attachments: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const child = submission.link.child;
    if (role === "TEACHER" && child.categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // Every view is logged, not only while pending (final inspection R6).
    {
      await logAudit({
        organizationId,
        userId,
        action: "parentSubmission.viewed",
        entityType: "ParentSubmission",
        entityId: submission.id,
        metadata: { childId: child.id },
      });
    }

    return NextResponse.json({
      submission: {
        id: submission.id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        reviewNotes: submission.reviewNotes,
        data: maskIdsDeep(JSON.parse(submission.data)),
        attachments: submission.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          label: a.label,
          image: a.image,
        })),
      },
      current: {
        child: {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
          childIdNumber: maskIdNumber(child.childIdNumber),
        },
        guardians: child.guardians.map((g) => ({
          id: g.id,
          relationship: g.relationship,
          firstName: g.firstName,
          lastName: g.lastName,
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
