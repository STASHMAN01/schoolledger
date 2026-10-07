import bcrypt from "bcryptjs";

// Cost factor 12: a deliberate middle ground — high enough to make offline
// cracking of a leaked hash slow, low enough not to make login noticeably
// slow on typical serverless hardware. Revisit upward every couple of years
// as hardware gets faster.
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Minimum bar for a password, enforced server-side (never trust a
// client-side-only check). Not a substitute for encouraging a password
// manager, but stops "123456"-class passwords on a product that stores
// children's personal and financial data.
export function isPasswordStrongEnough(plain: string): boolean {
  return plain.length >= 10;
}

// Has this exact password appeared in a known data breach? (security review
// #13, 7 Oct 2026). Uses Have I Been Pwned's k-anonymity range API: only
// the first 5 characters of the password's SHA-1 hash ever leave the
// server, never the password. Fails open (returns false) if the service is
// slow or down, so it can never block a sign-up on its own.
export async function isPasswordBreached(plain: string): Promise<boolean> {
  try {
    const digest = await globalThis.crypto.subtle.digest("SHA-1", new TextEncoder().encode(plain));
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export const BREACHED_PASSWORD_MESSAGE =
  "That password has appeared in a known data breach, so it's easy for attackers to guess. Please choose a different one.";
