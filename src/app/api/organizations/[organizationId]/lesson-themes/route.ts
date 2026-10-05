import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { addDays, lessonThemeSchema } from "@/lib/lessonPlan";

type Params = { params: Promise<{ organizationId: string }> };

// Lesson themes (Dylan, 5 Oct 2026): admin only. Teachers see the themes
// that cover their class through GET /lesson-plans.

/** Real classes in this school, for checking categoryIds. */
async function validClassIds(organizationId: string, ids: string[]) {
  if (ids.length === 0) return true;
  const found = await db.category.count({ where: { organizationId, id: { in: ids }, deletedAt: null } });
  return found === new Set(ids).size;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const m = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (m.role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    const today = schoolClock(org?.timezone ?? "Africa/Johannesburg").date;
    const themes = await db.lessonTheme.findMany({
      where: { organizationId, endDate: { gte: schoolDateValue(addDays(today, -31)) } },
      orderBy: { startDate: "asc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        categoryIds: true,
        _count: { select: { plans: true } },
      },
    });
    return NextResponse.json({
      today,
      themes: themes.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        startDate: t.startDate.toISOString().slice(0, 10),
        endDate: t.endDate.toISOString().slice(0, 10),
        categoryIds: t.categoryIds,
        days: t._count.plans,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const m = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (m.role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const parsed = lessonThemeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const body = parsed.data;
    if (!(await validClassIds(organizationId, body.categoryIds))) {
      return NextResponse.json({ error: "One of those classes doesn't exist." }, { status: 400 });
    }

    const theme = await db.lessonTheme.create({
      data: {
        organizationId,
        title: body.title,
        description: body.description?.trim() || null,
        startDate: schoolDateValue(body.startDate),
        endDate: schoolDateValue(body.endDate),
        categoryIds: [...new Set(body.categoryIds)],
        createdByUserId: m.userId,
      },
      select: { id: true },
    });
    // Days already planned inside the theme join it.
    await db.lessonPlan.updateMany({
      where: {
        organizationId,
        themeId: null,
        date: { gte: schoolDateValue(body.startDate), lte: schoolDateValue(body.endDate) },
        ...(body.categoryIds.length ? { categoryId: { in: body.categoryIds } } : {}),
      },
      data: { themeId: theme.id },
    });

    await logAudit({
      organizationId,
      userId: m.userId,
      action: "lessonTheme.created",
      entityType: "Category",
      entityId: theme.id,
      metadata: { title: body.title, startDate: body.startDate, endDate: body.endDate },
    });
    return NextResponse.json({ id: theme.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

