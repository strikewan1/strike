// Google AI Studio (Gemini) client.
//
// We use the OpenAI-compatible endpoint that Google exposes at
// /v1beta/openai — this means we keep the same request/response shape
// we had with MiniMax, just swap base URL, auth header, and error
// parsing. No SDK dependency, no breaking changes elsewhere.
//
// Docs: https://ai.google.dev/gemini-api/docs/openai

import { createHash } from "crypto";

const GOOGLE_AI_BASE_URL =
  process.env.GOOGLE_AI_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? "";

// Default models — these should be models available on the
// OpenAI-compatible endpoint. Note: gemini-2.0-flash was deprecated
// by Google in late 2025; we now use the 2.5 series by default.
// Override per request via `options.model` if needed.
export const VISION_MODEL =
  process.env.GOOGLE_AI_VISION_MODEL ?? "gemini-2.5-flash";
export const TEXT_MODEL =
  process.env.GOOGLE_AI_TEXT_MODEL ?? "gemini-2.5-flash";

/**
 * Sanity check at module load: warn (but don't crash) when the API key
 * is missing or suspiciously short. We don't check the prefix because
 * Google has changed key formats over time (AIza..., AQ..., etc).
 */
if (!GOOGLE_AI_API_KEY) {
  console.warn(
    "[GoogleAI] GOOGLE_AI_API_KEY is not set — AI features will return mocks",
  );
} else if (GOOGLE_AI_API_KEY.length < 20) {
  console.warn(
    `[GoogleAI] GOOGLE_AI_API_KEY looks too short (${GOOGLE_AI_API_KEY.length} chars). Did you truncate it?`,
  );
}

/**
 * Fallback chain — when a model returns 404 (deprecated/unavailable),
 * try the next one in the list. This saved us once already when Google
 * silently deprecated gemini-2.0-flash.
 *
 * The chain starts with the configured default and ends with cheap
 * lightweight fallbacks.
 */
const MODEL_FALLBACKS = [
  // Configured defaults
  VISION_MODEL,
  TEXT_MODEL,
  // Recent stable aliases — Google keeps these pointing at the latest
  // working flash/pro model even after specific versions are deprecated.
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  // Older stable that may still be available
  "gemini-2.5-flash-lite",
];

/**
 * Detects whether an error indicates the model is missing/deprecated.
 * Google's OpenAI-compat error format:
 *   { "error": { "code": 404, "status": "NOT_FOUND", "message": "...no longer available..." } }
 */
function isModelUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("no longer available") ||
    msg.includes("is not supported")
  );
}

/**
 * Detects whether an error indicates a transient/retryable condition
 * (rate limit, service unavailable, overload).
 */
function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return Boolean((err as Error & { retryable?: boolean }).retryable);
}

/** Sleep helper — small wrapper so tests can stub it. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
  max_tokens?: number;
}

interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ChatOptions {
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
  model?: string;
}

/**
 * Internal: make a single completion request against a specific model.
 * Throws on any non-2xx response.
 */
async function chatWithModel(
  messages: ChatMessage[],
  options: ChatOptions,
  model: string,
): Promise<string> {
  const {
    temperature = 0.4,
    jsonMode = true,
    maxTokens = 1500,
  } = options;

  const body: ChatRequest = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${GOOGLE_AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let friendly = `GoogleAI error ${res.status}`;
    let isRetryable = false;
    try {
      const parsed = JSON.parse(text) as {
        error?: {
          type?: string;
          message?: string;
          code?: string;
        };
      };
      const errType = parsed.error?.type;
      const errMsg = parsed.error?.message;
      if (
        res.status === 401 ||
        errType === "invalid_request_error" ||
        (errMsg?.toLowerCase().includes("api key") ?? false)
      ) {
        friendly = `GoogleAI API key inválida o sin permisos. Revisá GOOGLE_AI_API_KEY en Vercel env vars.`;
      } else if (res.status === 429 || errType === "rate_limit_error") {
        friendly = `GoogleAI rate limit alcanzado. Esperá 1-2 minutos.`;
        isRetryable = true;
      } else if (
        res.status === 404 ||
        errMsg?.toLowerCase().includes("no longer available")
      ) {
        // Include the model name so users/devs know which fallback chain failed
        friendly = `Modelo ${model} no disponible (404): ${errMsg ?? "model not found"}`;
      } else if (res.status === 503 || errType === "service_unavailable") {
        friendly = `GoogleAI service temporalmente no disponible. Reintentando con otro modelo...`;
        isRetryable = true;
      } else if (res.status === 529) {
        // 529 = overloaded (Anthropic-style, but Google has been known to use it)
        friendly = `GoogleAI sobrecargado. Reintentando...`;
        isRetryable = true;
      } else if (errMsg) {
        friendly = `GoogleAI error ${res.status}: ${errMsg}`;
      }
    } catch {
      // Body wasn't JSON; fall through to raw text
    }
    const sanitized = text.length > 500 ? text.slice(0, 500) + "…" : text;
    console.error(`[GoogleAI] ${res.status} ${model}: ${sanitized}`);
    const err = new Error(friendly);
    (err as Error & { retryable?: boolean }).retryable = isRetryable;
    throw err;
  }

  const data = (await res.json()) as ChatResponse;
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("GoogleAI returned empty content");
  return content;
}

