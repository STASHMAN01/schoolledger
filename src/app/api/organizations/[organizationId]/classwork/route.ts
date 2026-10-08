import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { CLASSWORK_HISTORY_DAYS, addDays, classworkSchema } from "@/lib/lessonPlan";
import { notifyOrgAdmins } from "@/lib/notifyTeachers";

type Params = { params: Promise<{ organizationId: string }> };

const entrySelect = {
  id: true,
  date: true,
  description: true,
  createdAt: true,
  createdBy: { select: { name: true } },
  photos: {
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, caption: true, contentType: true },
  },
} as const;

async function schoolToday(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  return schoolClock(org?.timezone ?? "Africa/Johannesburg");
}

// Classwork (Dylan, 5 Oct 2026): what the class did today. A teacher sees
// their own class; anyone else with Centre access picks a class.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const scope = resolveAttendanceScope(role, assignedCategoryId, req.nextUrl.searchParams.get("categoryId"));
    if (scope.mode === "none") return NextResponse.json({ error: "No class assigned yet." }, { status: 400 });
    if (scope.mode === "all") return NextResponse.json({ error: "categoryId is required." }, { status: 400 });

    const category = await db.category.findFirst({
      where: { id: scope.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const clock = await schoolToday(organizationId);
    const entries = await db.classworkEntry.findMany({
      where: {
        organizationId,
        categoryId: category.id,
        date: { gte: schoolDateValue(addDays(clock.date, -CLASSWORK_HISTORY_DAYS)) },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: entrySelect,
    });

    return NextResponse.json({
      category,
      today: clock.date,
      entries: entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// A class teacher adds an entry for today. Add-only: there is no edit.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (role !== "TEACHER" || !assignedCategoryId) {
      return NextResponse.json({ error: "Only a class teacher records classwork." }, { status: 403 });
    }

    const body = classworkSchema.parse(await req.json());
    const clock = await schoolToday(organizationId);

    const entry = await db.classworkEntry.create({
      data: {
        organizationId,
        categoryId: assignedCategoryId,
        date: schoolDateValue(clock.date),
        description: body.description,
        createdByUserId: userId,
      },
      select: entrySelect,
    });

    await logAudit({
      organizationId,
      userId,
      action: "classwork.added",
      entityType: "ClassworkEntry",
      entityId: entry.id,
      metadata: { date: clock.date },
    });

    const category = await db.category.findUnique({
      where: { id: assignedCategoryId },
      select: { name: true },
    });
    await notifyOrgAdmins(organizationId, {
      title: "New activity logged",
      body: category ? `${category.name} recorded today's activity.` : "A class recorded today's activity.",
      screen: "classwork",
    }).catch(() => {});

    return NextResponse.json({ entry: { ...entry, date: clock.date } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
