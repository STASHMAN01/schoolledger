import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";

const putSchema = z.object({
  fcmToken: z.string().trim().min(20).max(4096),
  deviceName: z.string().trim().max(120).optional(),
});
const deleteSchema = z.object({ fcmToken: z.string().trim().min(20).max(4096) });

// The Android app tells the server where to send push notifications (its
// Firebase token). Uses the normal website sign-in. The token belongs to
// whoever signed in last on that device.
export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const parsed = putSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A valid push token is required." }, { status: 400 });
    const deviceName = parsed.data.deviceName || "Android tablet";
    await db.pushDevice.upsert({
      where: { fcmToken: parsed.data.fcmToken },
      create: { userId, fcmToken: parsed.data.fcmToken, deviceName },
      update: { userId, deviceName, lastSeenAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Removes a device token (used when the app signs out).
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ ok: true });
    const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: true });
    await db.pushDevice.deleteMany({ where: { fcmToken: parsed.data.fcmToken, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
