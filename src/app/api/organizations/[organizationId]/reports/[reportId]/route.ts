import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { blankToNull, reportUpdateSchema } from "@/lib/reports";

type Params = { params: Promise<{ organizationId: string; reportId: string }> };

const detailSelect = {
  id: true,
  type: true,
  occurredAt: true,
  summary: true,
  injury: true,
  firstAidGiven: true,
  witnesses: true,
  actionTaken: true,
  term: true,
  developmentArea: true,
  rating: true,
  behaviour: true,
  followUp: true,
  parentNotified: true,
  parentNotifiedAt: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
  child: { select: { id: true, firstName: true, lastName: true, categoryId: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

async function accessibleReport(organizationId: string, reportId: string, role: string, assignedCategoryId: string | null) {
  const report = await db.childReport.findFirst({ where: { id: reportId, organizationId }, select: detailSelect });
  if (!report) return null;
  if (role === "TEACHER" && report.categoryId !== assignedCategoryId) return null;
  // Teachers work with incident reports only (Dylan, 4 Oct 2026).
  if (role === "TEACHER" && report.type !== "INCIDENT") return null;
  return report;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, reportId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);
    const report = await accessibleReport(organizationId, reportId, role, assignedCategoryId);
    if (!report) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ report });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, reportId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");
    const existing = await accessibleReport(organizationId, reportId, role, assignedCategoryId);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const body = reportUpdateSchema.parse(await req.json());
    const type = existing.type; // the report's type never changes after creation

    const report = await db.childReport.update({
      where: { id: reportId },
      data: {
        ...(body.occurredAt !== undefined ? { occurredAt: body.occurredAt } : {}),
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.parentNotified !== undefined
          ? {
              parentNotified: body.parentNotified,
              parentNotifiedAt: body.parentNotified ? existing.parentNotifiedAt ?? new Date() : null,
            }
          : {}),
        ...(type === "INCIDENT"
          ? {
              ...(body.injury !== undefined ? { injury: body.injury } : {}),
              ...(body.firstAidGiven !== undefined ? { firstAidGiven: body.firstAidGiven } : {}),
              ...(body.witnesses !== undefined ? { witnesses: blankToNull(body.witnesses) } : {}),
              ...(body.actionTaken !== undefined ? { actionTaken: blankToNull(body.actionTaken) } : {}),
            }
          : {}),
        ...(type === "ACADEMIC"
          ? {
              ...(body.term !== undefined ? { term: blankToNull(body.term) } : {}),
              ...(body.developmentArea !== undefined ? { developmentArea: blankToNull(body.developmentArea) } : {}),
              ...(body.rating !== undefined ? { rating: blankToNull(body.rating) } : {}),
            }
          : {}),
        ...(type === "DISCIPLINARY"
          ? {
              ...(body.behaviour !== undefined ? { behaviour: blankToNull(body.behaviour) } : {}),
              ...(body.followUp !== undefined ? { followUp: blankToNull(body.followUp) } : {}),
            }
          : {}),
      },
      select: detailSelect,
    });

    await logAudit({
      organizationId,
      userId,
      action: "report.updated",
      entityType: "Child",
      entityId: existing.child.id,
      metadata: { type },
    });

    return NextResponse.json({ report });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, reportId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");
    const existing = await accessibleReport(organizationId, reportId, role, assignedCategoryId);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await db.childReport.delete({ where: { id: reportId } });

    await logAudit({
      organizationId,
      userId,
      action: "report.deleted",
      entityType: "Child",
      entityId: existing.child.id,
      metadata: { type: existing.type, childFirstName: existing.child.firstName },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
