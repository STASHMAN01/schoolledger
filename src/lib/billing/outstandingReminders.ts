import { db } from "@/lib/db";

// Split out of reminders.ts specifically because this one needs the
// database — see the comment at the top of reminders.ts for why that file
// stays DB-free. Shared by the read-only GET /reminders list and the
// "Send all" 2-approval execution path, so there's exactly one place that
// decides "who currently owes money" for both.

export type OutstandingReminder = {
  childId: string;
  childName: string;
  categoryName: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  lastReminderSentAt: Date | null;
  outstandingCents: number;
};

export async function getOutstandingReminders(
  organizationId: string
): Promise<OutstandingReminder[]> {
  const entries = await db.financialPlanEntry.findMany({
    where: {
      organizationId,
      status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] },
      child: { archived: false },
    },
    select: {
      childId: true,
      amountDueCents: true,
      amountPaidCents: true,
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          parentName: true,
          parentPhone: true,
          parentEmail: true,
          lastReminderSentAt: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  const byChild = new Map<string, OutstandingReminder>();
  for (const e of entries) {
    const outstanding = e.amountDueCents - e.amountPaidCents;
    if (outstanding <= 0) continue;
    const existing = byChild.get(e.childId);
    if (existing) {
      existing.outstandingCents += outstanding;
    } else {
      byChild.set(e.childId, {
        childId: e.child.id,
        childName: `${e.child.firstName} ${e.child.lastName}`,
        categoryName: e.child.category.name,
        parentName: e.child.parentName,
        parentPhone: e.child.parentPhone,
        parentEmail: e.child.parentEmail,
        lastReminderSentAt: e.child.lastReminderSentAt,
        outstandingCents: outstanding,
      });
    }
  }

  return Array.from(byChild.values()).sort(
    (a, b) => b.outstandingCents - a.outstandingCents
  );
}
