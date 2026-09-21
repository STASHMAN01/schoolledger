import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { deletionRequestSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
// (isHighPositionRole retired — see src/lib/permissions.ts APPROVE_DELETION)
import { formatCents } from "@/lib/formatMoney";

type Params = { params: Promise<{ organizationId: string }> };

// The Settings → "Pending deletions" queue, for admins to review and
// approve/reject everything currently awaiting the second (or first)
// approval, across both categories and children in one list.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "APPROVE_DELETION");

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
        reason: r.reason,
        createdAt: r.createdAt,
        requestedBy: requesterName.get(r.requestedByUserId) ?? "Someone",
        approvals: r.approvals.map((a) => a.user.name),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Anyone who can manage children/classes can also request their deletion;
// requesting a child's deletion (or a payment's) additionally needs a
// permission most roles don't have by default — APPROVE_DELETION for a
// child (only an admin, by default, per the org owner's original "no
// other roles may delete records" rule) and VIEW_MONEY for a payment
// (matches who can see the amount being deleted). Either way this only
// ever creates a request: nothing is deleted here.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, permissions } = await requireMembership(
      organizationId,
      "REQUEST_DELETION"
    );

    const body = deletionRequestSchema.parse(await req.json());

    if (body.targetType === "CHILD" && !permissions.includes("APPROVE_DELETION")) {
      return NextResponse.json(
        { error: "Only an admin can request deletion of a child's records." },
        { status: 403 }
      );
    }
    if (body.targetType === "PAYMENT" && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json(
        { error: "Only an admin or accountant can request deletion of a payment." },
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

    if (body.targetType === "PAYMENT") {
      const payment = await db.payment.findFirst({
        where: { id: body.targetId, organizationId },
        include: { child: true, organization: { select: { currencyCode: true } } },
      });
      if (!payment) {
        return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      }
      targetLabel = `${formatCents(payment.amountCents, payment.organization.currencyCode)} payment for ${payment.child.firstName} ${payment.child.lastName} on ${payment.date.toISOString().slice(0, 10)}`;
    } else if (body.targetType === "CATEGORY") {
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
        reason: body.reason,
        requestedByUserId: userId,
      },
    });

    const entityType =
      body.targetType === "CATEGORY" ? "Category" : body.targetType === "CHILD" ? "Child" : "Payment";
    await logAudit({
      organizationId,
      userId,
      action: `${entityType.toLowerCase()}.deletionRequested`,
      entityType,
      entityId: body.targetId,
      metadata: { targetLabel, reason: body.reason, deletionRequestId: request.id },
    });

    return NextResponse.json({ deletionRequest: request }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
