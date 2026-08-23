import { z } from "zod";

// =====================================================
// AI response schemas (Zod) — validated responses from MiniMax
// =====================================================

export const GARMENT_CATEGORIES = [
  "top",
  "bottom",
  "outerwear",
  "footwear",
  "accessory",
] as const;

export const TOP_SUBCATEGORIES = [
  "heavyweight_tee",
  "tee",
  "polo",
  "shirt",
  "tank",
  "sweatshirt",
  "hoodie",
  "sweater",
  "cardigan",
  "long_sleeve",
] as const;

export const BOTTOM_SUBCATEGORIES = [
  "jeans",
  "chino",
  "fatigue_pants",
  "cargo_pants",
  "trousers",
  "shorts",
  "joggers",
] as const;

export const OUTERWEAR_SUBCATEGORIES = [
  "chore_jacket",
  "denim_jacket",
  "bomber",
  "blazer",
  "coat",
  "parka",
  "trucker_jacket",
  "overshirt",
] as const;

export const FOOTWEAR_SUBCATEGORIES = [
  "jordan_retro",
  "dunk",
  "air_force",
  "air_max",
  "new_balance",
  "converse",
  "adidas",
  "loafer",
  "boot",
  "sandal",
] as const;

export const ACCESSORY_SUBCATEGORIES = [
  "cap",
  "hat",
  "beanie",
  "sunglasses",
  "glasses",
  "watch",
  "bracelet",
  "necklace",
  "belt",
  "bag",
  "backpack",
  "bandana",
  "scarf",
  "ring",
  "earring",
] as const;

export const TOP_FITS = [
  "slim",
  "regular",
  "relaxed",
  "boxy",
  "oversized",
  "cropped",
  "longline",
] as const;

export const BOTTOM_FITS = [
  "skinny",
  "slim",
  "straight",
  "relaxed",
  "wide",
  "tapered",
  "cropped",
] as const;

export const PATTERNS = [
  "solid",
  "stripe",
  "plaid",
  "graphic",
  "camo",
  "floral",
  "abstract",
  "check",
  "houndstooth",
  "denim",
] as const;

export const MATERIALS = [
  "cotton",
  "denim",
  "wool",
  "leather",
  "suede",
  "nylon",
  "linen",
  "polyester",
  "silk",
  "cashmere",
  "corduroy",
  "canvas",
] as const;

export const FORMALITY_LEVELS = [0, 1, 2, 3, 4, 5] as const;

export const COLOR_FAMILIES = [
  "black",
  "white",
  "grey",
  "navy",
  "blue",
  "olive",
  "green",
  "red",
  "burgundy",
  "brown",
  "tan",
  "beige",
  "ecru",
  "yellow",
  "orange",
  "purple",
  "pink",
  "multicolor",
] as const;

export const STYLE_TAGS = [
  "amekaji",
  "cityboy",
  "ivy",
  "workwear",
  "military",
  "streetwear",
  "minimal",
  "creative_executive",
  "casual",
  "smart_casual",
  "vintage",
  "japanese",
  "denim",
  "sneakerhead",
  "monochrome",
  "earth_tones",
] as const;

// Helper: normalize Gemini's free-text category into our canonical 5.
// Gemini often returns things like "shirt", "tee", "tshirt" for category,
// but our schema only knows "top". Map common synonyms here.
function normalizeCategory(input: string): (typeof GARMENT_CATEGORIES)[number] {
  const v = (input ?? "").toLowerCase().trim();
  if (!v) return "top";
  // Exact match
  if ((GARMENT_CATEGORIES as readonly string[]).includes(v)) {
    return v as (typeof GARMENT_CATEGORIES)[number];
  }
  // Synonym map
  const synonyms: Record<string, (typeof GARMENT_CATEGORIES)[number]> = {
    shirt: "top",
    tshirt: "top",
    "t-shirt": "top",
    tee: "top",
    sweater: "top",
    hoodie: "top",
    pants: "bottom",
    trousers: "bottom",
    jeans: "bottom",
    shorts: "bottom",
    coat: "outerwear",
    jacket: "outerwear",
    shoes: "footwear",
    sneakers: "footwear",
    boots: "footwear",
    hat: "accessory",
    belt: "accessory",
    bag: "accessory",
    watch: "accessory",
  };
  return synonyms[v] ?? "top";
}

function normalizeKind(input: string): "garment" | "sneaker" | "accessory" {
  const v = (input ?? "").toLowerCase().trim();
  if (v === "garment" || v === "sneaker" || v === "accessory") return v;
  // Sneakers are technically footwear but we want them classified as
  // their own kind for the sneaker-specific UI in the closet.
  if (v.includes("sneaker") || v.includes("shoe")) return "sneaker";
  if (v.includes("accessory") || v.includes("watch") || v.includes("belt")) return "accessory";
  return "garment";
}

