import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership, TenantAccessError } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { MAX_SCHEDULE_ITEMS, scheduleItemProblem, sortScheduleItems } from "@/lib/schedule";

type Params = { params: Promise<{ organizationId: string }> };

// Phase 5 weekly class timetable. Read: anyone in Centre Management
// (TEACHER: own class only, same scoping helper as attendance). Write:
// MANAGE_CLASSES, replacing the whole week for one class in one save.

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const scope = resolveAttendanceScope(role, assignedCategoryId, req.nextUrl.searchParams.get("categoryId"));
    if (scope.mode === "none") {
      return NextResponse.json({ error: "No class assigned yet." }, { status: 400 });
    }
    if (scope.mode === "all") {
      return NextResponse.json({ error: "categoryId is required." }, { status: 400 });
    }

    const category = await db.category.findFirst({
      where: { id: scope.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const items = await db.classScheduleItem.findMany({
      where: { organizationId, categoryId: category.id },
      select: { id: true, dayOfWeek: true, startTime: true, endTime: true, activity: true, notes: true, updatedAt: true },
    });

    return NextResponse.json({ category, items: sortScheduleItems(items) });
  } catch (err) {
    return handleApiError(err);
  }
}

const itemSchema = z.object({
  dayOfWeek: z.number().int(),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  activity: z.string(),
  notes: z.string().nullable().optional(),
});

const putSchema = z.object({
  categoryId: z.string().min(1),
  items: z.array(itemSchema).max(MAX_SCHEDULE_ITEMS),
});

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_CLASSES");
    const body = putSchema.parse(await req.json());

    // If a TEACHER was ever granted MANAGE_CLASSES as an override, they
    // still only get their own class.
    if (role === "TEACHER" && body.categoryId !== assignedCategoryId) {
      throw new TenantAccessError("Not allowed for your role.", 403);
    }

    const category = await db.category.findFirst({
      where: { id: body.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const cleaned = body.items.map((i) => ({
      dayOfWeek: i.dayOfWeek,
      startTime: i.startTime.trim(),
      endTime: i.endTime?.trim() || null,
      activity: i.activity.trim(),
      notes: i.notes?.trim() || null,
    }));
    for (const item of cleaned) {
      const problem = scheduleItemProblem(item);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }

    await db.$transaction([
      db.classScheduleItem.deleteMany({ where: { organizationId, categoryId: category.id } }),
      db.classScheduleItem.createMany({
        data: cleaned.map((i) => ({ ...i, organizationId, categoryId: category.id })),
      }),
    ]);

    await logAudit({
      organizationId,
      userId,
      action: "schedule.updated",
      entityType: "Schedule",
      entityId: category.id,
      metadata: { className: category.name, itemCount: cleaned.length },
    });

    const items = await db.classScheduleItem.findMany({
      where: { organizationId, categoryId: category.id },
      select: { id: true, dayOfWeek: true, startTime: true, endTime: true, activity: true, notes: true, updatedAt: true },
    });
    return NextResponse.json({ category, items: sortScheduleItems(items) });
  } catch (err) {
    return handleApiError(err);
  }
}
