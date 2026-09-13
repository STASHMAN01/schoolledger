import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";

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
 * Creates an Event and its dedicated one-time PaymentType, generates a
 * FinancialPlanEntry for every currently-active child in the target
 * categories, and links the two EventCategory rows. Everything happens in
 * one transaction so an Event can never exist half-created (e.g. with a
 * PaymentType but no charges, or charges under a PaymentType that was
 * never actually saved).
 */
export async function createEventWithCharges(
  tx: Tx,
  organizationId: string,
  userId: string | null,
  input: { name: string; date: Date; amountCents: number; categoryIds: string[] }
) {
  const paymentType = await tx.paymentType.create({
    data: {
      organizationId,
      name: input.name,
      isRecurring: false,
      defaultAmountCents: input.amountCents,
      isEventType: true,
    },
  });

  const event = await tx.event.create({
    data: {
      organizationId,
      paymentTypeId: paymentType.id,
      name: input.name,
      eventDate: input.date,
      amountCents: input.amountCents,
      categories: {
        create: input.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });

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
        amountDueCents: input.amountCents,
      },
    });
  }

  await logAudit({
    organizationId,
    userId,
    action: "event.created",
    entityType: "Event",
    entityId: event.id,
    metadata: { name: input.name, chargedChildCount: children.length },
  });

  return { event, paymentType, chargedChildCount: children.length };
}