/**
 * Public entry point. Walks the fallback chain; on each candidate, retries
 * up to 2x with backoff if the error is transient (429/503/529). On
 * model-availability (404) errors, moves to the next candidate.
 */
export async function googleAIChat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  // Bail with mock when no key configured
  if (!GOOGLE_AI_API_KEY) {
    return mockResponse(messages);
  }

  // Build the candidate list — explicit model wins over fallback chain
  const explicit = options.model;
  const candidates = explicit
    ? [explicit, ...MODEL_FALLBACKS.filter((m) => m !== explicit)]
    : MODEL_FALLBACKS;

  let lastError: unknown;

  for (const candidate of candidates) {
    // Per-candidate retry: up to 2 attempts with 1.5s backoff for
    // retryable errors. After 2 failed attempts on one model, give
    // up on it and move to the next.
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await chatWithModel(messages, options, candidate);
      } catch (err) {
        lastError = err;

        // Model-availability (404) → don't retry this model, move on
        if (isModelUnavailable(err)) {
          console.warn(
            `[GoogleAI] model ${candidate} unavailable, trying next fallback`,
          );
          break;
        }

        // Non-retryable error → surface immediately
        if (!isRetryable(err)) {
          throw err;
        }

        // Retryable: backoff if there are attempts left
        if (attempt < maxAttempts) {
          const backoffMs = 1500;
          console.warn(
            `[GoogleAI] model ${candidate} returned retryable error, retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`,
          );
          await sleep(backoffMs);
          continue;
        }

        // Out of retries on this model → move to next candidate
        console.warn(
          `[GoogleAI] model ${candidate} still failing after ${maxAttempts} attempts, trying next fallback`,
        );
        break;
      }
    }
  }

  // All candidates exhausted
  throw (
    lastError ??
    new Error("GoogleAI: all fallback models unavailable")
  );
}

// Parse JSON safely. Strips markdown fences if model ignores instructions.
export function parseJsonSafe<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

export function bufferHash(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

// Mock for dev without API key.
function mockResponse(messages: ChatMessage[]): string {
  const lastUser = messages.findLast((m) => m.role === "user");
  const isImage =
    typeof lastUser?.content !== "string" &&
    Array.isArray(lastUser?.content) &&
    lastUser.content.some((c) => c.type === "image_url");

  if (isImage) {
    return JSON.stringify({
      kind: "garment",
      category: "top",
      subcategory: "heavyweight_tee",
      fit: "boxy",
      primary_color: "white",
      secondary_colors: [],
      pattern: "solid",
      material: "cotton",
      seasons: ["spring", "summer", "fall"],
      formality: 1,
      style_tags: ["amekaji", "minimal", "casual"],
      brand_guess: null,
      sneaker: null,
      confidence_notes:
        "MOCK RESPONSE — configure GOOGLE_AI_API_KEY for real AI.",
    });
  }

  return JSON.stringify({
    outfits: [
      {
        title: "MOCK — Amekaji base + statement sneaker",
        garments: [],
        explanation:
          "MOCK RESPONSE. Configure GOOGLE_AI_API_KEY for real outfit generation.",
        formality: 2,
      },
    ],
    notes: "No API key configured.",
  });
}
