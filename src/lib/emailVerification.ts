import { db } from "@/lib/db";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendMail } from "@/lib/mail";
import { publicBaseUrl } from "@/lib/applyLink";

export const VERIFY_EXPIRY_HOURS = 48;

/**
 * Issues a fresh email-verification link for a user and sends it. Shared by
 * registration (first link) and the resend endpoint (a replacement link).
 * Closes out any of that user's still-pending verification tokens first,
 * same reasoning as reset-password: only ever one live link per user, so
 * an old email sitting in an inbox can't be used after a newer one was
 * requested.
 */
export async function issueAndSendVerificationEmail(
  user: { id: string; email: string; name: string },
  originForFallback: string
) {
  await db.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = generateInviteToken();
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${publicBaseUrl(originForFallback)}/verify-email/${token}`;

  await sendMail({
    to: user.email,
    subject: "Verify your email for Crechely",
    text: `Hi ${user.name},\n\nOne last step to finish setting up your school: confirm this is a real, working email address by clicking the link below. This link works once and expires in ${VERIFY_EXPIRY_HOURS} hours:\n\n${verifyUrl}\n\nIf you didn't create a Crechely account, you can ignore this email.`,
    html: `
      <p>Hi ${user.name},</p>
      <p>One last step to finish setting up your school: confirm this is a real, working email address.</p>
      <p><a href="${verifyUrl}">Verify your email</a></p>
      <p style="color:#666;font-size:13px">This link works once and expires in ${VERIFY_EXPIRY_HOURS} hours. If you didn't create a Crechely account, you can ignore this email.</p>
    `,
  });
}
