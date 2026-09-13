import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { buildReminderMessage } from "@/lib/billing/reminders";

type Params = { params: Promise<{ organizationId: string }> };

// Who currently owes money, with a ready-to-send reminder message per
// child. Deliberately read-only/on-demand rather than a scheduled job —
// see PHASES.md for why (no email provider wired up yet, and the original
// spec treats sending as a manual step the admin takes via WhatsApp/email,
// not something this app does automatically).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, currencyCode: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

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

    const byChild = new Map<
      string,
      {
        childId: string;
        childName: string;
        categoryName: string;
        parentName: string;
        parentPhone: string | null;
        parentEmail: string | null;
        lastReminderSentAt: Date | null;
        outstandingCents: number;
      }
    >();
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

    const reminders = Array.from(byChild.values())
      .sort((a, b) => b.outstandingCents - a.outstandingCents)
      .map((r) => ({
        ...r,
        message: buildReminderMessage({
          schoolName: organization.name,
          parentName: r.parentName,
          childName: r.childName,
          outstandingCents: r.outstandingCents,
          currencyCode: organization.currencyCode,
        }),
      }));

    return NextResponse.json({ reminders });
  } catch (err) {
    return handleApiError(err);
  }
}
