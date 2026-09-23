import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { ageRangeProblem, categorySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, permissions } = await requireMembership(organizationId); // any member may view
    const canViewMoney = permissions.includes("VIEW_MONEY");

    // deletedAt is a stronger, separate state than `archived` — a category
    // pending/awaiting trash purge never shows up here, "show archived" or
    // not; it only appears in Settings → Trash.
    const categories = await db.category.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        // For the Centre Classes page: who teaches it and how many children
        // are currently in it (Dylan 23 Sept).
        teacherAssignments: {
          where: { role: "TEACHER" },
          select: { id: true, user: { select: { name: true } } },
        },
        _count: {
          select: { learners: { where: { archived: false, deletedAt: null, exitDate: null } } },
        },
      },
    });

    const pendingRequests = await db.deletionRequest.findMany({
      where: {
        organizationId,
        targetType: "CATEGORY",
        status: "PENDING",
        targetId: { in: categories.map((c) => c.id) },
      },
      include: { approvals: true },
    });
    const requestByCategoryId = new Map(pendingRequests.map((r) => [r.targetId, r]));

    return NextResponse.json({
      categories: categories.map((c) => {
        const request = requestByCategoryId.get(c.id);
        const { teacherAssignments, _count, ...rest } = c;
        return {
          ...rest,
          teachers: teacherAssignments.map((t) => ({ id: t.id, name: t.user.name })),
          childCount: _count.learners,
          // Class fees are money (final inspection R12).
          monthlyFeeCents: canViewMoney ? c.monthlyFeeCents : null,
          deletionRequest: request
            ? {
                id: request.id,
                approvalsCount: request.approvals.length,
                approvedByMe: request.approvals.some((a) => a.userId === userId),
                requestedByMe: request.requestedByUserId === userId,
                reason: request.reason,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, permissions } = await requireMembership(organizationId, "MANAGE_CLASSES");

    const body = categorySchema.parse(await req.json());

    const ageProblem = ageRangeProblem(body.ageMinMonths, body.ageMaxMonths);
    if (ageProblem) return NextResponse.json({ error: ageProblem }, { status: 400 });

    // Setting a fee is a money action (e.g. a MANAGER can add classes but
    // not price them).
    if (body.monthlyFeeCents != null && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "You don't have permission to set a fee." }, { status: 403 });
    }

    const category = await db.category.create({
      data: {
        organizationId,
        name: body.name,
        monthlyFeeCents: body.monthlyFeeCents ?? null,
        ageMinMonths: body.ageMinMonths ?? null,
        ageMaxMonths: body.ageMaxMonths ?? null,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "category.created",
      entityType: "Category",
      entityId: category.id,
      metadata: { name: category.name },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
