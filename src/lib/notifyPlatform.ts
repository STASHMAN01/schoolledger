// Pushes to the platform owner's own tablet/phone -- Dylan, not any
// school's admin (Dylan, 8 Oct 2026: "notification for a new sign up on
// the app (this is only me)", "custom notification sound for when someone
// pays... this sound is specifically for me for when i get a sale").
//
// Deliberately separate from notifyTeachers.ts's org-scoped helpers: this
// has nothing to do with any one organization's Membership, same
// separation of concerns as requirePlatformAdmin() vs requireMembership().
// Quiet by design: if Firebase isn't configured, or the owner hasn't
// opened the app on a device yet, nothing happens.
import { db } from "@/lib/db";
import { sendPush } from "@/lib/fcm";
import { ownerEmails } from "@/lib/platformAdmin";

export type PlatformPush = { title: string; body: string; screen?: string; sale?: boolean };

export async function notifyPlatformAdmins(message: PlatformPush): Promise<number> {
  const emails = ownerEmails();
  const admins = await db.user.findMany({
    where: { OR: [{ isPlatformAdmin: true }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
    select: { pushDevices: { select: { id: true, fcmToken: true } } },
  });

  let sent = 0;
  for (const admin of admins) {
    for (const device of admin.pushDevices) {
      const result = await sendPush(device.fcmToken, {
        title: message.title,
        body: message.body,
        screen: message.screen ?? "todos",
        ...(message.sale ? { channel: "sales" as const } : {}),
      });
      if (result === "sent") sent++;
      if (result === "invalid-token") {
        await db.pushDevice.delete({ where: { id: device.id } }).catch(() => {});
      }
    }
  }
  return sent;
}
