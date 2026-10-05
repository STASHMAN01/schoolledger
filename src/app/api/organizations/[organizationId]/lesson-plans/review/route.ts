import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { lessonPlanReviewSchema } from "@/lib/lessonPlan";

type Params = { params: Promise<{ organizationId: string }> };

// Admin approves, or sends back with a note, every pending day a class's
// teacher has proposed.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const body = lessonPlanReviewSchema.parse(await req.json());
    const category = await db.category.findFirst({
      where: { id: body.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const result = await db.lessonPlan.updateMany({
      where: { organizationId, categoryId: category.id, status: "PENDING" },
      data:
        body.action === "approve"
          ? { status: "APPROVED", reviewNote: null, reviewedAt: new Date(), reviewedByUserId: userId }
          : { status: "RETURNED", reviewNote: body.note?.trim() || null, reviewedAt: new Date(), reviewedByUserId: userId },
    });

    await logAudit({
      organizationId,
      userId,
      action: body.action === "approve" ? "lessonPlan.approved" : "lessonPlan.returned",
      entityType: "LessonPlan",
      entityId: category.id,
      metadata: { className: category.name, days: result.count },
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (err) {
    return handleApiError(err);
  }
}
