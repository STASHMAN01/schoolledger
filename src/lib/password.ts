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
