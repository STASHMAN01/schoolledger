import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { blankToNull, reportCreateSchema, resolveReportScope } from "@/lib/reports";

type Params = { params: Promise<{ organizationId: string }> };

const listSelect = {
  id: true,
  type: true,
  occurredAt: true,
  summary: true,
  parentNotified: true,
  createdAt: true,
  child: { select: { id: true, firstName: true, lastName: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

// Centre Management > Reports list. Filters: categoryId (ignored/overridden
// for a TEACHER, same rule as attendance), type, childId. A TEACHER with no
// assigned class yet sees an empty list rather than an error, same as the
// attendance register.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);

    const requestedCategoryId = req.nextUrl.searchParams.get("categoryId");
    const scope = resolveReportScope(role, assignedCategoryId, requestedCategoryId);
    if (scope.mode === "none") {
      return NextResponse.json({ reports: [] });
    }

    // Teachers see incident reports only (Dylan, 4 Oct 2026).
    const typeParam = role === "TEACHER" ? "INCIDENT" : req.nextUrl.searchParams.get("type");
    const childId = req.nextUrl.searchParams.get("childId");

    const reports = await db.childReport.findMany({
      where: {
        organizationId,
        ...(scope.mode === "single" ? { categoryId: scope.categoryId } : {}),
        ...(typeParam ? { type: typeParam as "INCIDENT" | "ACADEMIC" | "DISCIPLINARY" } : {}),
        ...(childId ? { childId } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: listSelect,
    });

    return NextResponse.json({ reports });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");

    const body = reportCreateSchema.parse(await req.json());
    if (role === "TEACHER" && body.type !== "INCIDENT") {
      return NextResponse.json({ error: "Teachers can only write incident reports." }, { status: 403 });
    }

    const child = await db.child.findFirst({
      where: { id: body.childId, organizationId },
      select: { id: true, categoryId: true, firstName: true, lastName: true },
    });
    if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (role === "TEACHER" && child.categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not allowed for your class." }, { status: 403 });
    }

    const report = await db.childReport.create({
      data: {
        organizationId,
        childId: child.id,
        categoryId: child.categoryId,
        type: body.type,
        occurredAt: body.occurredAt,
        summary: body.summary,
        parentNotified: body.parentNotified,
        parentNotifiedAt: body.parentNotified ? new Date() : null,
        injury: body.type === "INCIDENT" ? body.injury ?? false : null,
        firstAidGiven: body.type === "INCIDENT" ? body.firstAidGiven ?? false : null,
        witnesses: body.type === "INCIDENT" ? blankToNull(body.witnesses) : null,
        actionTaken: body.type === "INCIDENT" ? blankToNull(body.actionTaken) : null,
        term: body.type === "ACADEMIC" ? blankToNull(body.term) : null,
        developmentArea: body.type === "ACADEMIC" ? blankToNull(body.developmentArea) : null,
        rating: body.type === "ACADEMIC" ? blankToNull(body.rating) : null,
        behaviour: body.type === "DISCIPLINARY" ? blankToNull(body.behaviour) : null,
        followUp: body.type === "DISCIPLINARY" ? blankToNull(body.followUp) : null,
        createdByUserId: userId,
      },
      select: listSelect,
    });

    await logAudit({
      organizationId,
      userId,
      action: "report.created",
      entityType: "Child",
      entityId: child.id,
      metadata: { childFirstName: child.firstName, childLastName: child.lastName, type: body.type },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
