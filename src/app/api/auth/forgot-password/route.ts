import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendMail } from "@/lib/mail";
import { handleApiError } from "@/lib/apiError";

const RESET_EXPIRY_MINUTES = 60;

// Always returns the same generic success response, whether or not the
// email belongs to a real account — never confirm/deny an email's
// existence to whoever is asking (that's exactly the enumeration attack
// this kind of endpoint is normally used for).
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    // Two layers: per-IP (stop one client hammering arbitrary emails) and
    // per-email below (stop repeated resets/emails to one target).
    const { allowed } = rateLimit(`forgot-password-ip:${ip}`, {
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
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const { email } = parsed.data;

    const genericResponse = NextResponse.json({
      message: "If an account exists for that email, a reset link has been sent.",
    });

    const { allowed: emailAllowed } = rateLimit(`forgot-password-email:${email}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!emailAllowed) {
      // Still generic — don't reveal that this specific email was rate
      // limited (that alone would confirm the account exists).
      return genericResponse;
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return genericResponse;
    }

    const { token, tokenHash } = generateInviteToken();
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    const resetUrl = `${req.nextUrl.origin}/reset-password/${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your Crechely password",
      text: `We got a request to reset your Crechely password. This link works once and expires in ${RESET_EXPIRY_MINUTES} minutes:\n\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email — your password hasn't been changed.`,
      html: `
        <p>We got a request to reset your Crechely password.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p style="color:#666;font-size:13px">This link works once and expires in ${RESET_EXPIRY_MINUTES} minutes. If you didn't ask for this, you can ignore this email — your password hasn't been changed.</p>
      `,
    });

    return genericResponse;
  } catch (err) {
    return handleApiError(err);
  }
}
