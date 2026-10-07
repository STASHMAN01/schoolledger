import { db } from "@/lib/db";

// Rate limiter shared by every server instance (security review #4, 7 Oct
// 2026). The old version kept its counters in each serverless instance's
// memory, so an attacker spread across instances got many times the limit
// and every deploy reset the counts -- which mattered most for class-profile
// logins ("dees.butterfly") whose usernames are easy to guess.
//
// Counters now live in Postgres (`rate_limit_buckets`), updated with one
// atomic upsert per check, so concurrent requests can't both slip under the
// limit. Times are UTC, matching how Prisma stores DateTime columns.
// Keys are SHA-256 hashed before storage: they contain emails,
// usernames and IP addresses, and none of that needs to sit in the table.
//
// If the database can't be reached the check falls back to a per-instance
// in-memory counter rather than failing every login outright (a login
// needs the database anyway, so this only matters for a blip).

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();
let callsSincePrune = 0;

// The caller's IP for rate-limit keys (final inspection R9). On Vercel,
// x-real-ip / x-vercel-forwarded-for are set by the platform itself; the
// first x-forwarded-for entry is the fallback elsewhere.
export function clientIp(headers: Headers | { get(name: string): string | null } | undefined | null): string {
  if (!headers) return "unknown";
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// Web Crypto, not node:crypto: auth.ts imports this file and auth.ts is also
// bundled into the Edge middleware, where Node built-ins break every page.
export async function hashRateLimitKey(key: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type RateLimitResult = { allowed: boolean; remaining: number };

/** Pure decision from the post-increment count (exported for tests). */
export function decide(count: number, limit: number): RateLimitResult {
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const hashed = await hashRateLimitKey(key);
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limit_buckets" ("key", "count", "resetAt")
      VALUES (${hashed}, 1, (now() AT TIME ZONE 'UTC') + (${windowMs}::int * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limit_buckets"."resetAt" < (now() AT TIME ZONE 'UTC') THEN 1
                       ELSE "rate_limit_buckets"."count" + 1 END,
        "resetAt" = CASE WHEN "rate_limit_buckets"."resetAt" < (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt"
                         ELSE "rate_limit_buckets"."resetAt" END
      RETURNING "count"`;
    return decide(Number(rows[0]?.count ?? 1), limit);
  } catch (err) {
    console.error("[rateLimit] shared store unavailable, using in-memory fallback", err);
    return memoryRateLimit(hashed, { limit, windowMs });
  }
}

/**
 * Read-only check: has this key already reached `limit` in its current
 * window? Does not count as an attempt. Pair it with rateLimit() called
 * only on failures, so that successful logins never use up the allowance.
 */
export async function isOverLimit(key: string, limit: number): Promise<boolean> {
  const hashed = await hashRateLimitKey(key);
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      SELECT "count" FROM "rate_limit_buckets"
      WHERE "key" = ${hashed} AND "resetAt" >= (now() AT TIME ZONE 'UTC')`;
    return Number(rows[0]?.count ?? 0) >= limit;
  } catch (err) {
    console.error("[rateLimit] shared store unavailable for isOverLimit", err);
    const b = memoryBuckets.get(hashed);
    return Boolean(b && b.resetAt >= Date.now() && b.count >= limit);
  }
}

/** Forget a key's count, e.g. when an admin resets a locked-out password. */
export async function clearRateLimit(key: string): Promise<void> {
  const hashed = await hashRateLimitKey(key);
  memoryBuckets.delete(hashed);
  await db.rateLimitBucket.deleteMany({ where: { key: hashed } }).catch(() => undefined);
}

/** Per-instance fallback, also used directly by tests. */
export function memoryRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  if (++callsSincePrune >= 500) {
    callsSincePrune = 0;
    for (const [k, b] of memoryBuckets) if (b.resetAt < now) memoryBuckets.delete(k);
  }
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return decide(1, limit);
  }
  existing.count += 1;
  return decide(existing.count, limit);
}

/** Deletes expired counters. Called from the daily purge cron. */
export async function pruneRateLimitBuckets(): Promise<number> {
  const result = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return result.count;
}
