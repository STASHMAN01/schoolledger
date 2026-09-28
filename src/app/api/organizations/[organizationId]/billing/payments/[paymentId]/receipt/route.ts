import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { generateSubscriptionReceiptPdf, receiptFilename } from "@/lib/billing/subscriptionReceiptPdf";

type Params = { params: Promise<{ organizationId: string; paymentId: string }> };

// PDF receipt for one subscription payment. ?download=1 saves it instead of
// opening it in the browser.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, paymentId } = await params;
    await requireMembership(organizationId, "MANAGE_BILLING", { skipAccessCheck: true });

    // Scoped to this organization -- never serve another school's receipt
    // just because someone guessed a payment id.
    const payment = await db.subscriptionPayment.findFirst({
      where: { id: paymentId, organizationId },
    });
    const organization = await db.organization.findUnique({ where: { id: organizationId } });
    if (!payment || !organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const pdfBytes = await generateSubscriptionReceiptPdf(payment, {
      name: organization.name,
      addressLine1: organization.addressLine1,
      addressLine2: organization.addressLine2,
      province: organization.province,
      contactEmail: organization.contactEmail,
    });

    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${receiptFilename(payment)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
