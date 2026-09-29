import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { BULK_SEND_COOLDOWN_MS, reminderSendPreview, sendAllReminders } from "@/lib/reminderSendAll";

type Params = { params: Promise<{ organizationId: string }> };

// What "Send all reminders" would do right now: how many parents get an
// email, how many have no email, and the From / Reply-To they'll see.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "VIEW_MONEY");
    const preview = await reminderSendPreview(organizationId);
    if (!preview) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ preview });
  } catch (err) {
    return handleApiError(err);
  }
}

// Emails every parent who owes money, immediately. One ADMIN/ACCOUNTANT
// (VIEW_MONEY) is enough; the send is recorded in the Activity log.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "VIEW_MONEY");

    const preview = await reminderSendPreview(organizationId);
    if (!preview) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (preview.withEmailCount === 0) {
      return NextResponse.json(
        { error: "No parent with an outstanding balance has an email address on file." },
        { status: 400 }
      );
    }
    if (preview.lastBulkReminderAt && Date.now() - preview.lastBulkReminderAt.getTime() < BULK_SEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Reminders were sent to everyone a few minutes ago. Wait 15 minutes before sending again." },
        { status: 429 }
      );
    }

    const result = await sendAllReminders(organizationId, { userId, trigger: "manual" });
    return NextResponse.json({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
