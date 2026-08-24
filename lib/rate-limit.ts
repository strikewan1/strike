// In-memory token-bucket rate limiter.
// Per user, per endpoint category. Resets on process restart.
// In production replace with Redis/Upstash for cross-instance state.

type BucketKey = string;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<BucketKey, Bucket>();

/**
 * Test helper: clear all in-memory rate-limit buckets. Exported so
 * tests can call between cases to prevent pollution.
 */
export function __resetRateLimitsForTests() {
  buckets.clear();
}

interface LimitConfig {
  capacity: number; // max tokens
  refillPerMs: number; // tokens added per ms
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Sliding token-bucket rate limiter.
 *
 * @param key unique key (e.g. `recognize:${userId}`)
 * @param config capacity + refill rate
 */
export function checkRateLimit(
  key: BucketKey,
  config: LimitConfig,
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.lastRefill;
    const refilled = elapsed * config.refillPerMs;
    if (refilled > 0) {
      bucket.tokens = Math.min(
        config.capacity,
        bucket.tokens + refilled,
      );
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }

  const needed = 1 - bucket.tokens;
  const retryAfterMs = Math.ceil(needed / config.refillPerMs);
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
  };
}

// Convenience presets
export const LIMITS = {
  // 5 garment recognitions per minute. The previous 10/hour was too
  // generous — bulk upload of 50 items would take 5+ hours, AND each
  // recognize call costs 1-2 Gemini requests internally. With 5/min,
  // 50 items takes 10 min, well within Gemini's Tier-1 (360 RPM) and
  // the cooldown UI gives the user a clear "wait" signal.
  recognize: { capacity: 5, refillPerMs: 5 / (60 * 1000) },
  // 1 outfit generation per minute. Outfits are heavier requests and
  // are typically generated once per session — 1/min is plenty.
  outfit: { capacity: 1, refillPerMs: 1 / (60 * 1000) },
  // 20 reference analyses per hour
  reference: { capacity: 20, refillPerMs: 20 / (60 * 60 * 1000) },
  // 5 uploads per minute (signed URL requests) — 2 per garment
  // (original + cleaned) so 5 garments take 2 min
  upload: { capacity: 5, refillPerMs: 5 / (60 * 1000) },
} as const;

// Periodic cleanup to avoid memory bloat
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > STALE_THRESHOLD_MS) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export function rateLimitResponse(
  result: RateLimitResult,
): Response | null {
  if (result.allowed) return null;
  const seconds = Math.ceil((result.retryAfterMs ?? 1000) / 1000);
  return new Response(
    JSON.stringify({
      error: "Rate limit",
      message: `Demasiadas solicitudes. Probá en ${seconds}s.`,
      retryAfter: seconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(seconds),
      },
    },
  );
}
