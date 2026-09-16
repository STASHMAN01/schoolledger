import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { buildStatementFilename, generateStatementPdf } from "@/lib/billing/statementPdf";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId } = await requireMembership(organizationId); // any role may view/generate

    const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();

    // Optional joint statement: other children (typically a sibling with
    // the same surname) explicitly chosen in the UI. Each id is
    // re-validated against this organization — never trust an id list from
    // the client without checking tenancy on every single one of them.
    const siblingIdsParam = req.nextUrl.searchParams.get("siblingIds");
    const siblingIds = siblingIdsParam
      ? siblingIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const organization = await db.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const childIds = [childId, ...siblingIds];
    const children = await db.child.findMany({
      where: { id: { in: childIds }, organizationId },
      include: {
        category: true,
        creditBalance: true,
        planEntries: {
          where: { year, status: { not: "CANCELLED" } },
          orderBy: [{ year: "asc" }, { month: "asc" }],
          include: {
            paymentType: { select: { name: true } },
            // Actual payment date(s) applied against this charge — Dylan
            // asked for specific payment dates on the statement, not just
            // the charge period. A partially-paid entry can have more
            // than one allocation (several smaller payments over time).
            allocations: {
              select: { amountCents: true, payment: { select: { date: true } } },
              orderBy: { payment: { date: "asc" } },
            },
          },
        },
      },
    });

    if (children.length === 0 || !children.some((c) => c.id === childId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const pdfBytes = await generateStatementPdf(
      organization,
      children.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        parentName: c.parentName,
        category: c.category,
        creditBalanceCents: c.creditBalance?.amountCents ?? 0,
        entries: c.planEntries.map((e) => ({
          year: e.year,
          month: e.month,
          description: e.description,
          paymentTypeName: e.paymentType.name,
          amountDueCents: e.amountDueCents,
          amountPaidCents: e.amountPaidCents,
          status: e.status,
          paidDates: e.allocations.map((a) => a.payment.date),
        })),
      })),
      year
    );

    await logAudit({
      organizationId,
      userId,
      action: "statement.generated",
      entityType: "Child",
      entityId: childId,
      metadata: { year, jointWith: siblingIds.length > 0 ? siblingIds : undefined },
    });

    const primaryChild = children.find((c) => c.id === childId)!;
    const filename = buildStatementFilename(primaryChild.firstName, primaryChild.lastName);
    // "inline" (the default) lets the "View statement" link open the PDF
    // in-browser/in-tab; "?download=1" (the "Download" button) asks for
    // "attachment" instead, which is what actually makes mobile browsers
    // save the file with our filename rather than just displaying it with
    // no visible way to save or share it — see the child detail page's
    // three-button row (View / Download / Share) for why both exist.
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
