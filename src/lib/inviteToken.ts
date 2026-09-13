import { randomBytes, createHash } from "crypto";

/**
 * Same pattern as a password-reset token: the raw token is shown to the
 * admin exactly once (in the invite link) and never stored; only its
 * SHA-256 hash is persisted. A leaked database dump then hands out no
 * usable invite links, the same way a leaked user table hands out no
 * usable passwords.
 */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
