import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing/access";
import { schoolClock, schoolDateValue, isSummaryDue } from "@/lib/dailySummary";
import { CLASSWORK_REMINDER_HOUR } from "@/lib/lessonPlan";
import { sendPush } from "@/lib/fcm";

// Weekday afternoons (vercel.json "crons", 13:30 UTC = 15:30 in South
// Africa -- after both this school's classwork due-hour, 15:00, and its
// daily-report due-hour, 12:00). Dylan, 8 Oct 2026: "these are the things
// that are non negotiable for to do list everyday -- take attendence,
// record todays activity, daily report". Attendance already gets its own
// morning alarm (see /api/cron/todo-alerts); this is the afternoon nudge
// for the other two, one push per teacher per still-outstanding item. Same
// CRON_SECRET guard as the other crons.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const members = await db.membership.findMany({
    where: {
      role: "TEACHER",
      assignedCategoryId: { not: null },
      organization: { deletedAt: null },
      user: { pushDevices: { some: {} } },
    },
    select: {
      assignedCategoryId: true,
      organization: {
        select: { id: true, timezone: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
      },
      user: { select: { pushDevices: { select: { id: true, fcmToken: true } } } },
    },
  });

  let sent = 0;
  let skipped = 0;
  for (const m of members) {
    if (!hasActiveAccess(m.organization) || !m.assignedCategoryId) {
      skipped++;
      continue;
    }
    const clock = schoolClock(m.organization.timezone ?? "Africa/Johannesburg");
    if (clock.weekday > 5) {
      skipped++;
      continue;
    }
    const date = schoolDateValue(clock.date);

    const missing: { title: string; body: string; screen: string }[] = [];

    if (clock.minutes >= CLASSWORK_REMINDER_HOUR * 60) {
      const recorded = await db.classworkEntry.count({
        where: { categoryId: m.assignedCategoryId, date },
      });
      if (recorded === 0) {
        missing.push({
          title: "Record today's activity",
          body: "You haven't recorded what your class did today yet.",
          screen: "classwork",
        });
      }
    }

    if (isSummaryDue(clock)) {
      const sentSummary = await db.dailySummary.findUnique({
        where: { categoryId_date: { categoryId: m.assignedCategoryId, date } },
        select: { id: true },
      });
      if (!sentSummary) {
        missing.push({
          title: "Send today's daily report",
          body: "Today's daily report hasn't been sent yet.",
          screen: "daily-summary",
        });
      }
    }

    if (missing.length === 0) {
      skipped++;
      continue;
    }

    for (const item of missing) {
      for (const device of m.user.pushDevices) {
        const result = await sendPush(device.fcmToken, { ...item, alarm: true });
        if (result === "sent") sent++;
        if (result === "invalid-token") {
          await db.pushDevice.delete({ where: { id: device.id } }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ teachers: members.length, sent, skipped });
}
