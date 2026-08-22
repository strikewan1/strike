import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { minimaxChat, parseJsonSafe } from "@/lib/ai/minimax";
import { OUTFIT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { OutfitResponseSchema, type OutfitResponse } from "@/lib/ai/schemas";
import { summarizeForLLM, type ClosetItem } from "@/lib/outfit-engine/rules";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/rate-limit";

const BodySchema = z.object({
  referenceId: z.string().uuid(),
});

// Loose mapping for reference item types → garment categories
const TYPE_TO_CATEGORY: Record<string, string> = {
  top: "top",
  bottom: "bottom",
  outerwear: "outerwear",
  footwear: "footwear",
  accessory: "accessory",
  headwear: "accessory",
};

const NEUTRAL_COLORS = new Set([
  "white",
  "black",
  "grey",
  "gray",
  "navy",
  "beige",
  "ecru",
  "cream",
  "tan",
  "brown",
]);

function colorMatch(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const an = a.toLowerCase().trim();
  const bn = b.toLowerCase().trim();
  if (an === bn) return 1;
  if (NEUTRAL_COLORS.has(an) || NEUTRAL_COLORS.has(bn)) return 0.75;
  // Loose family match
  const earthTones = new Set([
    "olive",
    "khaki",
    "tan",
    "brown",
    "beige",
    "ecru",
    "cream",
    "mustard",
    "burgundy",
    "rust",
  ]);
  if (earthTones.has(an) && earthTones.has(bn)) return 0.85;
  return 0.4;
}

function matchGarmentsToReferenceItem(
  item: { type: string; color: string; description?: string },
  closet: ClosetItem[],
) {
  const targetCat = TYPE_TO_CATEGORY[item.type.toLowerCase()] ?? null;
  if (!targetCat) return null;

  const candidates = closet
    .filter((g) => g.category === targetCat)
    .map((g) => {
      const c = colorMatch(g.primary_color, item.color);
      const f = g.fit ? 0.5 : 0.3;
      const score = c * 0.7 + f * 0.3;
      return { garment: g, score: score };
    })
    .filter((c) => c.score >= 0.4)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`reference:${user.id}`, LIMITS.reference);
    const limited = rateLimitResponse(rl);
    if (limited) return limited;

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body" },
        { status: 400 },
      );
    }

    // Fetch the reference
    const { data: reference } = await supabase
      .from("outfit_references")
      .select("*")
      .eq("id", parsed.data.referenceId)
      .eq("user_id", user.id)
      .single();

    if (!reference) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    const detected = (reference.detected_items ?? []) as Array<{
      type: string;
      color: string;
      description?: string;
    }>;
    if (detected.length === 0) {
      return NextResponse.json(
        { error: "Reference has no detected items" },
        { status: 400 },
      );
    }

    // Fetch user's closet
    const { data: garments } = await supabase
      .from("garments")
      .select(
        "id, category, subcategory, primary_color, fit, formality, style_tags, sneaker_prominence, wear_count, last_worn",
      )
      .eq("user_id", user.id)
      .eq("archived", false);

    const closet: ClosetItem[] = ((garments ?? []) as Array<{
      id: string;
      category: string;
      subcategory: string | null;
      fit: string | null;
      primary_color: string | null;
      secondary_colors: string[] | null;
      formality: number | null;
      style_tags: string[] | null;
      sneaker_prominence: string | null;
      wear_count: number;
      last_worn: string | null;
    }>).map((g) => ({
      id: g.id,
      category: g.category,
      subcategory: g.subcategory,
      fit: g.fit,
      primary_color: g.primary_color,
      secondary_colors: g.secondary_colors ?? [],
      formality: g.formality,
      style_tags: g.style_tags ?? [],
      sneaker_prominence: g.sneaker_prominence as ClosetItem["sneaker_prominence"],
      wear_count: g.wear_count,
      last_worn: g.last_worn,
    }));

    // Match each detected item
    const matches: Array<{
      reference_item: { type: string; color: string; description?: string };
      matched: { id: string; category: string; subcategory: string | null; primary_color: string | null } | null;
      score: number | null;
    }> = [];

    for (const item of detected) {
      const result = matchGarmentsToReferenceItem(item, closet);
      matches.push({
        reference_item: item,
        matched: result?.garment ?? null,
        score: result?.score ?? null,
      });
    }

    const have = matches.filter((m) => m.matched);
    const missing = matches.filter((m) => !m.matched);

    // If at least 2 items matched, ask LLM to assemble an alternative outfit using
    // the matched garments as anchors and closet fillers.
    let suggestedOutfit: OutfitResponse | null = null;
    if (have.length >= 2) {
      const userPrompt = `The user wants to recreate this reference outfit:
${JSON.stringify(detected, null, 2)}

We found the following equivalents in their closet:
${JSON.stringify(have, null, 2)}

Missing pieces (not in closet): ${JSON.stringify(missing.map((m) => m.reference_item), null, 2)}

Build 1-2 outfit suggestions using ONLY the user's closet, prioritizing the matched pieces above. Use garments that complement the reference's color and silhouette logic. Each outfit needs at minimum a top, bottom, and footwear.`;
      try {
        const raw = await minimaxChat(
          [
            { role: "system", content: OUTFIT_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          { jsonMode: true, maxTokens: 1500, temperature: 0.6 },
        );
        const validated = OutfitResponseSchema.safeParse(parseJsonSafe(raw));
        if (validated.success) {
          const validIds = new Set(closet.map((g) => g.id));
          suggestedOutfit = {
            outfits: validated.data.outfits
              .map((o) => ({
                ...o,
                garments: o.garments.filter((gi) =>
                  validIds.has(gi.garment_id),
                ),
              }))
              .filter((o) => o.garments.length >= 2)
              .slice(0, 2),
            notes: validated.data.notes,
          };
        }
      } catch (err) {
        console.warn("LLM recreation failed:", err);
      }
    }

    // Coverage score: fraction of reference items that have a match
    const coverage = detected.length === 0 ? 0 : have.length / detected.length;

    return NextResponse.json({
      matches,
      coverage,
      suggested_outfit: suggestedOutfit,
      closet_summary: summarizeForLLM(closet),
    });
  } catch (error) {
    console.error("[/api/ai/recreate-reference]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
