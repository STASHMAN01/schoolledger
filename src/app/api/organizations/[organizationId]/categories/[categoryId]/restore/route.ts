import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; categoryId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, categoryId } = await params;
    const { userId } = await requireMembership(organizationId, [
      "ADMIN",
      "ACCOUNTANT",
      "MANAGER",
    ]);

    const existing = await db.category.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: { archived: false },
    });

    await logAudit({
      organizationId,
      userId,
      action: "category.restored",
      entityType: "Category",
      entityId: category.id,
    });

    return NextResponse.json({ category });
  } catch (err) {
    return handleApiError(err);
  }
}
