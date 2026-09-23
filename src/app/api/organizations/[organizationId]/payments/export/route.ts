import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { escapeCsvField } from "@/lib/csv";

type Params = { params: Promise<{ organizationId: string }> };


// Same view permission as GET /payments — this is just a different
// rendering of data they can already see on the Payments page, not a new
// disclosure.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "VIEW_MONEY");

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
        child: { select: { firstName: true, lastName: true } },
        recordedBy: { select: { name: true } },
        receipt: true,
      },
      orderBy: { date: "desc" },
      // No 200-row cap here (unlike the on-screen list) — an accountant
      // exporting for reconciliation needs the whole filtered set, not a
      // preview of it.
    });

    const header = [
      "Date",
      "Child",
      "Amount",
      "Method",
      "Receipt",
      "Reference",
      "Notes",
      "Recorded by",
    ];
    const rows = payments.map((p) => [
      p.date.toISOString().slice(0, 10),
      `${p.child.firstName} ${p.child.lastName}`,
      (p.amountCents / 100).toFixed(2),
      p.method,
      p.receipt?.number ?? "",
      p.reference ?? "",
      p.notes ?? "",
      p.recordedBy.name,
    ]);

    const csv =
      [header, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n") +
      "\r\n";

    const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
