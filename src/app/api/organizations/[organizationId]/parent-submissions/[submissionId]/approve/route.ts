import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import {
  approveNewApplicantSchema,
  guardianSchema,
  newApplicantSchema,
  parentSubmissionChildSchema,
} from "@/lib/validation";
import { generateAnnualPlanForChild } from "@/lib/billing/financialPlan";
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

    if (submission.isNewApplicant || !submission.link) {
      if (role === "TEACHER") {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return approveNewApplicant(req, organizationId, userId, submission.id, submission.data);
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

// A NEW family from the school's permanent apply link (fix session B):
// approving creates the Child (in the class and from the start date staff
// choose), its first year's fees -- exactly like adding a child by hand --
// and a Guardian per submitted guardian. The first guardian becomes the
// billing contact (Child.parentName/Phone/Email).
async function approveNewApplicant(
  req: NextRequest,
  organizationId: string,
  userId: string,
  submissionId: string,
  rawData: string
) {
  const choice = approveNewApplicantSchema.parse(await req.json().catch(() => ({})));
  const category = await db.category.findFirst({
    where: { id: choice.categoryId, organizationId, deletedAt: null },
  });
  if (!category) {
    return NextResponse.json({ error: "Class not found." }, { status: 400 });
  }

  const parsed = newApplicantSchema.omit({ attachments: true }).parse(JSON.parse(rawData));
  const photoConsentGiven = parsed.child.photoConsentGiven === true;
  const primary = parsed.guardians[0];

  const child = await db.$transaction(async (tx) => {
    const created = await tx.child.create({
      data: {
        organizationId,
        categoryId: category.id,
        firstName: parsed.child.firstName,
        lastName: parsed.child.lastName,
        parentName: `${primary.firstName} ${primary.lastName}`.trim(),
        parentPhone: primary.phone ?? null,
        parentEmail: primary.email ?? null,
        enrollmentDate: choice.enrollmentDate,
        dateOfBirth: parsed.child.dateOfBirth,
        gender: parsed.child.gender,
        childIdNumber: parsed.child.childIdNumber ?? null,
        photoImage: photoConsentGiven ? parsed.child.photoImage ?? null : null,
        photoConsentGiven,
        photoConsentAt: photoConsentGiven ? new Date() : null,
      },
    });

    await generateAnnualPlanForChild(
      tx,
      organizationId,
      created,
      category,
      created.enrollmentDate.getUTCFullYear(),
      userId
    );

    for (const g of parsed.guardians) {
      await tx.guardian.create({
        data: {
          organizationId,
          childId: created.id,
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
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        createdChildId: created.id,
      },
    });

    return created;
  });

  await logAudit({
    organizationId,
    userId,
    action: "parentSubmission.newApplicantApproved",
    entityType: "ParentSubmission",
    entityId: submissionId,
    metadata: { childId: child.id, name: `${child.firstName} ${child.lastName}`, className: category.name },
  });

  return NextResponse.json({ ok: true, childId: child.id });
}
