import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { categorySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view

    const categories = await db.category.findMany({
      where: { organizationId },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ categories });
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

    const body = categorySchema.parse(await req.json());

    if (body.parentId) {
      // The parent MUST belong to the same organization — otherwise a
      // crafted parentId could be used to probe/link into another
      // school's category tree.
      const parent = await db.category.findFirst({
        where: { id: body.parentId, organizationId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found." },
          { status: 400 }
        );
      }
    }

    const category = await db.category.create({
      data: {
        organizationId,
        name: body.name,
        parentId: body.parentId ?? null,
        monthlyFeeCents: body.monthlyFeeCents ?? null,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "category.created",
      entityType: "Category",
      entityId: category.id,
      metadata: { name: category.name },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
