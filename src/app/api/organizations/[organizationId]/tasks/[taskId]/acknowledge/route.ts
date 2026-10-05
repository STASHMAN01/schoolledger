import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; taskId: string }> };

// A class teacher (acknowledge) a task assigned to their own class. Once set it
// is never undone, and a repeat call changes nothing.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, taskId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (role !== "TEACHER" || !assignedCategoryId) {
      return NextResponse.json({ error: "Only a class teacher does this." }, { status: 403 });
    }

    const task = await db.teacherTask.findFirst({
      where: { id: taskId, organizationId, categoryId: assignedCategoryId },
      select: { id: true, title: true, acknowledgedAt: true, completedAt: true },
    });
    if (!task) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (task.acknowledgedAt) return NextResponse.json({ ok: true });

    await db.teacherTask.update({ where: { id: task.id }, data: { acknowledgedAt: new Date(), acknowledgedByUserId: userId } });
    await logAudit({
      organizationId,
      userId,
      action: "task.acknowledged",
      entityType: "TeacherTask",
      entityId: task.id,
      metadata: { title: task.title },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
