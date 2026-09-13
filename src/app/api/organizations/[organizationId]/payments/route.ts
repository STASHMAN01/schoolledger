import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { recordPaymentSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { allocateOldestFirst, statusForEntry } from "@/lib/billing/allocation";
import { nextReceiptNumber } from "@/lib/billing/receipt";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view

    const method = req.nextUrl.searchParams.get("method") ?? undefined;
    const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
    const childId = req.nextUrl.searchParams.get("childId") ?? undefined;

    const payments = await db.payment.findMany({
      where: {
        organizationId,
        method: method ? (method as "CASH" | "EFT" | "CARD" | "OTHER") : undefined,
        childId: childId || undefined,
        child: categoryId ? { categoryId } : undefined,
      },
      include: {
        child: { select: { id: true, firstName: true, lastName: true, categoryId: true } },
        recordedBy: { select: { id: true, name: true } },
        receipt: true,
        allocations: true,
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    return NextResponse.json({ payments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    // Recording money movement is intentionally narrower than
    // categories/children management — MANAGER can organize the school but
    // does not record payments, per the original role spec.
    const { userId } = await requireMembership(organizationId, ["ADMIN", "ACCOUNTANT"]);

    const body = recordPaymentSchema.parse(await req.json());

    const child = await db.child.findFirst({
      where: { id: body.childId, organizationId },
    });
    if (!child) {
      return NextResponse.json({ error: "Child not found." }, { status: 400 });
    }

    let targetPaymentTypeId: string | undefined;
    if (body.paymentTypeId) {
      const paymentType = await db.paymentType.findFirst({
        where: { id: body.paymentTypeId, organizationId },
      });
      if (!paymentType) {
        return NextResponse.json(
          { error: "Payment type not found." },
          { status: 400 }
        );
      }
      // Only a one-time type routes directly to its own entry — a
      // recurring type (School Fees) always goes through the general
      // oldest-first waterfall across all outstanding recurring entries,
      // per spec section 7.
      if (!paymentType.isRecurring) {
        targetPaymentTypeId = paymentType.id;
      }
    }

    const result = await db.$transaction(async (tx) => {
      // A specific one-time type (e.g. "Uniform") targets only that
      // type's own outstanding entry. Otherwise this is a general payment
      // and only runs against recurring-type entries (School Fees,
      // Aftercare) — it must never silently sweep up an unrelated
      // one-time charge like a Trip that the parent hasn't paid yet.
      const candidateEntries = await tx.financialPlanEntry.findMany({
        where: {
          organizationId,
          childId: body.childId,
          status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] },
          ...(targetPaymentTypeId
            ? { paymentTypeId: targetPaymentTypeId }
            : { paymentType: { isRecurring: true } }),
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      });

      const { lines, remainingCents } = allocateOldestFirst(
        candidateEntries,
        body.amountCents
      );

      const payment = await tx.payment.create({
        data: {
          organizationId,
          childId: body.childId,
          amountCents: body.amountCents,
          method: body.method,
          date: body.date,
          reference: body.reference,
          notes: body.notes,
          recordedByUserId: userId,
        },
      });

      for (const line of lines) {
        const entry = candidateEntries.find((e) => e.id === line.entryId)!;
        const newPaid = entry.amountPaidCents + line.amountCents;

        await tx.financialPlanEntry.update({
          where: { id: entry.id },
          data: {
            amountPaidCents: newPaid,
            status: statusForEntry(entry.amountDueCents, newPaid),
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            financialPlanEntryId: entry.id,
            amountCents: line.amountCents,
          },
        });
      }

      let creditAppliedCents = 0;
      if (remainingCents > 0) {
        const credit = await tx.creditBalance.upsert({
          where: { childId: body.childId },
          create: { organizationId, childId: body.childId, amountCents: remainingCents },
          update: { amountCents: { increment: remainingCents } },
        });
        creditAppliedCents = credit.amountCents;
      }

      const receiptNumber = await nextReceiptNumber(
        tx,
        organizationId,
        body.date.getUTCFullYear()
      );
      const receipt = await tx.receipt.create({
        data: { paymentId: payment.id, number: receiptNumber },
      });

      return { payment, receipt, allocatedLines: lines, remainingCents, creditAppliedCents };
    });

    await logAudit({
      organizationId,
      userId,
      action: "payment.recorded",
      entityType: "Payment",
      entityId: result.payment.id,
      metadata: {
        childId: body.childId,
        amountCents: body.amountCents,
        receiptNumber: result.receipt.number,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
