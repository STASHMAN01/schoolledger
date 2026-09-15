import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { deletionRequestSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { isHighPositionRole } from "@/lib/deletion";

type Params = { params: Promise<{ organizationId: string }> };

// The Settings → "Pending deletions" queue, for admins to review and
// approve/reject everything currently awaiting the second (or first)
// approval, across both categories and children in one list.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role } = await requireMembership(organizationId);
    if (!isHighPositionRole(role)) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const requests = await db.deletionRequest.findMany({
      where: { organizationId, status: "PENDING" },
      include: {
        approvals: { include: { user: { select: { name: true } } } },
        organization: false,
      },
      orderBy: { createdAt: "asc" },
    });

    const requestedByIds = [...new Set(requests.map((r) => r.requestedByUserId))];
    const requesters = await db.user.findMany({
      where: { id: { in: requestedByIds } },
      select: { id: true, name: true },
    });
    const requesterName = new Map(requesters.map((u) => [u.id, u.name]));

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel: r.targetLabel,
        createdAt: r.createdAt,
        requestedBy: requesterName.get(r.requestedByUserId) ?? "Someone",
        approvals: r.approvals.map((a) => a.user.name),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Anyone who could already archive a category (ADMIN/ACCOUNTANT/MANAGER)
// can request its deletion; only an ADMIN can request a child's deletion —
// "no other roles may delete records" per the org owner. Either way this
// only ever creates a request: nothing is deleted here.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, [
      "ADMIN",
      "ACCOUNTANT",
      "MANAGER",
    ]);

    const body = deletionRequestSchema.parse(await req.json());

    if (body.targetType === "CHILD" && !isHighPositionRole(role)) {
      return NextResponse.json(
        { error: "Only an admin can request deletion of a child's records." },
        { status: 403 }
      );
    }

    const existingPending = await db.deletionRequest.findFirst({
      where: {
        organizationId,
        targetType: body.targetType,
        targetId: body.targetId,
        status: "PENDING",
      },
    });
    if (existingPending) {
      return NextResponse.json(
        { error: "A deletion request for this record is already pending." },
        { status: 400 }
      );
    }

    let targetLabel: string;

    if (body.targetType === "CATEGORY") {
      const category = await db.category.findFirst({
        where: { id: body.targetId, organizationId, deletedAt: null },
      });
      if (!category) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      const childCount = await db.child.count({
        where: { categoryId: category.id, deletedAt: null },
      });
      if (childCount > 0) {
        return NextResponse.json(
          {
            error: `"${category.name}" still has ${childCount} ${childCount === 1 ? "child" : "children"} assigned to it. Move or remove them first.`,
          },
          { status: 400 }
        );
      }
      targetLabel = category.name;
    } else {
      const child = await db.child.findFirst({
        where: { id: body.targetId, organizationId, deletedAt: null },
      });
      if (!child) {
        return NextResponse.json({ error: "Child not found." }, { status: 404 });
      }
      targetLabel = `${child.firstName} ${child.lastName}`;
    }

    const request = await db.deletionRequest.create({
      data: {
        organizationId,
        targetType: body.targetType,
        targetId: body.targetId,
        targetLabel,
        requestedByUserId: userId,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action:
        body.targetType === "CATEGORY"
          ? "category.deletionRequested"
          : "child.deletionRequested",
      entityType: body.targetType === "CATEGORY" ? "Category" : "Child",
      entityId: body.targetId,
      metadata: { targetLabel, deletionRequestId: request.id },
    });

    return NextResponse.json({ deletionRequest: request }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
