import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { addDays } from "@/lib/lessonPlan";
import { ALL_CLASSES, DONE_VISIBLE_DAYS, taskCreateSchema } from "@/lib/teacherTasks";
import { notifyClassTeachers } from "@/lib/notifyTeachers";

type Params = { params: Promise<{ organizationId: string }> };

const taskSelect = {
  id: true,
  title: true,
  details: true,
  dueDate: true,
  createdAt: true,
  acknowledgedAt: true,
  completedAt: true,
  category: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
} as const;

function shape<T extends { dueDate: Date | null }>(t: T) {
  return { ...t, dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null };
}

// Tasks assigned to classes. A teacher sees their own class's: everything
// still open, plus anything finished in the last week. Anyone else with
// Centre access sees every class (or ?categoryId=).
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    const clock = schoolClock(org?.timezone ?? "Africa/Johannesburg");
    const recently = new Date(`${addDays(clock.date, -DONE_VISIBLE_DAYS)}T00:00:00.000Z`);
    const visible = { OR: [{ completedAt: null }, { completedAt: { gte: recently } }] };

    let categoryFilter: { categoryId?: string } = {};
    if (role === "TEACHER") {
      if (!assignedCategoryId) return NextResponse.json({ today: clock.date, tasks: [] });
      categoryFilter = { categoryId: assignedCategoryId };
    } else {
      const requested = req.nextUrl.searchParams.get("categoryId");
      if (requested) categoryFilter = { categoryId: requested };
    }

    const tasks = await db.teacherTask.findMany({
      where: { organizationId, ...categoryFilter, ...visible },
      orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 200,
      select: taskSelect,
    });
    return NextResponse.json({ today: clock.date, tasks: tasks.map(shape) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Admin assigns a task to a class -- or, with categoryId ALL_CLASSES, the
// same task to every active class at once (one copy per class).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const body = taskCreateSchema.parse(await req.json());
    const toAll = body.categoryId === ALL_CLASSES;
    const categories = await db.category.findMany({
      where: toAll
        ? { organizationId, deletedAt: null, archived: false }
        : { id: body.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (categories.length === 0) {
      return NextResponse.json({ error: toAll ? "There are no classes yet." : "Not found." }, { status: 404 });
    }

    const details = body.details?.trim() || null;
    const dueDate = body.dueDate ? schoolDateValue(body.dueDate) : null;
    const tasks = await db.$transaction(
      categories.map((category) =>
        db.teacherTask.create({
          data: {
            organizationId,
            categoryId: category.id,
            title: body.title,
            details,
            dueDate,
            createdByUserId: userId,
          },
          select: taskSelect,
        })
      )
    );

    for (const task of tasks) {
      await logAudit({
        organizationId,
        userId,
        action: "task.assigned",
        entityType: "TeacherTask",
        entityId: task.id,
        metadata: { className: task.category.name, title: body.title, allClasses: toAll },
      });

      // Tell the class's tablets straight away (Dylan, 8 Oct 2026). A normal
      // notification, not an alarm: it should not wake anyone up at night.
      await notifyClassTeachers(organizationId, task.category.id, {
        title: "New task for your class",
        body: body.dueDate ? `${body.title} — due ${body.dueDate}` : body.title,
        screen: "todos",
      }).catch(() => {});
    }

    const shaped = tasks.map(shape);
    return NextResponse.json({ task: shaped[0], tasks: shaped }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
