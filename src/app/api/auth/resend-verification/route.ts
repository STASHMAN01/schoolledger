import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resendVerificationSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { issueAndSendVerificationEmail } from "@/lib/emailVerification";
import { handleApiError } from "@/lib/apiError";

// Same generic-response, two-tier-rate-limited shape as
// POST /api/auth/forgot-password -- never confirm/deny whether an email
// has an account, or whether it's already verified, via a distinct
// response. Used both by the post-register "check your email" screen and
// the dashboard's "verify your email" gate, both of which already know
// the account's own email address (from the session or the just-completed
// registration), so this never needs a signed-in caller.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const { allowed } = rateLimit(`resend-verification-ip:${ip}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const { email } = parsed.data;

    const genericResponse = NextResponse.json({
      message: "If that account needs verifying, a new link has been sent.",
    });

    const { allowed: emailAllowed } = rateLimit(`resend-verification-email:${email}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!emailAllowed) {
      return genericResponse;
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return genericResponse;
    }

    await issueAndSendVerificationEmail(
      { id: user.id, email: user.email, name: user.name },
      req.nextUrl.origin
    );

    return genericResponse;
  } catch (err) {
    return handleApiError(err);
  }
}
