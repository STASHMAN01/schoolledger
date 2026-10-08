// Sends a push notification to the tablets/phones of a set of members.
// Used when an admin assigns a task, by the register alarm cron, and
// whenever a teacher logs something an admin would want to know about
// right away (an activity, an incident report). Quiet by design: if
// Firebase isn't configured, or nobody has the app installed, nothing
// happens and the caller carries on.
import { db } from "@/lib/db";
import { sendPush } from "@/lib/fcm";
import type { Role } from "@prisma/client";

export type TeacherPush = {
  title: string;
  body: string;
  /** Rings the loud alarm instead of a normal notification. */
  alarm?: boolean;
  /** Which page to open when it's tapped. */
  screen?: string;
};

async function sendToMembers(
  organizationId: string,
  where: { role: Role; assignedCategoryId?: string },
  message: TeacherPush,
  options: { exceptUserId?: string } = {}
): Promise<number> {
  const members = await db.membership.findMany({
    where: {
      organizationId,
      ...where,
      ...(options.exceptUserId ? { userId: { not: options.exceptUserId } } : {}),
    },
    select: { user: { select: { pushDevices: { select: { id: true, fcmToken: true } } } } },
  });

  let sent = 0;
  for (const m of members) {
    for (const device of m.user.pushDevices) {
      const result = await sendPush(device.fcmToken, message);
      if (result === "sent") sent++;
      // Firebase says the device uninstalled the app or the token moved on.
      if (result === "invalid-token") {
        await db.pushDevice.delete({ where: { id: device.id } }).catch(() => {});
      }
    }
  }
  return sent;
}

export async function notifyClassTeachers(
  organizationId: string,
  categoryId: string,
  message: TeacherPush,
  options: { exceptUserId?: string } = {}
): Promise<number> {
  return sendToMembers(organizationId, { role: "TEACHER", assignedCategoryId: categoryId }, message, options);
}

// Every ADMIN on the school, regardless of class -- e.g. a teacher logs
// today's activity, or files an incident report, and an admin should know
// without having to go looking. Keep notification text free of a specific
// child's name (it can show on a locked screen); the class/report type is
// enough to prompt opening the app for the detail.
export async function notifyOrgAdmins(
  organizationId: string,
  message: TeacherPush,
  options: { exceptUserId?: string } = {}
): Promise<number> {
  return sendToMembers(organizationId, { role: "ADMIN" }, message, options);
}
