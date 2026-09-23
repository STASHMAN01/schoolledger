import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { serializeChild } from "@/lib/childView";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const existing = await db.child.findFirst({
      where: { id: childId, organizationId },
    });
    // A TEACHER can only restore children in their own class.
    if (!existing || (role === "TEACHER" && existing.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const child = await db.child.update({
      where: { id: childId },
      data: { archived: false },
    });

    await logAudit({
      organizationId,
      userId,
      action: "child.restored",
      entityType: "Child",
      entityId: child.id,
    });

    return NextResponse.json({ child: serializeChild(child, permissions.includes("VIEW_MONEY")) });
  } catch (err) {
    return handleApiError(err);
  }
}
