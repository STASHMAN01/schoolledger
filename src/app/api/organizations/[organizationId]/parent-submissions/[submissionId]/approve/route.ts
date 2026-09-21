import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { parentSubmissionChildSchema, guardianSchema } from "@/lib/validation";
import { z } from "zod";

type Params = { params: Promise<{ organizationId: string; submissionId: string }> };

// Approving copies the submission's data onto the real Child record and
// creates a new Guardian row per submitted guardian -- deliberately
// always NEW rows rather than trying to guess-match against existing
// guardians (simplest, safest first pass; staff can remove a duplicate
// via the existing guardian "Remove" button on the profile page if the
// parent re-submitted someone already on file). Photos only get written
// through if the submission itself carried photo consent, same rule the
// live guardian-photo/child-photo endpoints already enforce.
export async function POST(_req: NextRequest, { params }: Params) {
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

    const child = submission.link.child;
    if (role === "TEACHER" && child.categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const parsed = z
      .object({ child: parentSubmissionChildSchema, guardians: z.array(guardianSchema) })
      .parse(JSON.parse(submission.data));

    const photoConsentGiven = parsed.child.photoConsentGiven === true;

    await db.$transaction(async (tx) => {
      await tx.child.update({
        where: { id: child.id },
        data: {
          dateOfBirth: parsed.child.dateOfBirth ?? undefined,
          gender: parsed.child.gender ?? undefined,
          childIdNumber: parsed.child.childIdNumber ?? undefined,
          photoImage: photoConsentGiven ? parsed.child.photoImage ?? undefined : undefined,
          photoConsentGiven: photoConsentGiven || undefined,
          photoConsentAt: photoConsentGiven ? new Date() : undefined,
        },
      });

      for (const g of parsed.guardians) {
        await tx.guardian.create({
          data: {
            organizationId,
            childId: child.id,
            relationship: g.relationship,
            firstName: g.firstName,
            lastName: g.lastName,
            idNumber: g.idNumber ?? null,
            occupation: g.occupation ?? null,
            phone: g.phone ?? null,
            email: g.email ?? null,
            photoImage: photoConsentGiven ? g.photoImage ?? null : null,
          },
        });
      }

      await tx.parentSubmission.update({
        where: { id: submission.id },
        data: { status: "APPROVED", reviewedByUserId: userId, reviewedAt: new Date() },
      });
    });

    await logAudit({
      organizationId,
      userId,
      action: "parentSubmission.approved",
      entityType: "ParentSubmission",
      entityId: submission.id,
      metadata: { childId: child.id, guardiansAdded: parsed.guardians.length },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
