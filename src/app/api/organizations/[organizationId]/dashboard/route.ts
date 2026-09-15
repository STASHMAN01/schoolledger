import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { buildDrilldownTree, type LeafRow } from "@/lib/billing/dashboard";
import { describeAuditAction } from "@/lib/auditLabel";

type Params = { params: Promise<{ organizationId: string }> };

// Fetches everything server-side and aggregates in JS rather than with a
// SQL GROUP BY across relations. Deliberate MVP simplification: this
// product's expected scale (one school's children and monthly entries) is
// small enough that this is fast and, more importantly, easy to read and
// get right — see PHASES.md if a school's data volume ever makes this
// worth moving to raw aggregation queries.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view for now — see SECURITY.md re: per-field VIEWER scoping (Phase 5)

    const childrenCount = await db.child.count({
      where: { organizationId, archived: false },
    });

    const outstandingEntries = await db.financialPlanEntry.findMany({
      where: {
        organizationId,
        status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] },
        child: { archived: false },
      },
      include: {
        child: { include: { category: true } },
        paymentType: true,
      },
    });

    const outstandingRows: LeafRow[] = outstandingEntries.map((e) => ({
      categoryId: e.child.categoryId,
      categoryName: e.child.category.name,
      paymentTypeId: e.paymentTypeId,
      paymentTypeName: e.paymentType.name,
      childId: e.childId,
      childName: `${e.child.firstName} ${e.child.lastName}`,
      amountCents: e.amountDueCents - e.amountPaidCents,
    }));

    const accountsDueMap = new Map<string, { childId: string; name: string; amountCents: number }>();
    for (const row of outstandingRows) {
      const existing = accountsDueMap.get(row.childId);
      if (existing) {
        existing.amountCents += row.amountCents;
      } else {
        accountsDueMap.set(row.childId, {
          childId: row.childId,
          name: row.childName,
          amountCents: row.amountCents,
        });
      }
    }
    const accountsDue = Array.from(accountsDueMap.values())
      .filter((a) => a.amountCents > 0)
      .sort((a, b) => b.amountCents - a.amountCents);

    // Among children who currently owe money: how many have already been
    // reminded at least once (lastReminderSentAt set) vs. never reminded.
    // Feeds the "Reminders sent / unsent" shortcut buttons on this page.
    const remindableChildIds = new Set(accountsDue.map((a) => a.childId));
    const lastReminderByChild = new Map<string, Date | null>();
    for (const e of outstandingEntries) {
      if (!remindableChildIds.has(e.childId)) continue;
      lastReminderByChild.set(e.childId, e.child.lastReminderSentAt);
    }
    let remindersSentCount = 0;
    let remindersUnsentCount = 0;
    for (const lastSent of lastReminderByChild.values()) {
      if (lastSent) remindersSentCount++;
      else remindersUnsentCount++;
    }

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const paidAllocations = await db.paymentAllocation.findMany({
      where: {
        payment: { organizationId, date: { gte: startOfMonth, lt: startOfNextMonth } },
      },
      include: {
        financialPlanEntry: { include: { paymentType: true } },
        payment: { include: { child: { include: { category: true } } } },
      },
    });

    const paidThisMonthRows: LeafRow[] = paidAllocations.map((a) => ({
      categoryId: a.payment.child.categoryId,
      categoryName: a.payment.child.category.name,
      paymentTypeId: a.financialPlanEntry.paymentTypeId,
      paymentTypeName: a.financialPlanEntry.paymentType.name,
      childId: a.payment.childId,
      childName: `${a.payment.child.firstName} ${a.payment.child.lastName}`,
      amountCents: a.amountCents,
    }));

    const recentAudit = await db.auditLog.findMany({
      where: { organizationId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      childrenCount,
      outstandingTotalCents: outstandingRows.reduce((s, r) => s + r.amountCents, 0),
      outstandingTree: buildDrilldownTree(outstandingRows),
      paidThisMonthTotalCents: paidThisMonthRows.reduce((s, r) => s + r.amountCents, 0),
      paidThisMonthTree: buildDrilldownTree(paidThisMonthRows),
      accountsDue,
      remindersSentCount,
      remindersUnsentCount,
      activity: recentAudit.map((a) => ({
        id: a.id,
        userName: a.user?.name ?? "Someone",
        label: describeAuditAction(a),
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
