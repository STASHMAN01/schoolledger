import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { addDays } from "@/lib/lessonPlan";
import {
  ALL_CLASSES,
  TASK_LIST_CAP,
  TASK_SIBLING_CAP,
  bucketTasks,
  normaliseTaskDate,
  taskCreateSchema,
} from "@/lib/teacherTasks";
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
  batchId: true,
  category: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
} as const;

function shape<T extends { dueDate: Date | null }>(t: T) {
  return { ...t, dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null };
}

// Tasks assigned to classes, for one day (Dylan, 15 Oct 2026). A task's day
// is its due date. ?date= (default today, school time) picks the day; the
// response has the open tasks due that day (todo), the tasks ticked off on
// that school day whatever their due date (done), and -- on today only --
// everything overdue and everything with no date. `truncated` is true when a
// list hit its cap. A
// teacher sees their own class; anyone else with Centre access sees every
// class, or one with ?categoryId=. For the office's "All classes" view,
// batchSiblings holds every copy of any batch in the lists so progress counts
// are right.
//
// ?unseen=1 is for the teacher pop-up: the open tasks nobody has opened yet,
// whatever their day.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    const timeZone = org?.timezone ?? "Africa/Johannesburg";
    const clock = schoolClock(timeZone);
    const today = clock.date;
    const sp = req.nextUrl.searchParams;
    const date = normaliseTaskDate(sp.get("date"), today);
    const unseen = sp.get("unseen") === "1";

    const empty = { today, date, todo: [], overdue: [], noDate: [], done: [], batchSiblings: [], truncated: false, timeZone };
    let categoryFilter: { categoryId?: string } = {};
    let allClasses = false;
    if (role === "TEACHER") {
      if (!assignedCategoryId) return NextResponse.json(unseen ? { today, tasks: [] } : empty);
      categoryFilter = { categoryId: assignedCategoryId };
    } else {
      const requested = sp.get("categoryId");
      if (requested) categoryFilter = { categoryId: requested };
      else allClasses = true;
    }

    if (unseen) {
      const tasks = await db.teacherTask.findMany({
        where: { organizationId, ...categoryFilter, completedAt: null, acknowledgedAt: null },
        orderBy: { createdAt: "asc" },
        take: TASK_LIST_CAP,
        select: taskSelect,
      });
      return NextResponse.json({ today, tasks: tasks.map(shape) });
    }

    // completedAt falls on a school date, which depends on the timezone, so
    // fetch a day either side and let bucketTasks do the exact match.
    const dateStart = schoolDateValue(date);
    const completedNear = { gte: schoolDateValue(addDays(date, -1)), lt: schoolDateValue(addDays(date, 2)) };
    const wanted: Prisma.TeacherTaskWhereInput[] = [
      { completedAt: null, dueDate: dateStart },
      { completedAt: completedNear },
    ];
    if (date === today) {
      wanted.push({ completedAt: null, dueDate: { lt: dateStart } }, { completedAt: null, dueDate: null });
    }

    const found = await db.teacherTask.findMany({
      where: { organizationId, ...categoryFilter, OR: wanted },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: TASK_LIST_CAP + 1,
      select: taskSelect,
    });
    let truncated = found.length > TASK_LIST_CAP;
    const buckets = bucketTasks(found.slice(0, TASK_LIST_CAP).map(shape), date, today, timeZone);
    buckets.done.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

    let batchSiblings: ReturnType<typeof shape>[] = [];
    if (allClasses) {
      const batchIds = [
        ...new Set(
          [...buckets.todo, ...buckets.overdue, ...buckets.noDate, ...buckets.done]
            .map((t) => t.batchId)
            .filter((id): id is string => !!id)
        ),
      ];
      if (batchIds.length > 0) {
        const siblings = await db.teacherTask.findMany({
          where: { organizationId, batchId: { in: batchIds } },
          orderBy: { id: "asc" },
          take: TASK_SIBLING_CAP + 1,
          select: taskSelect,
        });
        if (siblings.length > TASK_SIBLING_CAP) truncated = true;
        batchSiblings = siblings.slice(0, TASK_SIBLING_CAP).map(shape);
      }
    }
    return NextResponse.json({ today, date, timeZone, ...buckets, batchSiblings, truncated });
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
        ? { organizationId, deletedAt: null, archived: false, parentId: null }
        : { id: body.categoryId, organizationId, deletedAt: null, parentId: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (categories.length === 0) {
      return NextResponse.json({ error: toAll ? "There are no classes yet." : "Not found." }, { status: 404 });
    }

    const details = body.details?.trim() || null;
    const dueDate = body.dueDate ? schoolDateValue(body.dueDate) : null;
    // Every copy from one "All classes" send shares a batchId so the Tasks
    // page can show them as one row. A single-class task has none.
    const batchId = toAll ? randomUUID() : null;
    const tasks = await db.$transaction(
      categories.map((category) =>
        db.teacherTask.create({
          data: {
            organizationId,
            categoryId: category.id,
            title: body.title,
            details,
            dueDate,
            batchId,
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
