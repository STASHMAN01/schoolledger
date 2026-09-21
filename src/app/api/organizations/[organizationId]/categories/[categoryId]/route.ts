import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { categorySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; categoryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, categoryId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_CLASSES");

    const existing = await db.category.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = categorySchema.partial().parse(await req.json());

    if (body.parentId) {
      if (body.parentId === categoryId) {
        return NextResponse.json(
          { error: "A category cannot be its own parent." },
          { status: 400 }
        );
      }
      const parent = await db.category.findFirst({
        where: { id: body.parentId, organizationId, deletedAt: null },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found." },
          { status: 400 }
        );
      }
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: {
        name: body.name ?? undefined,
        parentId: body.parentId === undefined ? undefined : body.parentId,
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

    const category = await db.category.update({
      where: { id: categoryId },
      data: { archived: true },
    });

    await logAudit({
      organizationId,
      userId,
      action: "category.archived",
      entityType: "Category",
      entityId: category.id,
    });

    return NextResponse.json({ category });
  } catch (err) {
    return handleApiError(err);
  }
}
