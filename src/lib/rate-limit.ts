import "server-only";

/**
 * A deliberately small in-memory rate limiter.
 *
 * This demo exposes two routes that spend money on a paid API, on a public URL
 * that will be handed to a prospect. Shipping that without a ceiling would be
 * careless — one open tab with a loop in the console could run up a bill.
 *
 * In-memory means it resets on deploy and does not coordinate across instances.
 * That is an accepted limitation for a single-instance demo, and the wrong choice
 * for production: a real deployment wants Redis or the platform's own limiter.
 * Stated here rather than discovered later.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Reap expired buckets so a long-running instance doesn't grow unbounded. */
function sweep(now: number) {
  if (buckets.size < 512) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client key. Behind Railway's proxy the useful value is the first
 * hop in x-forwarded-for; everything else is a fallback so a missing header can
 * never mean "unlimited".
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}
