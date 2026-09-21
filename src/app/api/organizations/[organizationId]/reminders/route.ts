import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { buildReminderMessage } from "@/lib/billing/reminders";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/billing/reminderTemplates";
import { getOutstandingReminders } from "@/lib/billing/outstandingReminders";

type Params = { params: Promise<{ organizationId: string }> };

// Who currently owes money, with a ready-to-send reminder message per
// child. Deliberately read-only/on-demand rather than a scheduled job —
// see PHASES.md for why (no email provider wired up for the per-child
// WhatsApp/mailto flow; the separate "Send all" 2-approval flow does
// actually send email, see the send-request routes alongside this one).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    // Shows exactly what each parent owes — money — so this needs VIEW_MONEY
    // now (see src/lib/permissions.ts).
    await requireMembership(organizationId, "VIEW_MONEY");

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, currencyCode: true, reminderMessageTemplate: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const template = organization.reminderMessageTemplate ?? DEFAULT_REMINDER_TEMPLATE;
    const outstanding = await getOutstandingReminders(organizationId);

    const reminders = outstanding.map((r) => ({
      ...r,
      message: buildReminderMessage(
        {
          schoolName: organization.name,
          parentName: r.parentName,
          childName: r.childName,
          outstandingCents: r.outstandingCents,
          currencyCode: organization.currencyCode,
        },
        template
      ),
    }));

    return NextResponse.json({ reminders });
  } catch (err) {
    return handleApiError(err);
  }
}
