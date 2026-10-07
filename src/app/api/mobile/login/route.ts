import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { emailSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiError";
import { mobileExpiry, newMobileToken, hashMobileToken } from "@/lib/mobileAuth";

const bodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  deviceName: z.string().trim().min(1).max(100).default("Android device"),
});

// Sign in from the Android app. Same rate limits and the same single
// generic failure message as the website login, so it can't be used to find
// out which emails have accounts. Returns a token the app keeps and sends as
// `Authorization: Bearer ...`; only its hash is stored (MobileDevice).
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    const fail = () => NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    if (!parsed.success) return fail();
    const { email, password, deviceName } = parsed.data;

    const ip = clientIp(req.headers);
    const byEmail = rateLimit(`login:email:${email}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    const byIp = rateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!byEmail.allowed || !byIp.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return fail();
    if (!user.emailVerified) {
      return NextResponse.json({ error: "Please verify your email first, using the link we sent you." }, { status: 403 });
    }

    const token = newMobileToken();
    await db.mobileDevice.create({
      data: {
        userId: user.id,
        tokenHash: hashMobileToken(token),
        tokenVersion: user.tokenVersion,
        deviceName,
        expiresAt: mobileExpiry(),
      },
    });

    return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    return handleApiError(err);
  }
}
