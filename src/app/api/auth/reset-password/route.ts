import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { hashInviteToken } from "@/lib/inviteToken";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiError";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
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

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          // Bump tokenVersion so any other signed-in session (e.g. an
          // attacker who had gotten hold of a valid session) is logged
          // out immediately — see the jwt callback in src/lib/auth.ts.
          tokenVersion: { increment: 1 },
        },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Any other still-pending reset tokens for this user are now moot —
      // close them out so a stale, previously-requested link can't also
      // be used right after this one.
      db.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
