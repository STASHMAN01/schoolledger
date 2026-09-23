import type { Prisma } from "@prisma/client";
import type { generateStatementPdf } from "./statementPdf";

// Shared between the per-child statement route and the full backup export
// (Phase 4), so both build generateStatementPdf's input the same way.

type StatementChildInput = Parameters<typeof generateStatementPdf>[1][number];

export function statementChildInclude(year: number) {
  return {
    category: true,
    creditBalance: true,
    planEntries: {
      where: { year, status: { not: "CANCELLED" as const } },
      orderBy: [{ year: "asc" as const }, { month: "asc" as const }],
      include: {
        paymentType: { select: { name: true } },
        // Actual payment date(s) applied against this charge — Dylan
        // asked for specific payment dates on the statement, not just
        // the charge period. A partially-paid entry can have more
        // than one allocation (several smaller payments over time).
        allocations: {
          select: { amountCents: true, payment: { select: { date: true } } },
          orderBy: { payment: { date: "asc" as const } },
        },
      },
    },
  } satisfies Prisma.ChildInclude;
}

export type StatementChildRow = Prisma.ChildGetPayload<{
  include: ReturnType<typeof statementChildInclude>;
}>;

export function toStatementChild(c: StatementChildRow): StatementChildInput {
  return {
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
  };
}
