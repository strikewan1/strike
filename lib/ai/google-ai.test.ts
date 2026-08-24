/**
 * Behavior tests for googleAIChat — focused on how many Gemini API
 * calls a single outfit click makes (and therefore how fast a user
 * burns through their per-minute Tier-1 quota).
 *
 * These tests verify the BEHAVIOR the production rate-limit fix
 * depends on. They are intentionally simple: each test sets up
 * specific responses and asserts the total call count.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// googleAIChat short-circuits to a mock if GOOGLE_AI_API_KEY isn't set.
// Set the env var before the module is loaded.
process.env.GOOGLE_AI_API_KEY = "test-key";

vi.mock("@/lib/ai/google-ai", async () => {
  const actual = await vi.importActual<{
    googleAIChat: (
      messages: unknown,
      options?: unknown,
    ) => Promise<string>;
  }>("@/lib/ai/google-ai");
  return { googleAIChat: actual.googleAIChat };
});

function makeOkResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function make429(retryInSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        // Note: do NOT include "quota" or "free_tier" here — the SUT
        // branches on those keywords for the hard-quota case.
        message: `Rate limit exceeded. Please retry in ${retryInSeconds}.5s.`,
      },
    }),
    { status: 429, headers: { "Content-Type": "application/json" } },
  );
}

describe("googleAIChat — request budget per outfit click", () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Use a fresh, fresh-mocked function for each test (not a shared
    // mockImplementation) to avoid test pollution.
    fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockReset();
  });

  it("1 successful click = 1 Gemini call", async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('{"x":1}'));

    const { googleAIChat } = await import("@/lib/ai/google-ai");
    const out = await googleAIChat([{ role: "user", content: "hi" }]);
    expect(out).toBe('{"x":1}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("1 rate-limited click = 1 initial + 1 retry (aborts fallback chain)", async () => {
    // Use mockImplementation so each call gets a fresh Response
    // (Response bodies are single-use ReadableStreams).
    fetchMock.mockImplementation(() => Promise.resolve(make429(60)));

    const { googleAIChat } = await import("@/lib/ai/google-ai");
    await expect(
      googleAIChat([{ role: "user", content: "hi" }]),
    ).rejects.toThrow(/rate limit/i);
    // The critical guarantee: do NOT cycle through fallback models on
    // 429 — they all share the same per-project quota. The retry
    // happens on the SAME model, not across the chain.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
