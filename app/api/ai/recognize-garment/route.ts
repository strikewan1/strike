import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { googleAIChat, parseJsonSafe, bufferHash } from "@/lib/ai/google-ai";
import { RECOGNIZE_GARMENT_PROMPT } from "@/lib/ai/prompts";
import { RecognizedGarmentSchema } from "@/lib/ai/schemas";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/rate-limit";

// Allow up to 60s for the function. The fallback chain can iterate
// several models with retries, so we need the headroom. Vercel Hobby
// defaults to 10s which would kill the request mid-fallback.
// On Vercel Pro this is fine; on Hobby, Vercel still allows up to 60s
// for streaming/non-streaming responses when the route sets maxDuration.
export const maxDuration = 60;

const BodySchema = z.object({
  image: z.string().min(100), // base64 data URL
  mimeType: z.string().default("image/jpeg"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`recognize:${user.id}`, LIMITS.recognize);
    const limited = rateLimitResponse(rl);
    if (limited) return limited;

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { image } = parsed.data;

    // Compute hash for cache lookup
    const base64Data = image.replace(/^data:[^;]+;base64,/, "");
    const hash = bufferHash(Buffer.from(base64Data, "base64"));

    // Check cache
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("response")
      .eq("image_hash", hash)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({ ...cached.response, cached: true });
    }

    // Call Google AI (Gemini)
    const raw = await googleAIChat(RECOGNIZE_GARMENT_PROMPT(image), {
      jsonMode: true,
      maxTokens: 800,
    });

    let parsed2;
    try {
      parsed2 = RecognizedGarmentSchema.safeParse(parseJsonSafe(raw));
    } catch (parseErr) {
      // parseJsonSafe threw — most likely "Empty response" or unparseable JSON
      console.error(
        "[recognize-garment] JSON parse failed:",
        parseErr instanceof Error ? parseErr.message : parseErr,
      );
      console.error(
        "[recognize-garment] raw from Gemini (first 500 chars):",
        raw.slice(0, 500),
      );
      return NextResponse.json(
        {
          error: "AI returned unparseable response. Try again.",
          raw: raw.slice(0, 500),
        },
        { status: 502 },
      );
    }

    if (!parsed2.success) {
      console.error(
        "[recognize-garment] Zod validation failed:",
        JSON.stringify(parsed2.error.flatten()),
      );
      console.error(
        "[recognize-garment] raw from Gemini (first 500 chars):",
        raw.slice(0, 500),
      );
      return NextResponse.json(
        {
          error: "AI returned invalid response. You can correct the values manually.",
          details: parsed2.error.flatten(),
        },
        { status: 502 },
      );
    }

    const result = parsed2.data;

    // Save to cache (best-effort)
    await supabase.from("ai_cache").insert({
      image_hash: hash,
      response: result,
      model: process.env.GOOGLE_AI_VISION_MODEL ?? "gemini-2.5-flash",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/ai/recognize-garment]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
