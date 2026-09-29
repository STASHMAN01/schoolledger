import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { BULK_SEND_COOLDOWN_MS, reminderSendPreview, sendAllReminders } from "@/lib/reminderSendAll";

type Params = { params: Promise<{ organizationId: string }> };

// With statements attached, emails go one at a time (about 2 a second), so
// a large school needs more than the default function time.
export const maxDuration = 300;

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

const sendSchema = z.object({ childIds: z.array(z.string().min(1).max(40)).min(1).max(1000).optional() });

// Emails every parent who owes money (or only the ticked children), immediately. One ADMIN/ACCOUNTANT
// (VIEW_MONEY) is enough; the send is recorded in the Activity log.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "VIEW_MONEY");
    const raw = await req.json().catch(() => ({}));
    const { childIds } = sendSchema.parse(raw ?? {});

    const preview = await reminderSendPreview(organizationId);
    if (!preview) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!childIds && preview.withEmailCount === 0) {
      return NextResponse.json(
        { error: "No parent with an outstanding balance has an email address on file." },
        { status: 400 }
      );
    }
    // The double-send guard is for "everyone" sends; a hand-picked list is deliberate.
    if (!childIds && preview.lastBulkReminderAt && Date.now() - preview.lastBulkReminderAt.getTime() < BULK_SEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Reminders were sent to everyone a few minutes ago. Wait 15 minutes before sending again." },
        { status: 429 }
      );
    }

    const result = await sendAllReminders(organizationId, { userId, trigger: "manual", childIds });
    if (childIds && result.sentCount === 0 && result.failedCount === 0) {
      return NextResponse.json(
        { error: "None of the selected parents has an email address on file (or they no longer owe anything)." },
        { status: 400 }
      );
    }
    return NextResponse.json({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
