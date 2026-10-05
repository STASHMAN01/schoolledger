import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { DATE_RE, lessonPlanPutSchema, mondayOf, themeAppliesTo, weekDays } from "@/lib/lessonPlan";

type Params = { params: Promise<{ organizationId: string }> };

// Lesson plan (Dylan, 5 Oct 2026): what each class is learning each day.
// Read: anyone in Centre Management (a teacher sees their own class only).
// Write: MANAGE_CLASSES, one class's week at a time.

/** Themes that cover any of these days for this class, oldest first. */
async function themesFor(organizationId: string, categoryId: string, first: string, last: string) {
  const rows = await db.lessonTheme.findMany({
    where: {
      organizationId,
      startDate: { lte: schoolDateValue(last) },
      endDate: { gte: schoolDateValue(first) },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, description: true, startDate: true, endDate: true, categoryIds: true },
  });
  return rows
    .filter((t) => themeAppliesTo(t.categoryIds, categoryId))
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      startDate: t.startDate.toISOString().slice(0, 10),
      endDate: t.endDate.toISOString().slice(0, 10),
      allClasses: t.categoryIds.length === 0,
    }));
}

async function schoolToday(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  return schoolClock(org?.timezone ?? "Africa/Johannesburg");
}

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
    const requested = req.nextUrl.searchParams.get("weekStart");
    const weekStart = mondayOf(requested && DATE_RE.test(requested) ? requested : clock.date);
    const dates = weekDays(weekStart);

    const rows = await db.lessonPlan.findMany({
      where: { organizationId, categoryId: category.id, date: { in: dates.map(schoolDateValue) } },
      select: { date: true, topic: true, notes: true, guide: true, themeId: true, status: true, reviewNote: true },
    });
    const byDate = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));
    const themes = await themesFor(organizationId, category.id, dates[0], dates[dates.length - 1]);
    const themeOn = (date: string, explicit: string | null | undefined) =>
      themes.find((t) => t.id === explicit) ?? themes.find((t) => t.startDate <= date && t.endDate >= date) ?? null;

    return NextResponse.json({
      category,
      today: clock.date,
      weekStart,
      themes,
      days: dates.map((date) => ({
        date,
        topic: byDate.get(date)?.topic ?? "",
        notes: byDate.get(date)?.notes ?? "",
        status: byDate.get(date)?.status ?? "NONE",
        reviewNote: byDate.get(date)?.reviewNote ?? "",
        guide: byDate.get(date)?.guide ?? "",
        theme: (() => {
          const t = themeOn(date, byDate.get(date)?.themeId);
          return t ? { id: t.id, title: t.title } : null;
        })(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Saves one class's week. A day with an empty topic is cleared.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const body = lessonPlanPutSchema.parse(await req.json());
    const category = await db.category.findFirst({
      where: { id: body.categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    // Only Monday to Friday of the week that was asked for.
    const allowed = new Set(weekDays(mondayOf(body.weekStart)));
    if (body.days.some((d) => !allowed.has(d.date))) {
      return NextResponse.json({ error: "A day is outside that week." }, { status: 400 });
    }

    const weekDates = weekDays(mondayOf(body.weekStart));
    const themes = await themesFor(organizationId, category.id, weekDates[0], weekDates[4]);
    const themeIdOn = (date: string) => themes.find((t) => t.startDate <= date && t.endDate >= date)?.id ?? null;

    await db.$transaction(
      body.days.map((d) => {
        const date = schoolDateValue(d.date);
        if (!d.topic.trim()) {
          return db.lessonPlan.deleteMany({ where: { categoryId: category.id, date } });
        }
        return db.lessonPlan.upsert({
          where: { categoryId_date: { categoryId: category.id, date } },
          create: {
            organizationId,
            categoryId: category.id,
            date,
            topic: d.topic,
            notes: d.notes?.trim() || null,
            guide: d.guide?.trim() || null,
            themeId: themeIdOn(d.date),
            createdByUserId: userId,
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedByUserId: userId,
          },
          // An admin's own edit is final: it replaces a pending or returned proposal.
          update: {
            topic: d.topic,
            notes: d.notes?.trim() || null,
            guide: d.guide?.trim() || null,
            themeId: themeIdOn(d.date),
            status: "APPROVED",
            reviewNote: null,
            reviewedAt: new Date(),
            reviewedByUserId: userId,
          },
        });
      })
    );

    await logAudit({
      organizationId,
      userId,
      action: "lessonPlan.updated",
      entityType: "LessonPlan",
      entityId: category.id,
      metadata: { className: category.name, weekStart: mondayOf(body.weekStart) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
