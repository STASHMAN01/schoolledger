import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing/access";
import { sendAllReminders } from "@/lib/reminderSendAll";
import { saDateParts } from "@/lib/autoReminders";

// Daily (vercel.json "crons", 05:00 UTC = 07:00 in South Africa). Emails
// every parent who owes money at each school that turned on automatic
// reminders for today's day of the month. Same CRON_SECRET guard as the
// purge cron. lastAutoReminderOn makes a retried run a no-op for the day.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { isoDate, day } = saDateParts(new Date());
  const orgs = await db.organization.findMany({
    where: {
      autoRemindersEnabled: true,
      autoReminderDays: { has: day },
      deletedAt: null,
      NOT: { lastAutoReminderOn: isoDate },
    },
    select: { id: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
  });

  const summary: { organizationId: string; sent?: number; failed?: number; skipped?: string }[] = [];
  for (const org of orgs) {
    if (!hasActiveAccess(org)) {
      summary.push({ organizationId: org.id, skipped: "no active subscription" });
      continue;
    }
    // Claim the day first so a retried or overlapping run never sends twice.
    const claimed = await db.organization.updateMany({
      where: { id: org.id, NOT: { lastAutoReminderOn: isoDate } },
      data: { lastAutoReminderOn: isoDate },
    });
    if (claimed.count === 0) continue;
    try {
      const r = await sendAllReminders(org.id, { userId: null, trigger: "automatic" });
      summary.push({ organizationId: org.id, sent: r.sentCount, failed: r.failedCount });
    } catch (err) {
      console.error("[auto-reminders] failed for", org.id, err);
      summary.push({ organizationId: org.id, skipped: "error" });
    }
  }

  return NextResponse.json({ date: isoDate, schools: summary.length, summary });
}
