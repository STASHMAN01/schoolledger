import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolDateValue } from "@/lib/dailySummary";
import { lessonThemeSchema } from "@/lib/lessonPlan";

type Params = { params: Promise<{ organizationId: string; themeId: string }> };

async function load(organizationId: string, themeId: string) {
  return db.lessonTheme.findFirst({ where: { id: themeId, organizationId }, select: { id: true, title: true } });
}

// Change a theme's name, dates or classes. The daily topics and guides stay.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, themeId } = await params;
    const m = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (m.role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const theme = await load(organizationId, themeId);
    if (!theme) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const parsed = lessonThemeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const body = parsed.data;
    const ids = [...new Set(body.categoryIds)];
    if (ids.length) {
      const found = await db.category.count({ where: { organizationId, id: { in: ids }, deletedAt: null } });
      if (found !== ids.length) return NextResponse.json({ error: "One of those classes doesn't exist." }, { status: 400 });
    }

    await db.lessonTheme.update({
      where: { id: theme.id },
      data: {
        title: body.title,
        description: body.description?.trim() || null,
        startDate: schoolDateValue(body.startDate),
        endDate: schoolDateValue(body.endDate),
        categoryIds: ids,
      },
    });
    await logAudit({
      organizationId,
      userId: m.userId,
      action: "lessonTheme.updated",
      entityType: "Category",
      entityId: theme.id,
      metadata: { title: body.title },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Remove a theme. With ?days=1 the daily topics and guides it holds go too;
// otherwise they stay as plain daily plans.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, themeId } = await params;
    const m = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (m.role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const theme = await load(organizationId, themeId);
    if (!theme) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const withDays = req.nextUrl.searchParams.get("days") === "1";
    await db.$transaction([
      ...(withDays ? [db.lessonPlan.deleteMany({ where: { organizationId, themeId: theme.id } })] : []),
      db.lessonTheme.delete({ where: { id: theme.id } }),
    ]);
    await logAudit({
      organizationId,
      userId: m.userId,
      action: "lessonTheme.deleted",
      entityType: "Category",
      entityId: theme.id,
      metadata: { title: theme.title, withDays },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