function normalizeFormality(input: unknown): number {
  const n = typeof input === "number" ? input : parseFloat(String(input));
  if (Number.isFinite(n)) return Math.max(0, Math.min(5, Math.round(n)));
  return 2;
}

const VALID_SEASONS = ["spring", "summer", "fall", "winter", "all"] as const;

function normalizeSeasons(input: unknown): Array<(typeof VALID_SEASONS)[number]> {
  if (!Array.isArray(input)) return [];
  const result: Array<(typeof VALID_SEASONS)[number]> = [];
  for (const v of input) {
    const s = String(v ?? "").toLowerCase().trim();
    if ((VALID_SEASONS as readonly string[]).includes(s)) {
      result.push(s as (typeof VALID_SEASONS)[number]);
    }
  }
  return result;
}

// Permissive schema — accept any string from Gemini and normalize later.
// We use defaults everywhere so even a partial/empty response still
// validates. Gemini 2.5 occasionally returns values outside our enum
// (e.g., "polka_dot", "shirt" for category, "springtime" for season)
// and Zod's strict enums were rejecting the whole response.
export const RecognizedGarmentSchema = z
  .object({
    kind: z.string().default("garment"),
    category: z.string().default("top"),
    subcategory: z.string().default(""),
    fit: z.string().nullable().default(null),
    primary_color: z.string().default("unknown"),
    secondary_colors: z.array(z.string()).default([]),
    pattern: z.string().default("solid"),
    material: z.string().nullable().default(null),
    seasons: z.array(z.string()).default([]),
    formality: z.union([z.number(), z.string()]).default(2),
    style_tags: z.array(z.string()).default([]),
    brand_guess: z.string().nullable().default(null),
    sneaker: z
      .object({
        model_guess: z.string().nullable().optional(),
        colorway: z.string().nullable().optional(),
        silhouette: z.string().nullable().optional(),
        prominence: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    confidence_notes: z.string().nullable().default(null),
  })
  // Normalize after parse — we still validate shape (it's an object with
  // strings/arrays) but map Gemini's free-text values to our canonical
  // enums below.
  .transform((data) => ({
    kind: normalizeKind(data.kind),
    category: normalizeCategory(data.category),
    subcategory: data.subcategory,
    fit: data.fit,
    primary_color: data.primary_color,
    secondary_colors: data.secondary_colors,
    pattern: data.pattern,
    material: data.material,
    seasons: normalizeSeasons(data.seasons),
    formality: normalizeFormality(data.formality),
    style_tags: data.style_tags,
    brand_guess: data.brand_guess,
    sneaker: data.sneaker
      ? {
          model_guess: data.sneaker.model_guess ?? null,
          colorway: data.sneaker.colorway ?? null,
          silhouette: data.sneaker.silhouette ?? null,
          prominence: data.sneaker.prominence
            ? (["neutral", "icon", "statement"].includes(
                String(data.sneaker.prominence),
              )
                ? (String(data.sneaker.prominence) as
                    | "neutral"
                    | "icon"
                    | "statement")
                : null)
            : null,
        }
      : null,
    confidence_notes: data.confidence_notes,
  }));

export type RecognizedGarment = z.infer<typeof RecognizedGarmentSchema>;

// =====================================================
// OUTFIT generation schema
// =====================================================

export const OutfitItemRefSchema = z.object({
  garment_id: z.string(),
  layer_role: z.enum(["top", "bottom", "layer", "footwear", "accessory"]),
});

export const OutfitSuggestionSchema = z.object({
  title: z.string(),
  garments: z.array(OutfitItemRefSchema).min(2).max(7),
  explanation: z.string(),
  formality: z.number().int().min(0).max(5),
});

export const OutfitResponseSchema = z.object({
  outfits: z.array(OutfitSuggestionSchema).min(1).max(4),
  notes: z.string().nullable(),
});

export type OutfitSuggestion = z.infer<typeof OutfitSuggestionSchema>;
export type OutfitResponse = z.infer<typeof OutfitResponseSchema>;

// =====================================================
// REFERENCE analysis schema
// =====================================================

export const ReferenceItemSchema = z.object({
  type: z.enum([
    "top",
    "bottom",
    "outerwear",
    "footwear",
    "accessory",
    "headwear",
  ]),
  color: z.string(),
  description: z.string(),
});

export const ReferenceAnalysisSchema = z.object({
  items: z.array(ReferenceItemSchema),
  overall_style: z.array(z.string()),
  pairing_logic: z.string(),
});

export type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;
