import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { minimaxChat, parseJsonSafe } from "@/lib/ai/minimax";
import { OUTFIT_SYSTEM_PROMPT, buildOutfitUserPrompt } from "@/lib/ai/prompts";
import { OutfitResponseSchema } from "@/lib/ai/schemas";
import { summarizeForLLM } from "@/lib/outfit-engine/rules";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/rate-limit";

const BodySchema = z.object({
  occasion: z.string().min(1),
  contextText: z.string().optional(),
  weather: z
    .object({
      temp: z.number().optional(),
      conditions: z.string().optional(),
    })
    .optional(),
  sneakerId: z.string().uuid().optional(),
  outfitCount: z.number().int().min(1).max(4).default(3),
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

    const rl = checkRateLimit(`outfit:${user.id}`, LIMITS.outfit);
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

    const { occasion, contextText, weather, sneakerId, outfitCount } =
      parsed.data;

    // Fetch user's full closet
    const { data: garments } = await supabase
      .from("garments")
      .select(
        "id, category, subcategory, fit, primary_color, secondary_colors, formality, style_tags, sneaker_prominence, wear_count, last_worn",
      )
      .eq("user_id", user.id)
      .eq("archived", false);

    if (!garments || garments.length < 3) {
      return NextResponse.json(
        {
          error: "Closet too small",
          message:
            "Necesitás al menos 3 prendas registradas para generar outfits.",
          count: garments?.length ?? 0,
        },
        { status: 400 },
      );
    }

    // Fetch recent outfits to avoid repetition
    const { data: recent } = await supabase
      .from("wear_history")
      .select("garment_ids, outfits(title, occasion)")
      .eq("user_id", user.id)
      .order("worn_on", { ascending: false })
      .limit(10);

    const recentSummary = (recent ?? [])
      .map((r) => {
        const title = (r.outfits as unknown as { title?: string } | null)
          ?.title;
        return title ? `${title} (${r.garment_ids.join(",")})` : r.garment_ids.join(",");
      })
      .join("\n");

    // Fetch style memory
    const { data: style } = await supabase
      .from("style_preferences")
      .select("prefs")
      .eq("user_id", user.id)
      .maybeSingle();

    const styleMemory = style?.prefs
      ? JSON.stringify(style.prefs, null, 2)
      : "";

    const userPrompt = buildOutfitUserPrompt({
      occasion,
      contextText,
      weather,
      sneakerId,
      closetSummary: JSON.stringify(summarizeForLLM(garments), null, 2),
      recentOutfitsSummary: recentSummary,
      styleMemory,
    });

    const raw = await minimaxChat(
      [
        { role: "system", content: OUTFIT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { jsonMode: true, maxTokens: 2500, temperature: 0.7 },
    );

    const parsed2 = OutfitResponseSchema.safeParse(parseJsonSafe(raw));
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

    // Validate that every garment_id exists in user's closet
    const validIds = new Set(garments.map((g) => g.id));
    const validatedOutfits = parsed2.data.outfits
      .map((o) => ({
        ...o,
        garments: o.garments.filter((gi) => validIds.has(gi.garment_id)),
      }))
      .filter((o) => o.garments.length >= 2)
      .slice(0, outfitCount);

    return NextResponse.json({
      outfits: validatedOutfits,
      notes: parsed2.data.notes,
    });
  } catch (error) {
    console.error("[/api/ai/generate-outfit]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
