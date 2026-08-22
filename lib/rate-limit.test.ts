import { describe, it, expect } from "vitest";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to capacity", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const cfg = { capacity: 3, refillPerMs: 0 };
    expect(checkRateLimit(key, cfg).allowed).toBe(true);
    expect(checkRateLimit(key, cfg).allowed).toBe(true);
    expect(checkRateLimit(key, cfg).allowed).toBe(true);
  });

  it("blocks when capacity exhausted", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const cfg = { capacity: 1, refillPerMs: 0 };
    expect(checkRateLimit(key, cfg).allowed).toBe(true);
    const blocked = checkRateLimit(key, cfg);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills tokens over time", async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    // 10 tokens per second = 0.01 per ms
    const cfg = { capacity: 2, refillPerMs: 10 / 1000 };
    checkRateLimit(key, cfg);
    checkRateLimit(key, cfg);
    expect(checkRateLimit(key, cfg).allowed).toBe(false);

    // Wait 150ms — should refill at least 1 token
    await new Promise((r) => setTimeout(r, 150));
    expect(checkRateLimit(key, cfg).allowed).toBe(true);
  });

  it("caps at capacity", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const cfg = { capacity: 5, refillPerMs: 10 / 1000 };
    // Use all 5 capacity
    for (let i = 0; i < cfg.capacity; i++) {
      checkRateLimit(key, cfg);
    }
    // 6th should be blocked
    expect(checkRateLimit(key, cfg).allowed).toBe(false);
    // remaining must not exceed capacity - 1
    expect(checkRateLimit(key, cfg).remaining).toBeLessThanOrEqual(cfg.capacity);
  });

  it("LIMITS presets exist", () => {
    expect(LIMITS.recognize.capacity).toBeGreaterThan(0);
    expect(LIMITS.outfit.capacity).toBeGreaterThan(0);
    expect(LIMITS.reference.capacity).toBeGreaterThan(0);
  });
});

describe("rateLimitResponse", () => {
  it("returns null when allowed", () => {
    expect(rateLimitResponse({ allowed: true, remaining: 1 })).toBeNull();
  });

  it("returns 429 with retry-after when blocked", () => {
    const res = rateLimitResponse({
      allowed: false,
      remaining: 0,
      retryAfterMs: 5000,
    });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBe("5");
    expect(res!.headers.get("Content-Type")).toBe("application/json");
  });
});
