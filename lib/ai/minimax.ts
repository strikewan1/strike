// MiniMax API client. Uses chat-completions style with vision support.
// Falls back gracefully if API key is missing (returns mock for dev).

import { createHash } from "crypto";

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL ?? "https://api.minimax.chat/v1";
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY ?? "";
const TEXT_MODEL = process.env.MINIMAX_TEXT_MODEL ?? "MiniMax-Text-01";

/**
 * Sanity check at module load: warn (but don't crash) when the API key
 * looks missing or malformed. Helps surface config errors during smoke
 * tests instead of failing silently later.
 */
if (!MINIMAX_API_KEY) {
  console.warn(
    "[MiniMax] MINIMAX_API_KEY is not set — AI features will return mocks",
  );
} else if (MINIMAX_API_KEY.length < 20) {
  console.warn(
    `[MiniMax] MINIMAX_API_KEY looks too short (${MINIMAX_API_KEY.length} chars). Did you truncate it?`,
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

export async function minimaxChat(
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

  if (!MINIMAX_API_KEY) {
    console.warn(
      "[MiniMax] No API key set — returning mock response. Configure MINIMAX_API_KEY in .env.local.",
    );
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

  const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // Parse the error to give a clearer message for the common case of
    // invalid/expired API keys (avoids dumping raw provider JSON to users).
    let friendly = `MiniMax API error ${res.status}`;
    try {
      const parsed = JSON.parse(text) as {
        error?: {
          type?: string;
          message?: string;
        };
      };
      const errType = parsed.error?.type;
      const errMsg = parsed.error?.message;
      if (res.status === 401 || errType === "authorized_error") {
        friendly = `MiniMax API key inválida o revocada. Revisá MINIMAX_API_KEY en Vercel env vars.`;
      } else if (res.status === 429 || errType === "rate_limit") {
        friendly = `MiniMax rate limit alcanzado. Probá en unos minutos.`;
      } else if (errMsg) {
        friendly = `MiniMax API error ${res.status}: ${errMsg}`;
      }
    } catch {
      // Body wasn't JSON; fall through to raw text
    }
    // Don't log the full text — it could include the API key in some
    // error formats. Sanitize just in case.
    const sanitized = text.length > 500 ? text.slice(0, 500) + "…" : text;
    console.error(`[MiniMax] ${res.status}: ${sanitized}`);
    throw new Error(friendly);
  }

  const data = (await res.json()) as ChatResponse;
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("MiniMax returned empty content");
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

// Cache key for image recognition — content hash
export function bufferHash(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

// Mock for dev without API key
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
      confidence_notes: "MOCK RESPONSE — configure MINIMAX_API_KEY for real AI.",
    });
  }

  return JSON.stringify({
    outfits: [
      {
        title: "MOCK — Amekaji base + statement sneaker",
        garments: [],
        explanation:
          "MOCK RESPONSE. Configure MINIMAX_API_KEY in .env.local to enable real outfit generation.",
        formality: 2,
      },
    ],
    notes: "No API key configured.",
  });
}
