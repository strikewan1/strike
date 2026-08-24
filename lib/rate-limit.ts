// In-memory token-bucket rate limiter.
// Per user, per endpoint category. Resets on process restart.
// In production replace with Redis/Upstash for cross-instance state.

type BucketKey = string;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<BucketKey, Bucket>();

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
  // 10 garment recognitions per hour
  recognize: { capacity: 10, refillPerMs: 10 / (60 * 60 * 1000) },
  // 3 outfit generations per minute — leaves headroom for Gemini's
  // 360 RPM Tier-1 limit when multiple retries per request are
  // accounted for.
  outfit: { capacity: 3, refillPerMs: 3 / (60 * 1000) },
  // 20 reference analyses per hour
  reference: { capacity: 20, refillPerMs: 20 / (60 * 60 * 1000) },
  // 10 uploads per minute (signed URL requests)
  upload: { capacity: 10, refillPerMs: 10 / (60 * 1000) },
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
