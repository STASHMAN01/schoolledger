import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import {
  DUE_HOUR,
  dailySummarySchema,
  decideDailySummary,
  isSummaryDue,
  schoolClock,
  schoolDateRange,
  schoolDateValue,
} from "@/lib/dailySummary";

type Params = { params: Promise<{ organizationId: string }> };

const summarySelect = {
  id: true,
  categoryId: true,
  date: true,
  anyoneHurt: true,
  incidentReported: true,
  noReportReason: true,
  submittedAt: true,
  submittedBy: { select: { name: true } },
} as const;

async function clockFor(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
  return schoolClock(org?.timezone ?? "Africa/Johannesburg");
}

async function incidentsOn(organizationId: string, categoryId: string, date: string) {
  return db.childReport.count({
    where: { organizationId, categoryId, type: "INCIDENT", occurredAt: schoolDateRange(date) },
  });
}

// Teacher: today's status for their own class (is it due, already sent,
// how many incident reports today). Anyone else with Centre access: every
// class that has a teacher, for a date (?date=YYYY-MM-DD, default today),
// with who has and hasn't submitted.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    const clock = await clockFor(organizationId);

    if (role === "TEACHER") {
      if (!assignedCategoryId) {
        return NextResponse.json({ date: clock.date, isDue: false, noClass: true });
      }
      const [category, summary, incidentsToday] = await Promise.all([
        db.category.findFirst({ where: { id: assignedCategoryId, organizationId }, select: { name: true } }),
        db.dailySummary.findUnique({
          where: { categoryId_date: { categoryId: assignedCategoryId, date: schoolDateValue(clock.date) } },
          select: summarySelect,
        }),
        incidentsOn(organizationId, assignedCategoryId, clock.date),
      ]);
      return NextResponse.json({
        date: clock.date,
        dueFrom: `${DUE_HOUR}:00`,
        isDue: isSummaryDue(clock),
        className: category?.name ?? null,
        summary,
        incidentsToday,
      });
    }

    const requested = req.nextUrl.searchParams.get("date");
    const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : clock.date;
    const teachers = await db.membership.findMany({
      where: { organizationId, role: "TEACHER", assignedCategoryId: { not: null } },
      select: {
        assignedCategoryId: true,
        user: { select: { name: true } },
        assignedCategory: { select: { id: true, name: true, deletedAt: true, archived: true } },
      },
    });
    const classes = new Map<string, { id: string; name: string; teachers: string[] }>();
    for (const t of teachers) {
      const c = t.assignedCategory;
      if (!c || c.deletedAt || c.archived) continue;
      const entry = classes.get(c.id) ?? { id: c.id, name: c.name, teachers: [] };
      entry.teachers.push(t.user.name);
      classes.set(c.id, entry);
    }
    const ids = [...classes.keys()];
    const [summaries, incidents] = await Promise.all([
      db.dailySummary.findMany({
        where: { organizationId, categoryId: { in: ids }, date: schoolDateValue(date) },
        select: summarySelect,
      }),
      db.childReport.groupBy({
        by: ["categoryId"],
        where: { organizationId, categoryId: { in: ids }, type: "INCIDENT", occurredAt: schoolDateRange(date) },
        _count: { _all: true },
      }),
    ]);
    const summaryBy = new Map(summaries.map((s) => [s.categoryId, s]));
    const incidentsBy = new Map(incidents.map((i) => [i.categoryId, i._count._all]));

    return NextResponse.json({
      date,
      today: clock.date,
      isDue: date === clock.date ? isSummaryDue(clock) : true,
      classes: [...classes.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ ...c, summary: summaryBy.get(c.id) ?? null, incidents: incidentsBy.get(c.id) ?? 0 })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// A class teacher sends today's summary. Once per class per day, never
// changed afterwards.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");
    if (role !== "TEACHER" || !assignedCategoryId) {
      return NextResponse.json(
        { error: "Only a class teacher sends the daily summary." },
        { status: 403 }
      );
    }

    const parsed = dailySummarySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const clock = await clockFor(organizationId);
    const incidentsToday = await incidentsOn(organizationId, assignedCategoryId, clock.date);
    const decision = decideDailySummary(parsed.data, incidentsToday);
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: 400 });
    }

    let summary;
    try {
      summary = await db.dailySummary.create({
        data: {
          organizationId,
          categoryId: assignedCategoryId,
          date: schoolDateValue(clock.date),
          anyoneHurt: decision.anyoneHurt,
          incidentReported: decision.incidentReported,
          noReportReason: decision.noReportReason,
          submittedByUserId: userId,
        },
        select: summarySelect,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json(
          { error: "Today's summary for your class has already been sent." },
          { status: 409 }
        );
      }
      throw err;
    }

    await logAudit({
      organizationId,
      userId,
      action: "dailySummary.submitted",
      entityType: "DailySummary",
      entityId: summary.id,
      metadata: {
        date: clock.date,
        anyoneHurt: decision.anyoneHurt,
        incidentReported: decision.incidentReported,
      },
    });

    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
