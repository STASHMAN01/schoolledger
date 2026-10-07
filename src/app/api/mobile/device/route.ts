import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiError";
import { mobileDeviceFromRequest } from "@/lib/mobileAuth";

const bodySchema = z.object({ fcmToken: z.string().trim().min(20).max(4096) });

// The app tells the server where to send push notifications (its Firebase
// token). Sent again whenever Firebase issues a new one.
export async function PUT(req: Request) {
  try {
    const device = await mobileDeviceFromRequest();
    if (!device) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A valid push token is required." }, { status: 400 });
    // One token belongs to one device row; clear it from any older sign-in.
    await db.mobileDevice.updateMany({
      where: { fcmToken: parsed.data.fcmToken, NOT: { id: device.id } },
      data: { fcmToken: null },
    });
    await db.mobileDevice.update({ where: { id: device.id }, data: { fcmToken: parsed.data.fcmToken } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Sign out: removes this device's sign-in so the token stops working.
export async function DELETE() {
  try {
    const device = await mobileDeviceFromRequest();
    if (!device) return NextResponse.json({ ok: true });
    await db.mobileDevice.delete({ where: { id: device.id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
