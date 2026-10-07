import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing/access";
import { saDateParts } from "@/lib/autoReminders";
import { sendPush } from "@/lib/fcm";

// Weekday mornings (vercel.json "crons", 06:30 UTC = 08:30 in South Africa).
// Pushes an alarm to each teacher's tablet if their class's register hasn't
// been taken yet today. Same CRON_SECRET guard as the other crons. Alerts
// for more to-do items can be added here later.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { isoDate } = saDateParts(new Date());
  const today = new Date(isoDate); // date-only, midnight UTC, like AttendanceRecord.date

  const members = await db.membership.findMany({
    where: {
      role: "TEACHER",
      assignedCategoryId: { not: null },
      organization: { deletedAt: null },
      user: { mobileDevices: { some: { fcmToken: { not: null }, expiresAt: { gt: new Date() } } } },
    },
    select: {
      userId: true,
      assignedCategoryId: true,
      organization: {
        select: { id: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
      },
      user: {
        select: { mobileDevices: { where: { fcmToken: { not: null } }, select: { id: true, fcmToken: true } } },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  for (const m of members) {
    if (!hasActiveAccess(m.organization) || !m.assignedCategoryId) {
      skipped++;
      continue;
    }
    const [enrolled, marked, category] = await Promise.all([
      db.child.count({
        where: {
          organizationId: m.organization.id,
          categoryId: m.assignedCategoryId,
          archived: false,
          deletedAt: null,
          exitDate: null,
        },
      }),
      db.attendanceRecord.count({
        where: { organizationId: m.organization.id, date: today, child: { categoryId: m.assignedCategoryId } },
      }),
      db.category.findUnique({ where: { id: m.assignedCategoryId }, select: { name: true } }),
    ]);
    if (enrolled === 0 || marked >= enrolled) {
      skipped++;
      continue;
    }
    for (const device of m.user.mobileDevices) {
      if (!device.fcmToken) continue;
      const result = await sendPush(device.fcmToken, {
        title: "Take the register",
        body: `${category?.name ?? "Your class"}: ${enrolled - marked} of ${enrolled} children not marked yet.`,
        alarm: true,
        screen: "attendance",
      });
      if (result === "sent") sent++;
      if (result === "invalid-token") {
        await db.mobileDevice.update({ where: { id: device.id }, data: { fcmToken: null } }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ date: isoDate, teachers: members.length, sent, skipped });
}
