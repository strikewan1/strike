import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  outfitId: z.string().uuid(),
  rating: z.enum(["love", "works", "meh", "fail"]),
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

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body" },
        { status: 400 },
      );
    }

    const { outfitId, rating } = parsed.data;

    // Fetch outfit's garments
    const { data: outfit } = await supabase
      .from("outfits")
      .select(
        `outfit_items(garment_id, garments(category, fit, subcategory, style_tags))`,
      )
      .eq("id", outfitId)
      .eq("user_id", user.id)
      .single();

    if (!outfit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch existing prefs
    const { data: existing } = await supabase
      .from("style_preferences")
      .select("prefs")
      .eq("user_id", user.id)
      .maybeSingle();

    const prefs = (existing?.prefs as Record<string, unknown>) ?? {};

    // Aggregate signals from this outfit
    const items =
      (outfit.outfit_items as unknown as Array<{
        garment_id: string;
        garments: {
          category: string;
          fit: string | null;
          subcategory: string | null;
          style_tags: string[];
        } | null;
      }>) ?? [];

    const fitCount: Record<string, { positive: number; negative: number }> = (
      prefs.fit_count as Record<string, { positive: number; negative: number }>
    ) ?? {};
    const tagCount: Record<string, { positive: number; negative: number }> = (
      prefs.tag_count as Record<string, { positive: number; negative: number }>
    ) ?? {};
    const comboRatings = (prefs.combo_ratings as Array<{
      items: string[];
      rating: string;
      at: string;
    }>) ?? [];

    const isPositive = rating === "love";
    const isNegative = rating === "fail";

    for (const item of items) {
      const g = item.garments;
      if (!g) continue;
      if (g.fit) {
        fitCount[g.fit] ??= { positive: 0, negative: 0 };
        if (isPositive) fitCount[g.fit].positive++;
        if (isNegative) fitCount[g.fit].negative++;
      }
      for (const tag of g.style_tags ?? []) {
        tagCount[tag] ??= { positive: 0, negative: 0 };
        if (isPositive) tagCount[tag].positive++;
        if (isNegative) tagCount[tag].negative++;
      }
    }

    comboRatings.push({
      items: items.map((i) => i.garment_id),
      rating,
      at: new Date().toISOString(),
    });
    // Keep last 50
    while (comboRatings.length > 50) comboRatings.shift();

    // Derive simple preferences
    const prefersRelaxed =
      (fitCount.relaxed?.positive ?? 0) > (fitCount.slim?.positive ?? 0) + 2;

    const updated = {
      ...prefs,
      fit_count: fitCount,
      tag_count: tagCount,
      combo_ratings: comboRatings,
      prefers_relaxed_over_slim: prefersRelaxed,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("style_preferences")
      .upsert({ user_id: user.id, prefs: updated });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/style/update-from-feedback]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
