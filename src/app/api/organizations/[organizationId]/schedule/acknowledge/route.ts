import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { hasUnseenScheduleChange } from "@/lib/scheduleNotice";

type Params = { params: Promise<{ organizationId: string }> };

// Called by the Timetable page when a TEACHER opens their own class's
// timetable. Only writes an audit row when there's actually an unseen
// change, so the activity feed doesn't fill up with page views.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (role !== "TEACHER" || !assignedCategoryId) {
      return NextResponse.json({ acknowledged: false });
    }

    if (!(await hasUnseenScheduleChange(organizationId, userId, assignedCategoryId))) {
      return NextResponse.json({ acknowledged: false });
    }

    const category = await db.category.findFirst({
      where: { id: assignedCategoryId, organizationId },
      select: { name: true },
    });
    await logAudit({
      organizationId,
      userId,
      action: "schedule.acknowledged",
      entityType: "Schedule",
      entityId: assignedCategoryId,
      metadata: { className: category?.name ?? null },
    });
    return NextResponse.json({ acknowledged: true });
  } catch (err) {
    return handleApiError(err);
  }
}
