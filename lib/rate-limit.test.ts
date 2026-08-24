/**
 * Tests for the per-user rate limit presets. These guard Gemini's
 * per-minute quota by throttling how often the user can call our AI
 * endpoints. If the in-app limits are too generous, the user can
 * burn through Gemini's 360 RPM Tier-1 budget on a single upload
 * burst.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  LIMITS,
  checkRateLimit,
  rateLimitResponse,
  __resetRateLimitsForTests,
} from "@/lib/rate-limit";

beforeEach(() => {
  __resetRateLimitsForTests();
});

describe("rate limit presets", () => {
  it("recognize is throttled to 5/min (was 10/hour)", () => {
    const bucket = LIMITS.recognize;
    // 5/min = 1 token every 12s
    expect(bucket.capacity).toBe(5);
    expect(bucket.refillPerMs).toBeCloseTo(5 / 60_000, 6);
  });

  it("outfit is throttled to 1/min", () => {
    const bucket = LIMITS.outfit;
    expect(bucket.capacity).toBe(1);
    expect(bucket.refillPerMs).toBeCloseTo(1 / 60_000, 6);
  });

  it("upload is throttled to 5/min", () => {
    const bucket = LIMITS.upload;
    expect(bucket.capacity).toBe(5);
    expect(bucket.refillPerMs).toBeCloseTo(5 / 60_000, 6);
  });
});

describe("checkRateLimit — token bucket semantics", () => {
  it("allows up to N requests then blocks", () => {
    const cfg = { capacity: 3, refillPerMs: 1 }; // 1 token per ms
    const key = "rl-test-1";
    // Drain the bucket
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(key, cfg);
      expect(r.allowed).toBe(true);
    }
    // 4th call should be blocked
    const r = checkRateLimit(key, cfg);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("keys are isolated (different users have separate buckets)", () => {
    const cfg = { capacity: 2, refillPerMs: 0 };
    const a = "rl-test-2-a";
    const b = "rl-test-2-b";
    checkRateLimit(a, cfg);
    checkRateLimit(a, cfg);
    expect(checkRateLimit(a, cfg).allowed).toBe(false);
    // user-b should be unaffected
    expect(checkRateLimit(b, cfg).allowed).toBe(true);
  });
});

describe("rateLimitResponse — 429 surface", () => {
  it("returns null when allowed", () => {
    const r = checkRateLimit("rl-test-3", {
      capacity: 5,
      refillPerMs: 1,
    });
    expect(rateLimitResponse(r)).toBeNull();
  });

  it("returns 429 with retryAfter when blocked", async () => {
    // Use a tiny but non-zero refillPerMs so retryAfterMs is finite.
    const cfg = { capacity: 1, refillPerMs: 1 };
    const key = "rl-test-4";
    checkRateLimit(key, cfg);
    const r = checkRateLimit(key, cfg);
    const res = rateLimitResponse(r);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const text = await res!.text();
    const body = JSON.parse(text);
    expect(body.error).toBe("Rate limit");
    expect(typeof body.retryAfter).toBe("number");
    expect(body.retryAfter).toBeGreaterThanOrEqual(0);
    expect(res!.headers.get("Retry-After")).toBeDefined();
  });
});
