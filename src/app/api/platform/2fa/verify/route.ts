import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";
import { decryptField } from "@/lib/fieldCrypto";
import { verifyTotp } from "@/lib/totp";
import { rateLimit } from "@/lib/rateLimit";
import { setStepUpCookie } from "@/lib/platformTwoFactor";

const bodySchema = z.object({ code: z.string().trim().min(6).max(10) });

// Check a 6-digit authenticator code for a platform admin (security review
// #5). The first correct code also switches two-factor on. Success sets the
// signed cookie that opens /platform for this session (12 hours).
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePlatformAdmin({ skipSecondFactor: true });

    const quota = await rateLimit(`platform-2fa:${admin.userId}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!quota.allowed) {
      return NextResponse.json({ error: "Too many tries. Wait 15 minutes." }, { status: 429 });
    }

    const { code } = bodySchema.parse(await req.json().catch(() => null));
    const user = await db.user.findUnique({
      where: { id: admin.userId },
      select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true, tokenVersion: true },
    });
    if (!user?.totpSecret) {
      return NextResponse.json({ error: "Set up two-factor first." }, { status: 400 });
    }

    const step = verifyTotp(decryptField(user.totpSecret), code);
    // Each code works once, even inside its 30-second window.
    if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) {
      return NextResponse.json({ error: "That code isn't right. Check your app and try again." }, { status: 400 });
    }

    // Conditional update so two simultaneous submits of one code can't both pass.
    const updated = await db.user.updateMany({
      where: {
        id: admin.userId,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step, totpEnabledAt: user.totpEnabledAt ?? new Date() },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "That code was already used. Wait for the next one." }, { status: 400 });
    }

    await setStepUpCookie(admin.userId, user.tokenVersion);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
