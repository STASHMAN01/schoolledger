import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolDateValue } from "@/lib/dailySummary";
import { MAX_IMPORT_ROWS, planImport } from "@/lib/lessonImport";

type Params = { params: Promise<{ organizationId: string }> };

const bodySchema = z.object({
  table: z.array(z.array(z.string().max(6_000)).max(20)).max(MAX_IMPORT_ROWS + 1),
  dryRun: z.boolean().default(true),
});

// Import themes, daily topics and teaching guides from a spreadsheet
// (Dylan, 5 Oct 2026). dryRun (the default) only reports what would happen.
// Days that already have a plan for that class are replaced.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CLASSES");
    if (role === "TEACHER") return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That file is too big or not a table." }, { status: 400 });

    const classes = await db.category.findMany({
      where: { organizationId, deletedAt: null, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const plan = planImport(parsed.data.table, classes);
    const nameOf = new Map(classes.map((c) => [c.id, c.name]));

    const existing = plan.days.length
      ? await db.lessonPlan.findMany({
          where: {
            organizationId,
            OR: plan.days.map((d) => ({ categoryId: d.categoryId, date: schoolDateValue(d.date) })),
          },
          select: { id: true },
        })
      : [];

    const preview = {
      themes: plan.themes.map((t) => ({
        title: t.title,
        startDate: t.startDate,
        endDate: t.endDate,
        classes: t.categoryIds.length ? t.categoryIds.map((id) => nameOf.get(id) ?? "?") : ["All classes"],
        days: plan.days.filter((d) => d.themeKey === t.key).length,
        withGuide: plan.days.filter((d) => d.themeKey === t.key && d.guide).length,
      })),
      days: plan.days.length,
      replacing: existing.length,
      errors: plan.errors.slice(0, 50),
      errorCount: plan.errors.length,
    };

    if (parsed.data.dryRun) return NextResponse.json({ preview });
    if (plan.themes.length === 0) {
      return NextResponse.json({ error: "Nothing to import.", preview }, { status: 400 });
    }

    // Themes: reuse one with the same name and dates, widening its classes.
    const themeIdByKey = new Map<string, string>();
    for (const t of plan.themes) {
      const found = await db.lessonTheme.findFirst({
        where: {
          organizationId,
          title: { equals: t.title, mode: "insensitive" },
          startDate: schoolDateValue(t.startDate),
          endDate: schoolDateValue(t.endDate),
        },
        select: { id: true, categoryIds: true },
      });
      if (found) {
        const all = found.categoryIds.length === 0 || t.categoryIds.length === 0;
        await db.lessonTheme.update({
          where: { id: found.id },
          data: { categoryIds: all ? [] : [...new Set([...found.categoryIds, ...t.categoryIds])] },
        });
        themeIdByKey.set(t.key, found.id);
      } else {
        const created = await db.lessonTheme.create({
          data: {
            organizationId,
            title: t.title,
            startDate: schoolDateValue(t.startDate),
            endDate: schoolDateValue(t.endDate),
            categoryIds: t.categoryIds,
            createdByUserId: userId,
          },
          select: { id: true },
        });
        themeIdByKey.set(t.key, created.id);
      }
    }

    // Days, in batches so one big month doesn't hold one huge transaction.
    const now = new Date();
    for (let i = 0; i < plan.days.length; i += 100) {
      await db.$transaction(
        plan.days.slice(i, i + 100).map((d) => {
          const date = schoolDateValue(d.date);
          const data = {
            topic: d.topic,
            guide: d.guide,
            themeId: themeIdByKey.get(d.themeKey) ?? null,
            status: "APPROVED",
            reviewNote: null,
            reviewedAt: now,
            reviewedByUserId: userId,
          };
          return db.lessonPlan.upsert({
            where: { categoryId_date: { categoryId: d.categoryId, date } },
            create: { organizationId, categoryId: d.categoryId, date, createdByUserId: userId, ...data },
            update: data,
          });
        })
      );
    }

    await logAudit({
      organizationId,
      userId,
      action: "lessonPlan.imported",
      entityType: "Category",
      metadata: { themes: plan.themes.length, days: plan.days.length },
    });
    return NextResponse.json({ ok: true, preview });
  } catch (err) {
    return handleApiError(err);
  }
}
