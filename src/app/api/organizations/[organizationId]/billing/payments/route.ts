import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { formatReceiptNumber } from "@/lib/billing/subscriptionReceiptPdf";

type Params = { params: Promise<{ organizationId: string }> };

// This school's own Crechely subscription payments (newest first), for the
// payment history on Settings -> Billing. Readable even once the school is
// read-only -- they may need old receipts for their books.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "MANAGE_BILLING", { skipAccessCheck: true });

    const payments = await db.subscriptionPayment.findMany({
      where: { organizationId },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        receiptNumber: formatReceiptNumber(p.receiptNumber),
        paidAt: p.paidAt,
        amountCents: p.amountCents,
        currencyCode: p.currencyCode,
        planInterval: p.planInterval,
        planName: p.planName,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        cardBrand: p.cardBrand,
        cardLast4: p.cardLast4,
        channel: p.channel,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
