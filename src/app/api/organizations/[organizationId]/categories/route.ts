import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { categorySchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId); // any role may view

    // deletedAt is a stronger, separate state than `archived` — a category
    // pending/awaiting trash purge never shows up here, "show archived" or
    // not; it only appears in Settings → Trash.
    const categories = await db.category.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
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
        return {
          ...c,
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
    const { userId } = await requireMembership(organizationId, [
      "ADMIN",
      "ACCOUNTANT",
      "MANAGER",
    ]);

    const body = categorySchema.parse(await req.json());

    if (body.parentId) {
      // The parent MUST belong to the same organization — otherwise a
      // crafted parentId could be used to probe/link into another
      // school's category tree.
      const parent = await db.category.findFirst({
        where: { id: body.parentId, organizationId, deletedAt: null },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found." },
          { status: 400 }
        );
      }
    }

    const category = await db.category.create({
      data: {
        organizationId,
        name: body.name,
        parentId: body.parentId ?? null,
        monthlyFeeCents: body.monthlyFeeCents ?? null,
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
