import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import { encryptField } from "@/lib/fieldCrypto";
import { generateTotpSecret, otpauthUri } from "@/lib/totp";

// Start two-factor set-up for a platform admin (security review #5).
// Creates a fresh authenticator secret and returns it once, as a QR code
// and as text. It only counts once confirmed with a code (verify route).
// Refused once two-factor is on: a lost phone is reset by clearing the
// user's totp columns in the database, never through the web, so a stolen
// password can't be used to enrol the attacker's own phone.
export async function POST() {
  try {
    const admin = await requirePlatformAdmin({ skipSecondFactor: true });
    if (admin.totpEnabled) {
      return NextResponse.json({ error: "Two-factor is already set up." }, { status: 409 });
    }

    const secret = generateTotpSecret();
    await db.user.update({
      where: { id: admin.userId },
      data: { totpSecret: encryptField(secret), totpEnabledAt: null, totpLastStep: null },
    });

    const uri = otpauthUri(secret, admin.email ?? admin.userId);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return NextResponse.json(
      { secret, qrDataUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
