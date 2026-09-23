import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { hashInviteToken } from "@/lib/inviteToken";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiError";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const { allowed } = rateLimit(`reset-password:${ip}`, {
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
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;
    const tokenHash = hashInviteToken(token);

    const resetToken = await db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Claim the token first, atomically: only the request that flips
    // usedAt from null wins, so two simultaneous submits of the same link
    // can't both reset the password (final inspection R12).
    const claimed = await db.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claim.count === 0) return false;
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          // Bump tokenVersion so any other signed-in session (e.g. an
          // attacker who had gotten hold of a valid session) is logged
          // out immediately — see the jwt callback in src/lib/auth.ts.
          tokenVersion: { increment: 1 },
        },
      });
      // Any other still-pending reset tokens for this user are now moot —
      // close them out so a stale, previously-requested link can't also
      // be used right after this one.
      await tx.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    });
    if (!claimed) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
