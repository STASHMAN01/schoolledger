import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { clearRateLimit } from "@/lib/rateLimit";
import { hashPassword, isPasswordBreached, BREACHED_PASSWORD_MESSAGE } from "@/lib/password";
import { resetProfilePasswordSchema } from "@/lib/profiles";

type Params = { params: Promise<{ organizationId: string; membershipId: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset-password"), password: z.string() }),
  z.object({ action: z.literal("sign-out") }),
]);

// Only ever acts on a class profile in this school -- never on a normal
// email account, so this can't become a way to reset a colleague's password.
async function findProfile(organizationId: string, membershipId: string) {
  return db.membership.findFirst({
    where: { id: membershipId, organizationId, user: { isProfile: true } },
    include: { user: { select: { id: true, name: true, username: true } } },
  });
}

// Reset a profile's password, or sign it out on every tablet. Both bump
// tokenVersion, which ends every existing session for that profile.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, membershipId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_TEAM");

    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const body = parsed.data;

    const profile = await findProfile(organizationId, membershipId);
    if (!profile) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (body.action === "reset-password") {
      const pw = resetProfilePasswordSchema.safeParse({ password: body.password });
      if (!pw.success) {
        return NextResponse.json(
          { error: pw.error.issues[0]?.message ?? "Invalid password." },
          { status: 400 }
        );
      }
      if (await isPasswordBreached(pw.data.password)) {
        return NextResponse.json({ error: BREACHED_PASSWORD_MESSAGE }, { status: 400 });
      }
      await db.user.update({
        where: { id: profile.user.id },
        data: { passwordHash: await hashPassword(pw.data.password), tokenVersion: { increment: 1 } },
      });
      // A new password also lifts a lockout from failed tries (security review #22).
      if (profile.user.username) {
        await clearRateLimit(`login-failed-day:username:${profile.user.username}`);
        await clearRateLimit(`login:username:${profile.user.username}`);
      }
    } else {
      await db.user.update({
        where: { id: profile.user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    }

    await logAudit({
      organizationId,
      userId,
      action: body.action === "reset-password" ? "profile.passwordReset" : "profile.signedOut",
      entityType: "Membership",
      entityId: membershipId,
      metadata: { profileName: profile.user.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Remove a profile. The user row is kept (attendance, reports and the
// activity log still point at it) but it can never log in again: its
// membership goes, its sessions end, its password becomes unguessable and
// its username is freed for reuse.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, membershipId } = await params;
    const { userId } = await requireMembership(organizationId, "MANAGE_TEAM");

    const profile = await findProfile(organizationId, membershipId);
    if (!profile) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const lockedHash = await hashPassword(randomBytes(32).toString("hex"));
    await db.$transaction([
      db.membership.delete({ where: { id: profile.id } }),
      db.user.update({
        where: { id: profile.user.id },
        data: { username: null, passwordHash: lockedHash, tokenVersion: { increment: 1 } },
      }),
    ]);

    await logAudit({
      organizationId,
      userId,
      action: "profile.removed",
      entityType: "Membership",
      entityId: membershipId,
      metadata: { profileName: profile.user.name, username: profile.user.username },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
