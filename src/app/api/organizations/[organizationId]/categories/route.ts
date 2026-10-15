import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { ageRangeProblem, categoryCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { gradeNameProblem, normaliseGradeList, orderGrades, stagedCreatedAt } from "@/lib/classGroups";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, permissions } = await requireMembership(organizationId); // any member may view
    const canViewMoney = permissions.includes("VIEW_MONEY");

    // deletedAt is a stronger, separate state than `archived` — a category
    // pending/awaiting trash purge never shows up here, "show archived" or
    // not; it only appears in Settings → Trash.
    //
    // Top-level classes only: a grade (parentId set) is returned inside its
    // class's `grades`, never as an entry of its own, so every class picker
    // keeps working unchanged (class groups, 15 Oct 2026).
    const categories = await db.category.findMany({
      where: { organizationId, deletedAt: null, parentId: null },
      orderBy: { name: "asc" },
      include: {
        // Grades of a class group (archived ones too, so they can be restored).
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            archived: true,
            createdAt: true,
            _count: {
              select: { gradeLearners: { where: { archived: false, deletedAt: null, exitDate: null } } },
            },
          },
        },
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
        const { teacherAssignments, _count, children: gradeRows, ...rest } = c;
        return {
          ...rest,
          grades: orderGrades(gradeRows).map((g) => ({
            id: g.id,
            name: g.name,
            archived: g.archived,
            childCount: g._count.gradeLearners,
          })),
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

    const body = categoryCreateSchema.parse(await req.json());

    // ---- A grade: a sub-class of an existing top-level class ---------------
    if (body.parentId) {
      if (body.grades?.length) {
        return NextResponse.json({ error: "A grade can't have grades of its own." }, { status: 400 });
      }
      if (body.monthlyFeeCents != null || body.ageMinMonths != null || body.ageMaxMonths != null) {
        return NextResponse.json(
          { error: "A grade has no fee or age range. Set the fee on the class." },
          { status: 400 }
        );
      }
      // Never trust a parent id from the client: it must be a live,
      // top-level class of this organisation (one level of nesting only).
      const parent = await db.category.findFirst({
        where: { id: body.parentId, organizationId, deletedAt: null, parentId: null },
      });
      if (!parent) {
        return NextResponse.json({ error: "Class not found." }, { status: 400 });
      }
      const siblings = await db.category.findMany({
        where: { organizationId, parentId: parent.id, deletedAt: null },
        select: { name: true },
      });
      const nameProblem = gradeNameProblem(body.name, siblings.map((g) => g.name));
      if (nameProblem) return NextResponse.json({ error: nameProblem }, { status: 400 });

      const grade = await db.category.create({
        data: { organizationId, parentId: parent.id, name: body.name },
      });
      await logAudit({
        organizationId,
        userId,
        action: "grade.created",
        entityType: "Category",
        entityId: grade.id,
        metadata: { name: grade.name, className: parent.name, classId: parent.id },
      });
      return NextResponse.json({ category: grade }, { status: 201 });
    }

    // ---- A standalone class, or a group created together with its grades ----
    const ageProblem = ageRangeProblem(body.ageMinMonths, body.ageMaxMonths);
    if (ageProblem) return NextResponse.json({ error: ageProblem }, { status: 400 });

    // Setting a fee is a money action (e.g. a MANAGER can add classes but
    // not price them).
    if (body.monthlyFeeCents != null && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "You don't have permission to set a fee." }, { status: 403 });
    }

    const gradeList = normaliseGradeList(body.grades ?? []);
    if (gradeList.problem) return NextResponse.json({ error: gradeList.problem }, { status: 400 });

    const { category, grades } = await db.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          organizationId,
          name: body.name,
          monthlyFeeCents: body.monthlyFeeCents ?? null,
          ageMinMonths: body.ageMinMonths ?? null,
          ageMaxMonths: body.ageMaxMonths ?? null,
        },
      });
      // Created one by one with staged timestamps: grades are shown in
      // creation order (Gr R, Gr 1 ... Gr 12).
      const stamps = stagedCreatedAt(gradeList.names.length);
      const grades = [];
      for (let i = 0; i < gradeList.names.length; i++) {
        grades.push(
          await tx.category.create({
            data: { organizationId, parentId: category.id, name: gradeList.names[i], createdAt: stamps[i] },
          })
        );
      }
      return { category, grades };
    });

    await logAudit({
      organizationId,
      userId,
      action: "category.created",
      entityType: "Category",
      entityId: category.id,
      metadata: { name: category.name, ...(grades.length > 0 ? { grades: grades.length } : {}) },
    });

    return NextResponse.json({ category, grades }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
