import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { deletionRequestSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
// (isHighPositionRole retired — see src/lib/permissions.ts APPROVE_DELETION)
import { formatCents } from "@/lib/formatMoney";
import { entityTypeFor, executeDeletion } from "@/lib/deletionExecute";

type Params = { params: Promise<{ organizationId: string }> };

// Leftover requests from before 4 Oct 2026, when deleting needed
// approvals. Settings -> Trash lists them so an admin can carry each one
// out (the approve route) or cancel it. No new ones are ever created.
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

// The Delete button (one step since 4 Oct 2026, Dylan): an admin deletes
// straight away, no approvals. A class or child goes to Trash for 30
// days (restorable; admins get a final-review to-do on the last day); a
// payment is reversed immediately. The DeletionRequest row is still
// written, already APPROVED, so the reason and who did it stay on record.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    // Admins only (APPROVE_DELETION) -- with no second person checking,
    // deleting is limited to the people who used to do the approving.
    const { userId, permissions } = await requireMembership(organizationId, "APPROVE_DELETION");

    const body = deletionRequestSchema.parse(await req.json());

    if (body.targetType === "PAYMENT" && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "You can't delete payments." }, { status: 403 });
    }
    // A payment can't be restored, so it always needs a reason on record.
    if (body.targetType === "PAYMENT" && !body.reason) {
      return NextResponse.json(
        { error: "Please explain why this payment is being deleted." },
        { status: 400 }
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
        { error: "There's an older deletion request for this. Finish or cancel it in Settings → Trash." },
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
        return NextResponse.json({ error: "Class not found." }, { status: 404 });
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

    const { request, paymentReversal } = await db.$transaction(async (tx) => {
      const request = await tx.deletionRequest.create({
        data: {
          organizationId,
          targetType: body.targetType,
          targetId: body.targetId,
          targetLabel,
          reason: body.reason || "",
          requestedByUserId: userId,
          status: "APPROVED",
          resolvedAt: new Date(),
        },
      });
      await tx.deletionApproval.create({ data: { deletionRequestId: request.id, userId } });
      const paymentReversal = await executeDeletion(tx, organizationId, body.targetType, body.targetId);
      return { request, paymentReversal };
    });

    const entityType = entityTypeFor(body.targetType);
    await logAudit({
      organizationId,
      userId,
      action: `${entityType.toLowerCase()}.deleted`,
      entityType,
      entityId: body.targetId,
      metadata: {
        targetLabel,
        reason: body.reason || undefined,
        deletionRequestId: request.id,
        ...(paymentReversal ? { paymentReversal } : {}),
      },
    });

    return NextResponse.json({ deletionRequest: request }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
