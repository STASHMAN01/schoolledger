import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { REQUIRED_DELETION_APPROVALS, isHighPositionRole } from "@/lib/deletion";

type Params = { params: Promise<{ organizationId: string; requestId: string }> };

// Records one admin's approval, and — once REQUIRED_DELETION_APPROVALS
// distinct admins have each done this — actually performs the soft-delete
// in the same transaction. This is the only place in the codebase that
// ever sets Category.deletedAt / Child.deletedAt.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, requestId } = await params;
    const { userId, role } = await requireMembership(organizationId);
    if (!isHighPositionRole(role)) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const request = await db.deletionRequest.findFirst({
      where: { id: requestId, organizationId },
      include: { approvals: true },
    });
    if (!request) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "This request has already been resolved." },
        { status: 400 }
      );
    }
    if (request.approvals.some((a) => a.userId === userId)) {
      return NextResponse.json({ error: "You already approved this." }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      await tx.deletionApproval.create({
        data: { deletionRequestId: requestId, userId },
      });

      // Recount inside the transaction rather than trusting the count
      // fetched before it started — two admins approving within moments of
      // each other must never both see themselves as "not yet at 2" and
      // leave the request stuck pending forever.
      const approvalCount = await tx.deletionApproval.count({
        where: { deletionRequestId: requestId },
      });
      // Re-check status too: a concurrent approval that already executed
      // the deletion (and this one arrived a beat later) should record the
      // extra approval but not try to execute/resolve a second time.
      const current = await tx.deletionRequest.findUnique({
        where: { id: requestId },
        select: { status: true },
      });
      if (approvalCount < REQUIRED_DELETION_APPROVALS || current?.status !== "PENDING") {
        return { executed: false, approvalCount };
      }

      // Second (or later) distinct admin approval — execute the deletion.
      if (request.targetType === "CATEGORY") {
        await tx.category.updateMany({
          where: { id: request.targetId, organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      } else {
        await tx.child.updateMany({
          where: { id: request.targetId, organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }

      await tx.deletionRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", resolvedAt: new Date() },
      });

      return { executed: true, approvalCount };
    });

    await logAudit({
      organizationId,
      userId,
      action: result.executed
        ? request.targetType === "CATEGORY"
          ? "category.deleted"
          : "child.deleted"
        : request.targetType === "CATEGORY"
          ? "category.deletionApproved"
          : "child.deletionApproved",
      entityType: request.targetType === "CATEGORY" ? "Category" : "Child",
      entityId: request.targetId,
      metadata: {
        targetLabel: request.targetLabel,
        approvalCount: result.approvalCount,
        deletionRequestId: request.id,
      },
    });

    return NextResponse.json({
      executed: result.executed,
      approvalCount: result.approvalCount,
      requiredApprovals: REQUIRED_DELETION_APPROVALS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
