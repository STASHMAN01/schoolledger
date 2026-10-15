import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { ageRangeProblem, categorySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { gradeInUseProblem, gradeNameProblem } from "@/lib/classGroups";

type Params = { params: Promise<{ organizationId: string; categoryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, categoryId } = await params;
    const { userId, permissions } = await requireMembership(organizationId, "MANAGE_CLASSES");

    const existing = await db.category.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // categorySchema has no parentId, so a PATCH can never move a class or
    // turn a grade into a class (or the reverse).
    const body = categorySchema.partial().parse(await req.json());

    // A grade can only be renamed (archive/restore have their own routes).
    if (existing.parentId) {
      if (
        body.monthlyFeeCents !== undefined ||
        body.ageMinMonths !== undefined ||
        body.ageMaxMonths !== undefined
      ) {
        return NextResponse.json({ error: "A grade has no fee or age range." }, { status: 400 });
      }
      if (body.name !== undefined) {
        const siblings = await db.category.findMany({
          where: { organizationId, parentId: existing.parentId, deletedAt: null, id: { not: existing.id } },
          select: { name: true },
        });
        const nameProblem = gradeNameProblem(body.name, siblings.map((g) => g.name));
        if (nameProblem) return NextResponse.json({ error: nameProblem }, { status: 400 });
      }
      const grade = await db.category.update({
        where: { id: categoryId },
        data: { name: body.name ?? undefined },
      });
      await logAudit({
        organizationId,
        userId,
        action: "grade.updated",
        entityType: "Category",
        entityId: grade.id,
        metadata: { name: grade.name },
      });
      return NextResponse.json({ category: grade });
    }

    const ageProblem = ageRangeProblem(
      body.ageMinMonths === undefined ? existing.ageMinMonths : body.ageMinMonths,
      body.ageMaxMonths === undefined ? existing.ageMaxMonths : body.ageMaxMonths
    );
    if (ageProblem) return NextResponse.json({ error: ageProblem }, { status: 400 });

    if (body.monthlyFeeCents !== undefined && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "You don't have permission to change a fee." }, { status: 403 });
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: {
        name: body.name ?? undefined,
        ageMinMonths: body.ageMinMonths === undefined ? undefined : body.ageMinMonths,
        ageMaxMonths: body.ageMaxMonths === undefined ? undefined : body.ageMaxMonths,
        monthlyFeeCents:
          body.monthlyFeeCents === undefined ? undefined : body.monthlyFeeCents,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "category.updated",
      entityType: "Category",
      entityId: category.id,
    });

    return NextResponse.json({ category });
  } catch (err) {
    return handleApiError(err);
  }
}

// Archive, never hard-delete — per the original product spec, an
// accidentally archived category must be recoverable, and hard-deleting a
// category with historical children/payments attached would corrupt
// financial history.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, categoryId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_CLASSES");

    const existing = await db.category.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // A grade children are still labelled with can't be archived: they'd be
    // left pointing at a hidden grade. Say how many so the owner can move them.
    if (existing.parentId) {
      const inUse = await db.child.count({
        where: { subCategoryId: existing.id, archived: false, deletedAt: null, exitDate: null },
      });
      const problem = gradeInUseProblem(existing.name, inUse);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: { archived: true },
    });

    await logAudit({
      organizationId,
      userId,
      action: existing.parentId ? "grade.archived" : "category.archived",
      entityType: "Category",
      entityId: category.id,
    });

    return NextResponse.json({ category });
  } catch (err) {
    return handleApiError(err);
  }
}
