// Sends a push notification to the tablets of the teachers assigned to one
// class. Used when an admin assigns a task and by the register alarm cron.
// Quiet by design: if Firebase isn't configured, or nobody has the app
// installed, nothing happens and the caller carries on.
import { db } from "@/lib/db";
import { sendPush } from "@/lib/fcm";

export type TeacherPush = {
  title: string;
  body: string;
  /** Rings the loud alarm instead of a normal notification. */
  alarm?: boolean;
  /** Which page to open when it's tapped. */
  screen?: string;
};

export async function notifyClassTeachers(
  organizationId: string,
  categoryId: string,
  message: TeacherPush,
  options: { exceptUserId?: string } = {}
): Promise<number> {
  const teachers = await db.membership.findMany({
    where: {
      organizationId,
      role: "TEACHER",
      assignedCategoryId: categoryId,
      ...(options.exceptUserId ? { userId: { not: options.exceptUserId } } : {}),
    },
    select: { user: { select: { pushDevices: { select: { id: true, fcmToken: true } } } } },
  });

  let sent = 0;
  for (const t of teachers) {
    for (const device of t.user.pushDevices) {
      const result = await sendPush(device.fcmToken, message);
      if (result === "sent") sent++;
      // Firebase says the tablet uninstalled the app or the token moved on.
      if (result === "invalid-token") {
        await db.pushDevice.delete({ where: { id: device.id } }).catch(() => {});
      }
    }
  }
  return sent;
}
