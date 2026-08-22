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

export const VISION_MODEL =
  process.env.GOOGLE_AI_VISION_MODEL ?? "gemini-2.0-flash";
export const TEXT_MODEL = process.env.GOOGLE_AI_TEXT_MODEL ?? "gemini-2.0-flash";

/**
 * Sanity check at module load: warn (but don't crash) when the API key
 * looks missing or malformed. Helps surface config errors during smoke
 * tests instead of failing silently later.
 */
if (!GOOGLE_AI_API_KEY) {
  console.warn(
    "[GoogleAI] GOOGLE_AI_API_KEY is not set — AI features will return mocks",
  );
} else if (!GOOGLE_AI_API_KEY.startsWith("AIza")) {
  console.warn(
    `[GoogleAI] GOOGLE_AI_API_KEY doesn't start with 'AIza' — did you paste the wrong key? (got ${GOOGLE_AI_API_KEY.length} chars)`,
  );
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

export async function googleAIChat(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    jsonMode?: boolean;
    maxTokens?: number;
    model?: string;
  } = {},
): Promise<string> {
  const {
    temperature = 0.4,
    jsonMode = true,
    maxTokens = 1500,
    model = TEXT_MODEL,
  } = options;

  // Guard: bail with a friendly error when no key is configured.
  // The mocks below will be returned instead.
  if (!GOOGLE_AI_API_KEY) {
    return mockResponse(messages);
  }

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
      // Google error format (OpenAI-compatible):
      //   401: "API key not valid..." / type "invalid_request_error"
      //   403: "Permission denied" / type "permission_denied"
      //   429: "Resource has been exhausted" / type "rate_limit_error"
      if (
        res.status === 401 ||
        errType === "invalid_request_error" ||
        (errMsg?.toLowerCase().includes("api key") ?? false)
      ) {
        friendly = `GoogleAI API key inválida o sin permisos. Revisá GOOGLE_AI_API_KEY en Vercel env vars.`;
      } else if (res.status === 429 || errType === "rate_limit_error") {
        friendly = `GoogleAI rate limit alcanzado. Probá en unos minutos.`;
      } else if (errMsg) {
        friendly = `GoogleAI error ${res.status}: ${errMsg}`;
      }
    } catch {
      // Body wasn't JSON; fall through to raw text
    }
    // Sanitize before logging to avoid dumping any sensitive fragments.
    const sanitized = text.length > 500 ? text.slice(0, 500) + "…" : text;
    console.error(`[GoogleAI] ${res.status}: ${sanitized}`);
    throw new Error(friendly);
  }

  const data = (await res.json()) as ChatResponse;
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("GoogleAI returned empty content");
  return content;
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
