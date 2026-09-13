// Minimal in-memory rate limiter for auth-adjacent endpoints (login,
// registration, invite-accept). This is a stopgap suitable for a single
// server instance / low volume; it resets on deploy and does not share
// state across serverless instances.
//
// BEFORE relying on this in production behind more than one server
// instance, replace with a shared store (e.g. Upstash Redis rate limiting,
// or your DB) — see SECURITY.md, "Before onboarding real customer data".
// Left simple on purpose so an early, single-instance deploy still has
// *some* brute-force protection rather than none.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count };
}

// Call periodically-ish (e.g. on each invocation) to avoid unbounded growth.
export function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
