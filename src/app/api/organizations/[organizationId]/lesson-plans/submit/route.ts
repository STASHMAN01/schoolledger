import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolDateValue } from "@/lib/dailySummary";
import { lessonPlanSubmitSchema, mondayOf, weekDays } from "@/lib/lessonPlan";

type Params = { params: Promise<{ organizationId: string }> };

// A class teacher proposes lesson topics for their own class (Dylan,
// 5 Oct 2026). Days that already have an approved plan are left alone; the
// rest are saved as PENDING for the admin to review. An empty topic
// withdraws that day's proposal.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (role !== "TEACHER" || !assignedCategoryId) {
      return NextResponse.json({ error: "Only a class teacher submits a lesson plan." }, { status: 403 });
    }

    const body = lessonPlanSubmitSchema.parse(await req.json());
    const allowed = new Set(weekDays(mondayOf(body.weekStart)));
    if (body.days.some((d) => !allowed.has(d.date))) {
      return NextResponse.json({ error: "A day is outside that week." }, { status: 400 });
    }

    const existing = await db.lessonPlan.findMany({
      where: {
        categoryId: assignedCategoryId,
        date: { in: body.days.map((d) => schoolDateValue(d.date)) },
      },
      select: { date: true, status: true },
    });
    const approved = new Set(existing.filter((e) => e.status === "APPROVED").map((e) => e.date.toISOString().slice(0, 10)));
    const mine = body.days.filter((d) => !approved.has(d.date));

    let submitted = 0;
    await db.$transaction(
      mine.map((d) => {
        const date = schoolDateValue(d.date);
        if (!d.topic.trim()) {
          return db.lessonPlan.deleteMany({ where: { categoryId: assignedCategoryId, date, status: { not: "APPROVED" } } });
        }
        submitted += 1;
        return db.lessonPlan.upsert({
          where: { categoryId_date: { categoryId: assignedCategoryId, date } },
          create: {
            organizationId,
            categoryId: assignedCategoryId,
            date,
            topic: d.topic,
            notes: d.notes?.trim() || null,
            createdByUserId: userId,
            status: "PENDING",
          },
          update: { topic: d.topic, notes: d.notes?.trim() || null, status: "PENDING", reviewNote: null, createdByUserId: userId },
        });
      })
    );

    await logAudit({
      organizationId,
      userId,
      action: "lessonPlan.submitted",
      entityType: "LessonPlan",
      entityId: assignedCategoryId,
      metadata: { weekStart: mondayOf(body.weekStart), days: submitted },
    });

    return NextResponse.json({ ok: true, submitted, skipped: body.days.length - mine.length });
  } catch (err) {
    return handleApiError(err);
  }
}
