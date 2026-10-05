import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string; taskId: string }> };

// Admin takes back a task that was assigned by mistake.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, taskId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const task = await db.teacherTask.findFirst({
      where: { id: taskId, organizationId },
      select: { id: true, title: true, category: { select: { name: true } } },
    });
    if (!task) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await db.teacherTask.delete({ where: { id: task.id } });
    await logAudit({
      organizationId,
      userId,
      action: "task.deleted",
      entityType: "TeacherTask",
      entityId: task.id,
      metadata: { className: task.category.name, title: task.title },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
