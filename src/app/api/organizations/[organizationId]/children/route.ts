import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateAnnualPlanForChild } from "@/lib/billing/financialPlan";
import { serializeChild, serializeChildForTeacher } from "@/lib/childView";
import { emergencyContactProblem, storedEmergencyPhone } from "@/lib/emergencyContact";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(organizationId); // any member may view
    const canViewMoney = permissions.includes("VIEW_MONEY");

    let categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
    const includeArchived = req.nextUrl.searchParams.get("archived") === "true";

    // TEACHER is scoped to their one assigned class ("own class only" per
    // the plan) — this overrides whatever categoryId the client asked
    // for, it never widens it.
    if (role === "TEACHER") {
      if (!assignedCategoryId) {
        return NextResponse.json({ children: [] });
      }
      categoryId = assignedCategoryId;
    }

    // deletedAt (trashed, pending purge) is always excluded regardless of
    // the archived filter — same reasoning as categories.
    const children = await db.child.findMany({
      where: {
        organizationId,
        categoryId: categoryId || undefined,
        archived: includeArchived ? true : false,
        deletedAt: null,
      },
      // Guardian phones feed the "incomplete profile" badge (lib/childProfile.ts).
      include: { category: true, guardians: { select: { phone: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (role === "TEACHER") {
      return NextResponse.json({ children: children.map((c) => serializeChildForTeacher(c)) });
    }

    const pendingRequests = await db.deletionRequest.findMany({
      where: {
        organizationId,
        targetType: "CHILD",
        status: "PENDING",
        targetId: { in: children.map((c) => c.id) },
      },
      include: { approvals: true },
    });
    const requestByChildId = new Map(pendingRequests.map((r) => [r.targetId, r]));

    return NextResponse.json({
      children: children.map((c) => {
        const request = requestByChildId.get(c.id);
        return {
          ...serializeChild(c, canViewMoney),
          deletionRequest: request
            ? {
                id: request.id,
                approvalsCount: request.approvals.length,
                approvedByMe: request.approvals.some((a) => a.userId === userId),
                requestedByMe: request.requestedByUserId === userId,
                reason: request.reason,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );
    const canViewMoney = permissions.includes("VIEW_MONEY");

    const body = childCreateSchema.parse(await req.json());

    // A fee override is money -- only VIEW_MONEY may set one.
    if (body.feeOverrideCents != null && !canViewMoney) {
      return NextResponse.json(
        { error: "You don't have permission to set a fee." },
        { status: 403 }
      );
    }

    // TEACHER can only add children to their own assigned class.
    if (role === "TEACHER" && body.categoryId !== assignedCategoryId) {
      return NextResponse.json(
        { error: "You can only add children to your own class." },
        { status: 403 }
      );
    }

    // The category MUST belong to this organization — same reasoning as
    // categories.parentId: never trust a foreign-key id from the client
    // without re-checking it's inside the caller's own tenant.
    const category = await db.category.findFirst({
      where: { id: body.categoryId, organizationId, deletedAt: null },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Class not found." },
        { status: 400 }
      );
    }

    // Parent 1 is required by the form; parent 2 is optional. `guardian`
    // is the older single-parent shape.
    const guardians = body.guardians ?? (body.guardian ? [body.guardian] : []);

    const ecProblem = emergencyContactProblem(
      {
        name: body.emergencyContactName,
        relationship: body.emergencyContactRelationship,
        phone: body.emergencyContactPhone,
      },
      [{ name: body.parentName, phone: body.parentPhone }, ...guardians]
    );
    if (ecProblem) {
      return NextResponse.json({ error: ecProblem }, { status: 400 });
    }

    if (body.exitDate && body.exitDate < body.enrollmentDate) {
      return NextResponse.json(
        { error: "Exit date cannot be before the enrollment date." },
        { status: 400 }
      );
    }

    // Detect a likely shared family (same last name, active, different
    // child) so the UI can offer to link them for a joint statement later
    // — this endpoint only surfaces the candidate, it never merges anything
    // automatically.
    const possibleSiblings = await db.child.findMany({
      where: {
        organizationId,
        lastName: { equals: body.lastName, mode: "insensitive" },
        archived: false,
        deletedAt: null,
        // A TEACHER only ever sees their own class.
        ...(role === "TEACHER" ? { categoryId: assignedCategoryId ?? undefined } : {}),
      },
      select: { id: true, firstName: true, lastName: true, categoryId: true },
    });

    // Creating the child and generating their first year's financial plan
    // (monthly fee rows + the mandatory Registration charge) happen in one
    // transaction: a child should never exist without a plan half-created,
    // and a failed plan generation (e.g. no recurring PaymentType exists)
    // should roll back the child creation too rather than leave an orphan.
    // In the order sent, so the form can attach each parent's ID document.
    const guardianIds: string[] = [];
    const child = await db.$transaction(async (tx) => {
      const created = await tx.child.create({
        data: {
          organizationId,
          categoryId: body.categoryId,
          firstName: body.firstName,
          lastName: body.lastName,
          parentName: body.parentName,
          parentPhone: body.parentPhone ?? null,
          parentEmail: body.parentEmail ?? null,
          enrollmentDate: body.enrollmentDate,
          exitDate: body.exitDate ?? null,
          feeOverrideCents: body.feeOverrideCents ?? null,
          dateOfBirth: body.dateOfBirth ?? null,
          gender: body.gender ?? null,
          childIdNumber: body.childIdNumber ?? null,
          parentIdNumber: body.parentIdNumber ?? null,
          allergies: body.allergies ?? null,
          homeAddress: body.homeAddress ?? null,
          emergencyContactName: body.emergencyContactName ?? null,
          emergencyContactRelationship: body.emergencyContactRelationship ?? null,
          emergencyContactPhone: storedEmergencyPhone(body.emergencyContactPhone),
        },
      });

      // Centre "Add child" sends parent 1 (and optionally parent 2).
      for (const g of guardians) {
        const createdGuardian = await tx.guardian.create({
          data: {
            organizationId,
            childId: created.id,
            relationship: g.relationship,
            firstName: g.firstName,
            lastName: g.lastName,
            idNumber: g.idNumber ?? null,
            occupation: g.occupation ?? null,
            phone: g.phone ?? null,
            extraPhones: g.extraPhones ?? [],
            email: g.email ?? null,
            address: g.address ?? null,
          },
        });
        guardianIds.push(createdGuardian.id);
      }

      await generateAnnualPlanForChild(
        tx,
        organizationId,
        created,
        category,
        created.enrollmentDate.getUTCFullYear(),
        userId
      );

      return created;
    });

    await logAudit({
      organizationId,
      userId,
      action: "child.created",
      entityType: "Child",
      entityId: child.id,
      metadata: { name: `${child.firstName} ${child.lastName}` },
    });

    return NextResponse.json(
      { child: serializeChild(child, canViewMoney), possibleSiblings, guardianIds },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
