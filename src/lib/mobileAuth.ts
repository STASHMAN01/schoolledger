import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

// Sign-in for the Android app (7 Oct 2026). The website uses a cookie; the
// app sends `Authorization: Bearer <token>` instead. The token is random,
// shown to the app once, and only its hash is stored (MobileDevice).

// Long on purpose: a teacher shouldn't re-enter a password every morning.
// It slides forward each time the app is used, and "log out everywhere"
// (User.tokenVersion) or removing the device cuts it off at once.
export const MOBILE_SESSION_DAYS = 60;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export function hashMobileToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newMobileToken(): string {
  return randomBytes(32).toString("base64url");
}

export function mobileExpiry(from = new Date()): Date {
  return new Date(from.getTime() + MOBILE_SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export function bearerToken(authorization: string | null | undefined): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,128})$/.exec(authorization ?? "");
  return m ? m[1] : null;
}

/** The signed-in device for this request, or null. */
export async function mobileDeviceFromRequest(): Promise<{ id: string; userId: string } | null> {
  const token = bearerToken((await headers()).get("authorization"));
  if (!token) return null;
  const device = await db.mobileDevice.findUnique({
    where: { tokenHash: hashMobileToken(token) },
    include: { user: { select: { tokenVersion: true } } },
  });
  if (!device || device.expiresAt < new Date()) return null;
  if (device.user.tokenVersion !== device.tokenVersion) return null;
  // Slide the expiry forward at most once a day.
  if (Date.now() - device.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.mobileDevice
      .update({ where: { id: device.id }, data: { lastSeenAt: new Date(), expiresAt: mobileExpiry() } })
      .catch(() => {});
  }
  return { id: device.id, userId: device.userId };
}
