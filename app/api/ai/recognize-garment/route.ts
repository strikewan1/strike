import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { googleAIChat, parseJsonSafe, bufferHash } from "@/lib/ai/google-ai";
import { RECOGNIZE_GARMENT_PROMPT } from "@/lib/ai/prompts";
import { RecognizedGarmentSchema } from "@/lib/ai/schemas";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/rate-limit";

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

    // Call MiniMax
    const raw = await googleAIChat(RECOGNIZE_GARMENT_PROMPT(image), {
      jsonMode: true,
      maxTokens: 800,
    });

    const parsed2 = RecognizedGarmentSchema.safeParse(parseJsonSafe(raw));
    if (!parsed2.success) {
      return NextResponse.json(
        {
          error: "AI returned invalid response",
          details: parsed2.error.flatten(),
          raw,
        },
        { status: 502 },
      );
    }

    const result = parsed2.data;

    // Save to cache (best-effort)
    await supabase.from("ai_cache").insert({
      image_hash: hash,
      response: result,
      model: process.env.GOOGLE_AI_VISION_MODEL ?? "gemini-2.0-flash",
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
