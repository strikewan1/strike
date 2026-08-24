/**
 * Behavior tests for googleAIChat — focused on how many Gemini API
 * calls a single outfit click makes (and therefore how fast a user
 * burns through their per-minute Tier-1 quota).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/google-ai", async () => {
  const actual = await vi.importActual<{
    googleAIChat: (
      messages: unknown,
      options?: unknown,
    ) => Promise<string>;
  }>("@/lib/ai/google-ai");
  return { googleAIChat: actual.googleAIChat };
});

beforeEach(() => {
  // Set the API key before each test so the real code path is
  // exercised (otherwise it short-circuits to a mock).
  vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
});

function makeOkResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeErrorResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function make429(retryInSeconds: number): Response {
  return makeErrorResponse(429, {
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      message: `Quota exceeded. Please retry in ${retryInSeconds}.5s.`,
    },
  });
}

function make404(): Response {
  return makeErrorResponse(404, {
    error: {
      code: 404,
      status: "NOT_FOUND",
      message: "This model is no longer available. Use models/gemini-3.6-flash.",
    },
  });
}

function make500(): Response {
  return makeErrorResponse(500, { error: { message: "internal" } });
}

describe("googleAIChat — request budget per call", () => {
  it("makes exactly 1 request when the first model succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeOkResponse('{"x":1}'));

    const { googleAIChat } = await import("@/lib/ai/google-ai");
    const out = await googleAIChat([{ role: "user", content: "hi" }]);
    expect(out).toBe('{"x":1}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("aborts immediately on 429 (per-project quota)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(make429(60));
    const { googleAIChat } = await import("@/lib/ai/google-ai");
    await expect(
      googleAIChat([{ role: "user", content: "hi" }]),
    ).rejects.toThrow(/rate limit/i);
    // CRITICAL: must stop after 1 call, not burn the minute's quota
    // trying other fallback models.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("tries the next model on 404 (model not found, quota OK)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(make404())
      .mockResolvedValueOnce(makeOkResponse('{"a":1}'));
    const { googleAIChat } = await import("@/lib/ai/google-ai");
    const out = await googleAIChat([{ role: "user", content: "hi" }]);
    expect(out).toBe('{"a":1}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("does NOT retry same model on 500 but DOES cycle fallbacks (server err might be transient)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(make500());
    const { googleAIChat } = await import("@/lib/ai/google-ai");
    await expect(
      googleAIChat([{ role: "user", content: "hi" }]),
    ).rejects.toThrow();
    // Each model gets tried once (no retry on 500), then moves to next.
    // Chain length varies but should be bounded.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(10);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    fetchMock.mockRestore();
  });

  it("bulk cost: 10 successful generations = 10 Gemini calls (1 per outfit)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(makeOkResponse('{"ok":1}')),
      );
    const { googleAIChat } = await import("@/lib/ai/google-ai");
    for (let i = 0; i < 10; i++) {
      await googleAIChat([{ role: "user", content: `x${i}` }]);
    }
    // Best case: 10 outfits × 1 Gemini call each = 10 total.
    expect(fetchMock).toHaveBeenCalledTimes(10);
    fetchMock.mockRestore();
  });
});
