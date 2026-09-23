import { db } from "@/lib/db";
import { decryptField, encryptField } from "@/lib/fieldCrypto";
import { generateInviteToken } from "@/lib/inviteToken";

// The school's permanent public "apply" link for NEW families (fix session
// B, Dylan 23 Sept). Unlike the one-time per-child links, the token is kept
// (encrypted) so staff can copy the link again at any time; lookups use
// only the hash. Regenerating replaces the token and kills the old link.

export function publicBaseUrl(fallbackOrigin: string): string {
  // AUTH_URL is the configured public site address -- preferred over the
  // request's Host header, which a caller controls (final inspection R11).
  return (process.env.AUTH_URL ?? fallbackOrigin).replace(/\/+$/, "");
}

export function applyUrl(base: string, token: string): string {
  return `${base}/apply/school/${token}`;
}

/** The current link's token, or null if none was ever created (or it can't be decrypted). */
export async function getApplyToken(organizationId: string): Promise<string | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { applyToken: true },
  });
  if (!org?.applyToken) return null;
  try {
    return decryptField(org.applyToken);
  } catch {
    return null;
  }
}

/** Creates a new token (replacing any old one) and returns it. */
export async function regenerateApplyToken(organizationId: string): Promise<string> {
  const { token, tokenHash } = generateInviteToken();
  await db.organization.update({
    where: { id: organizationId },
    data: { applyToken: encryptField(token), applyTokenHash: tokenHash },
  });
  return token;
}
