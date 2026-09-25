import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { sweepCreditIntoOutstanding } from "@/lib/billing/financialPlan";

type Tx = Prisma.TransactionClient;

/**
 * Which children an Event charges: every active child (not archived,
 * already enrolled by the event date, and not yet exited by the event
 * date) in one of the target categories — spec section 9 ("every active
 * child in the selected class(es)"). Exported separately so the create
 * route can show "this will charge N children" before committing, and the
 * actual creation can reuse the exact same query.
 */
export async function activeChildrenForEvent(
  tx: Tx,
  organizationId: string,
  categoryIds: string[],
  eventDate: Date
) {
  return tx.child.findMany({
    where: {
      organizationId,
      categoryId: { in: categoryIds },
      archived: false,
      enrollmentDate: { lte: eventDate },
      OR: [{ exitDate: null }, { exitDate: { gte: eventDate } }],
    },
  });
}

/**
 * Creates an Event, and -- only when it's a paid one (amountCents is not
 * null) -- its dedicated one-time PaymentType plus a FinancialPlanEntry for
 * every currently-active child in the target categories. A free event (a
 * sports day, a photo day) is just a calendar entry: no PaymentType, no
 * charges, no Accounting footprint at all. Everything happens in one
 * transaction so a paid event can never exist half-created (e.g. with a
 * PaymentType but no charges).
 */
export async function createEventWithCharges(
  tx: Tx,
  organizationId: string,
  userId: string | null,
  input: { name: string; date: Date; amountCents: number | null; categoryIds: string[] }
) {
  const isPaid = input.amountCents !== null;

  const paymentType = isPaid
    ? await tx.paymentType.create({
        data: {
          organizationId,
          name: input.name,
          isRecurring: false,
          defaultAmountCents: input.amountCents,
          isEventType: true,
        },
      })
    : null;

  const event = await tx.event.create({
    data: {
      organizationId,
      paymentTypeId: paymentType?.id ?? null,
      name: input.name,
      eventDate: input.date,
      amountCents: input.amountCents,
      categories: {
        create: input.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });

  let chargedChildCount = 0;
  if (isPaid && paymentType) {
    const children = await activeChildrenForEvent(
      tx,
      organizationId,
      input.categoryIds,
      input.date
    );

    for (const child of children) {
      await tx.financialPlanEntry.create({
        data: {
          organizationId,
          childId: child.id,
          paymentTypeId: paymentType.id,
          year: input.date.getUTCFullYear(),
          month: null,
          description: input.name,
          amountDueCents: input.amountCents!,
        },
      });
      // A child holding credit gets it applied to the new charge straight
      // away, same rule as the annual plan (final inspection B4).
      await sweepCreditIntoOutstanding(tx, organizationId, child.id, userId);
    }
    chargedChildCount = children.length;
  }

  await logAudit({
    organizationId,
    userId,
    action: "event.created",
    entityType: "Event",
    entityId: event.id,
    metadata: { name: input.name, chargedChildCount, isPaid },
  });

  return { event, chargedChildCount, isPaid };
}
