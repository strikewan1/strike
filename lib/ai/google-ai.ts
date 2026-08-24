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
// OpenAI-compatible endpoint. gemini-flash-latest is an alias that
// Google keeps pointing at the most recent stable Flash model. We used
// to default to gemini-2.5-flash but that one is now deprecated for
// new users. Override per request via `options.model` if needed.
export const VISION_MODEL =
  process.env.GOOGLE_AI_VISION_MODEL ?? "gemini-flash-latest";
export const TEXT_MODEL =
  process.env.GOOGLE_AI_TEXT_MODEL ?? "gemini-flash-latest";

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
 * Models that Google has deprecated (return 404). We skip these
 * automatically even if the user has them configured.
 */
const DEPRECATED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
]);

function warnIfDeprecated(label: string, model: string) {
  if (DEPRECATED_MODELS.has(model)) {
    console.warn(
      `[GoogleAI] ${label}=${model} is DEPRECATED by Google and returns 404. ` +
        `Change to gemini-flash-latest in Vercel env vars.`,
    );
  }
}

warnIfDeprecated("GOOGLE_AI_VISION_MODEL", VISION_MODEL);
warnIfDeprecated("GOOGLE_AI_TEXT_MODEL", TEXT_MODEL);

/**
 * Fallback chain — when a model returns 404 (deprecated/unavailable),
 * try the next one in the list. We DEDUPLICATE and SKIP DEPRECATED
 * models automatically so the chain never tries the same model twice
 * or a model Google has already shut off.
 */
const MODEL_FALLBACKS_RAW = [
  // Configured defaults (already validated above)
  VISION_MODEL,
  TEXT_MODEL,
  // Recent stable aliases — Google keeps these pointing at the latest
  // working flash/pro model even after specific versions are deprecated.
  // These are FIRST in the chain because they're the safest choice.
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  // Lighter variants
  "gemini-2.5-flash-lite",
  // Newer preview models
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
];
const MODEL_FALLBACKS = Array.from(
  new Set(MODEL_FALLBACKS_RAW),
).filter((m) => !DEPRECATED_MODELS.has(m));

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

/**
 * Parse Google's rate-limit retry-after hint from the error body.
 * Returns seconds (rounded up) or null if not parseable.
 * Google's messages look like "Please retry in 10.835577176s."
 */
function parseRetryAfterSeconds(err: Error): number | null {
  const match = err.message.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (!match) return null;
  const seconds = parseFloat(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
}

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
    let errMsg = "";
    let errMsgLower = "";
    try {
      const parsed = JSON.parse(text) as {
        error?: {
          type?: string;
          message?: string;
          code?: string;
        };
      };
      const errType = parsed.error?.type;
      errMsg = parsed.error?.message ?? "";
      errMsgLower = errMsg.toLowerCase();
      if (
        res.status === 401 ||
        errType === "invalid_request_error" ||
        errMsgLower.includes("api key")
      ) {
        friendly = `GoogleAI API key inválida o sin permisos. Revisá GOOGLE_AI_API_KEY en Vercel env vars.`;
      } else if (res.status === 429 || errType === "rate_limit_error") {
        // Distinguish rate-limit-per-minute (transient, retry works)
        // from free-tier-quota-exceeded (need a paid API key, retry
        // doesn't help). Google's error message mentions "free_tier"
        // for the latter.
        if (errMsgLower.includes("free_tier") || errMsgLower.includes("quota")) {
          friendly =
            `GoogleAI quota exceeded on free tier. Aunque tengas billing ` +
            `habilitado en AI Studio, tu API key actual sigue en tier free. ` +
            `Creá una NUEVA key en https://aistudio.google.com/app/apikey ` +
            `(después de habilitar billing) y actualizá GOOGLE_AI_API_KEY en Vercel.`;
          isRetryable = false; // retries won't help against a hard quota
        } else {
          friendly = `GoogleAI rate limit alcanzado. Esperá 1-2 minutos.`;
          isRetryable = true;
        }
      } else if (
        res.status === 404 ||
        errMsgLower.includes("no longer available")
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
    // Extract retry-after seconds from Google's message so the caller
    // (e.g. /api/ai routes) can surface a precise 429 with Retry-After
    // header to the client. Critical for per-minute rate limits where
    // the user needs an accurate countdown.
    const retryAfter =
      isRetryable && errMsg && errMsg.toLowerCase().includes("retry in")
        ? parseRetryAfterSeconds(new Error(errMsg))
        : null;
    const err = new Error(friendly);
    const tagged = err as Error & {
      retryable?: boolean;
      retryAfter?: number | null;
    };
    tagged.retryable = isRetryable;
    tagged.retryAfter = retryAfter;
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
    // Per-candidate retry: 1 retry with 1.2s backoff for retryable
    // errors. Keep it tight so total request time stays well under
    // Vercel's maxDuration budget — too many retries would cause the
    // edge to kill the request before all fallbacks get a chance.
    // 2 attempts = 1 initial + 1 retry. For per-minute rate limits
    // (e.g. Tier 1 = 360 RPM), one retry with the server's `retry in
    // Xs` backoff is enough; if the second hit also fails we move on
    // so we don't burn through the entire minute's quota on a single
    // request the user gave up on.
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

        // Retryable: backoff if there are attempts left. Honor Google's
        // retry-after hint when present (e.g. "retry in 10s") — 1.2s for
        // a 10s rate-limit window just hits the limit again immediately.
        if (attempt < maxAttempts) {
          const retryAfter =
            err instanceof Error ? parseRetryAfterSeconds(err) : null;
          const backoffMs =
            retryAfter !== null
              ? retryAfter * 1000 + 500 // small buffer past the stated wait
              : 1200;
          console.warn(
            `[GoogleAI] model ${candidate} returned retryable error, ` +
              (retryAfter !== null
                ? `waiting ${retryAfter}s as suggested by API`
                : `retrying in ${backoffMs}ms`) +
              ` (attempt ${attempt}/${maxAttempts})`,
          );
          await sleep(backoffMs);
          continue;
        }

        // Out of retries on this model.
        console.warn(
          `[GoogleAI] model ${candidate} still failing after ${maxAttempts} attempts`,
        );
        // CRITICAL for per-minute rate limits (Tier 1 = 360 RPM):
        // the quota is per-PROJECT, not per-model. If one model hits 429,
        // EVERY model will hit it within the same window. So we abort
        // the whole fallback chain rather than burning more requests
        // on other models in the chain.
        if (
          err instanceof Error &&
          (err as Error & { retryable?: boolean }).retryable
        ) {
          throw err;
        }
        break; // Non-retryable error → move to next model
      }
    }
  }

  // All candidates exhausted
  throw (
    lastError ??
    new Error("GoogleAI: all fallback models unavailable")
  );
}

// Parse JSON safely. Strips markdown fences if model ignores instructions,
// and extracts the first {...} block if the model added a preamble
// (e.g., "Here is the JSON:\n{...}"). Tolerant of model variations.
export function parseJsonSafe<T>(raw: string): T {
  if (!raw || !raw.trim()) {
    throw new Error("Empty response from AI");
  }
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fallback: extract first {...} block (handles "Here is the JSON: {..}" preambles)
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`Could not parse JSON from AI response: ${cleaned.slice(0, 120)}…`);
  }
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
