import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { generateAnnualPlanForChild } from "@/lib/billing/financialPlan";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view

    const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
    const includeArchived = req.nextUrl.searchParams.get("archived") === "true";

    const children = await db.child.findMany({
      where: {
        organizationId,
        categoryId: categoryId || undefined,
        archived: includeArchived ? true : false,
      },
      include: { category: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({ children });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, [
      "ADMIN",
      "ACCOUNTANT",
      "MANAGER",
    ]);

    const body = childSchema.parse(await req.json());

    // The category MUST belong to this organization — same reasoning as
    // categories.parentId: never trust a foreign-key id from the client
    // without re-checking it's inside the caller's own tenant.
    const category = await db.category.findFirst({
      where: { id: body.categoryId, organizationId },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 400 }
      );
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
      },
      select: { id: true, firstName: true, lastName: true, categoryId: true },
    });

    // Creating the child and generating their first year's financial plan
    // (monthly fee rows + the mandatory Registration charge) happen in one
    // transaction: a child should never exist without a plan half-created,
    // and a failed plan generation (e.g. no recurring PaymentType exists)
    // should roll back the child creation too rather than leave an orphan.
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

    return NextResponse.json({ child, possibleSiblings }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
