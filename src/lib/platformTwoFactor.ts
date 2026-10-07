import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// The "passed two-factor" marker for the /platform area (security review
// #5). After a platform admin enters a valid authenticator code, the server
// sets this signed, httpOnly cookie. requirePlatformAdmin() refuses every
// platform API call without it, and the platform layout sends the browser
// to /platform-verify instead.
//
// Value: userId.tokenVersion.expiresAtMs.signature, HMAC-SHA256 keyed with
// AUTH_SECRET. Binding tokenVersion means "log out everywhere" (password
// change etc.) also voids the cookie; binding userId means it is useless to
// anyone else who signs in on the same browser.

export const PLATFORM_2FA_COOKIE = "crechely_platform_2fa";
const VALID_MS = 12 * 60 * 60 * 1000; // same as the session

function key(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(`platform-2fa:${payload}`).digest("base64url");
}

export function makeStepUpValue(userId: string, tokenVersion: number, nowMs = Date.now()): string {
  const payload = `${userId}.${tokenVersion}.${nowMs + VALID_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidStepUpValue(
  value: string | undefined,
  userId: string,
  tokenVersion: number,
  nowMs = Date.now()
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [uid, version, expires, signature] = parts;
  const expected = sign(`${uid}.${version}.${expires}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return uid === userId && Number(version) === tokenVersion && Number(expires) > nowMs;
}

export async function hasPassedStepUp(userId: string, tokenVersion: number): Promise<boolean> {
  const jar = await cookies();
  return isValidStepUpValue(jar.get(PLATFORM_2FA_COOKIE)?.value, userId, tokenVersion);
}

export async function setStepUpCookie(userId: string, tokenVersion: number): Promise<void> {
  const jar = await cookies();
  jar.set(PLATFORM_2FA_COOKIE, makeStepUpValue(userId, tokenVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: VALID_MS / 1000,
  });
}
