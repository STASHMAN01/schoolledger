import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

const autoSchema = z.object({
  enabled: z.boolean(),
  days: z
    .array(z.number().int().min(1).max(28))
    .max(8, "Pick at most 8 days.")
    .transform((d) => Array.from(new Set(d)).sort((a, b) => a - b)),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "VIEW_MONEY");
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { autoRemindersEnabled: true, autoReminderDays: true, lastAutoReminderOn: true },
    });
    if (!org) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({
      enabled: org.autoRemindersEnabled,
      days: org.autoReminderDays,
      lastRunOn: org.lastAutoReminderOn,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "VIEW_MONEY");
    const body = autoSchema.parse(await req.json());
    if (body.enabled && body.days.length === 0) {
      return NextResponse.json({ error: "Pick at least one day of the month." }, { status: 400 });
    }
    const org = await db.organization.update({
      where: { id: organizationId },
      data: { autoRemindersEnabled: body.enabled, autoReminderDays: body.days },
      select: { autoRemindersEnabled: true, autoReminderDays: true, lastAutoReminderOn: true },
    });
    await logAudit({
      organizationId,
      userId,
      action: "reminders.autoSettingsUpdated",
      entityType: "Reminder",
      metadata: { enabled: org.autoRemindersEnabled, days: org.autoReminderDays },
    });
    return NextResponse.json({ enabled: org.autoRemindersEnabled, days: org.autoReminderDays, lastRunOn: org.lastAutoReminderOn });
  } catch (err) {
    return handleApiError(err);
  }
}
