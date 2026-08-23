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

// =========================================================================
// Extractors — duck-type Gemini's free-form output into our shape.
// Gemini often returns fields with different names (e.g. colors.primary,
// brand, neckline, sleeve_length). We search a list of synonyms and
// fall back to defaults. Each extractor is total: never throws, always
// returns a value compatible with the rest of the system.
// =========================================================================

const COLOR_SYNONYMS = [
  "primary_color", "primaryColor", "primary",
  "color", "colour", "main_color",
];
const SECONDARY_COLOR_SYNONYMS = [
  "secondary_colors", "secondaryColors", "secondary",
  "colors_secondary", "secondary_color",
];
const ACCENT_COLOR_SYNONYMS = [
  "accents", "accent_colors", "color_accents",
  "highlights", "trim_colors",
];

function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function nested(obj: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in (cur as object)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

function findBySynonyms(
  obj: Record<string, unknown>,
  synonyms: string[],
): unknown {
  for (const s of synonyms) {
    // Try top-level
    if (s in obj) return obj[s];
    // Try nested (e.g. "colors.primary" → nested path)
    const parts = s.split(".");
    if (parts.length > 1) {
      const v = nested(obj, parts);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

// =========================================================================
// Per-field extractors
// =========================================================================

function extractKind(raw: Record<string, unknown>): "garment" | "sneaker" | "accessory" {
  const v = (firstString(raw.kind, raw.type) ?? "").toLowerCase().trim();
  if (v === "garment" || v === "sneaker" || v === "accessory") return v;
  if (v.includes("sneaker") || v.includes("shoe")) return "sneaker";
  if (v.includes("accessory") || v.includes("watch") || v.includes("belt") || v.includes("hat")) return "accessory";
  // Heuristic: if a sneaker_* field is populated, assume sneaker
  for (const key of Object.keys(raw)) {
    if (key.toLowerCase().includes("sneaker")) return "sneaker";
  }
  return "garment";
}

function extractCategory(raw: Record<string, unknown>): (typeof GARMENT_CATEGORIES)[number] {
  const v = (
    firstString(raw.category, raw.cat) ?? ""
  ).toLowerCase().trim();
  if ((GARMENT_CATEGORIES as readonly string[]).includes(v)) {
    return v as (typeof GARMENT_CATEGORIES)[number];
  }
  const synonyms: Record<string, (typeof GARMENT_CATEGORIES)[number]> = {
    tops: "top", top: "top",
    shirt: "top", tshirt: "top", "t-shirt": "top", tee: "top",
    polo: "top", sweater: "top", hoodie: "top",
    bottoms: "bottom", bottom: "bottom",
    pants: "bottom", trousers: "bottom", jeans: "bottom", shorts: "bottom",
    coat: "outerwear", jacket: "outerwear",
    shoes: "footwear", sneakers: "footwear", boots: "footwear",
    hat: "accessory", belt: "accessory", bag: "accessory", watch: "accessory",
  };
  return synonyms[v] ?? "top";
}

function extractSubcategory(raw: Record<string, unknown>): string {
  const v = firstString(raw.subcategory, raw.sub_cat, raw.subtype, raw.item_type);
  if (v) return v;
  // If Gemini provided specific descriptors, fold them in
  const parts = [
    firstString(raw.neckline),
    firstString(raw.sleeve_length, raw.sleeves),
    firstString(raw.style, raw.silhouette),
  ].filter(Boolean);
  return parts.join(", ");
}

const FIT_KEYS = ["fit", "silhouette", "cut"];

function extractFit(raw: Record<string, unknown>): string | null {
  return firstString(...FIT_KEYS.map((k) => raw[k]));
}

function extractPrimaryColor(raw: Record<string, unknown>): string {
  // Try top-level first, then nested "colors.primary"
  const top = firstString(...COLOR_SYNONYMS.map((s) => raw[s]));
  if (top) return top;
  // Try nested colors object
  const colors = raw.colors;
  if (colors && typeof colors === "object") {
    const primary = (colors as Record<string, unknown>).primary;
    if (typeof primary === "string") return primary;
  }
  // Try colors as an array (e.g. ["blue", "white"])
  if (Array.isArray(raw.colors) && raw.colors.length > 0) {
    const first = raw.colors[0];
    if (typeof first === "string") return first;
  }
  return "unknown";
}

function extractSecondaryColors(raw: Record<string, unknown>): string[] {
  const result: string[] = [];

  // Top-level secondary_colors / colors
  const top = findBySynonyms(raw, SECONDARY_COLOR_SYNONYMS);
  if (Array.isArray(top)) {
    for (const c of top) {
      if (typeof c === "string") result.push(c);
    }
  } else if (typeof top === "string") {
    result.push(top);
  }

  // Nested colors.secondary (string or array)
  const colors = raw.colors;
  if (colors && typeof colors === "object" && !Array.isArray(colors)) {
    const sec = (colors as Record<string, unknown>).secondary;
    if (typeof sec === "string") {
      if (!result.includes(sec)) result.push(sec);
    } else if (Array.isArray(sec)) {
      for (const c of sec) {
        if (typeof c === "string" && !result.includes(c)) result.push(c);
      }
    }
  }

  // Nested colors.accents (array)
  const accents = findBySynonyms(raw, ACCENT_COLOR_SYNONYMS);
  if (Array.isArray(accents)) {
    for (const c of accents) {
      if (typeof c === "string" && !result.includes(c)) result.push(c);
    }
  } else if (typeof accents === "string" && !result.includes(accents)) {
    result.push(accents);
  }

  // colors array (after first element = primary)
  if (Array.isArray(raw.colors) && raw.colors.length > 1) {
    for (let i = 1; i < raw.colors.length; i++) {
      const c = raw.colors[i];
      if (typeof c === "string" && !result.includes(c)) result.push(c);
    }
  }

  return result;
}

const PATTERN_KEYS = ["pattern", "print", "motif"];

function extractPattern(raw: Record<string, unknown>): string {
  return firstString(...PATTERN_KEYS.map((k) => raw[k])) ?? "solid";
}

const MATERIAL_KEYS = ["material", "fabric", "composition"];

function extractMaterial(raw: Record<string, unknown>): string | null {
  return firstString(...MATERIAL_KEYS.map((k) => raw[k]));
}

const SEASON_KEYS = ["seasons", "season"];
const VALID_SEASONS = ["spring", "summer", "fall", "winter", "all"] as const;

function extractSeasons(raw: Record<string, unknown>): Array<(typeof VALID_SEASONS)[number]> {
  const result: Array<(typeof VALID_SEASONS)[number]> = [];
  for (const key of SEASON_KEYS) {
    const v = raw[key];
    if (Array.isArray(v)) {
      for (const s of v) {
        const sl = String(s ?? "").toLowerCase().trim();
        if (
          (VALID_SEASONS as readonly string[]).includes(sl) &&
          !result.includes(sl as (typeof VALID_SEASONS)[number])
        ) {
          result.push(sl as (typeof VALID_SEASONS)[number]);
        }
      }
    } else if (typeof v === "string") {
      const sl = v.toLowerCase().trim();
      if (
        (VALID_SEASONS as readonly string[]).includes(sl) &&
        !result.includes(sl as (typeof VALID_SEASONS)[number])
      ) {
        result.push(sl as (typeof VALID_SEASONS)[number]);
      }
    }
  }
  return result;
}

function extractFormality(raw: Record<string, unknown>): number {
  const v = raw.formality ?? raw.formality_level;
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (Number.isFinite(n)) return Math.max(0, Math.min(5, Math.round(n)));
  return 2;
}

const STYLE_TAGS_KEYS = ["style_tags", "styles", "vibes", "aesthetic"];
const STYLE_TAGS_SYNONYMS: Record<string, string[]> = {
  amekaji: ["amekaji", "Japanese Americana"],
  workwear: ["workwear"],
  ivy: ["ivy", "ivy_league", "preppy"],
  cityboy: ["cityboy", "japanese streetwear"],
  japanese: ["japanese", "japanese_streetwear"],
  streetwear: ["streetwear"],
  minimal: ["minimal", "minimalist"],
  casual: ["casual"],
  smart_casual: ["smart_casual"],
  creative_executive: ["creative_executive", "executive"],
  sneakerhead: ["sneakerhead"],
  military: ["military"],
  denim: ["denim"],
  vintage: ["vintage"],
  monochrome: ["monochrome"],
};

function extractStyleTags(raw: Record<string, unknown>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const tryPush = (s: string) => {
    const norm = s.toLowerCase().trim().replace(/\s+/g, "_");
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  };

  for (const key of STYLE_TAGS_KEYS) {
    const v = raw[key];
    if (Array.isArray(v)) {
      for (const t of v) {
        if (typeof t === "string") tryPush(t);
      }
    } else if (typeof v === "string") {
      tryPush(v);
    }
  }
  // Reverse-match: if any of our canonical tags appears as substring in
  // any string field, add it.
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (typeof v !== "string") continue;
    const lower = v.toLowerCase();
    for (const [canonical, synonyms] of Object.entries(STYLE_TAGS_SYNONYMS)) {
      if (synonyms.some((s) => lower.includes(s))) {
        tryPush(canonical);
      }
    }
  }
  return result;
}

function extractBrandGuess(raw: Record<string, unknown>): string | null {
  return firstString(
    raw.brand_guess,
    raw.brand,
    raw.brand_name,
    raw.label,
  );
}

function extractConfidenceNotes(raw: Record<string, unknown>): string | null {
  return firstString(
    raw.confidence_notes,
    raw.notes,
    raw.comment,
    raw.reasoning,
  );
}

const SNEAKER_PROMINENCE_VALID = ["neutral", "icon", "statement"] as const;
type SneakerProminence = (typeof SNEAKER_PROMINENCE_VALID)[number];

function extractSneaker(raw: Record<string, unknown>): {
  model_guess: string | null;
  colorway: string | null;
  silhouette: string | null;
  prominence: SneakerProminence | null;
} | null {
  const modelGuess = firstString(
    raw.sneaker_model,
    raw.sneaker_model_guess,
    raw.sneaker_silhouette,
    raw.silhouette_model,
    raw.model,
  );
  const colorway = firstString(
    raw.colorway,
    raw.sneaker_colorway,
    raw.colors && typeof raw.colors === "object" && !Array.isArray(raw.colors)
      ? (raw.colors as Record<string, unknown>).way
      : undefined,
  );
  const silhouette = firstString(
    raw.silhouette,
    raw.sneaker_silhouette,
    raw.shoe_silhouette,
  );
  let prominence: SneakerProminence | null = null;
  const p = firstString(
    raw.prominence,
    raw.sneaker_prominence,
    raw.statement_level,
  );
  if (p && (SNEAKER_PROMINENCE_VALID as readonly string[]).includes(p.toLowerCase() as SneakerProminence)) {
    prominence = p.toLowerCase() as SneakerProminence;
  }
  // Return null if no sneaker info at all
  if (!modelGuess && !colorway && !silhouette && !prominence) return null;
  return {
    model_guess: modelGuess,
    colorway,
    silhouette,
    prominence,
  };
}

// Catch-all schema — Gemini ignores our prompt's field names and
// invents its own (it returned colors.primary/secondary/accents
// instead of primary_color/secondary_colors, "tops" instead of "top",
// brand instead of brand_guess, etc.). Instead of fighting the model,
// we accept ANY object and extract what we need via duck-typing
// helpers below. Every field has a safe default; the user can correct
// in the confirm step. The schema NEVER throws — at worst it returns
// a sensible fallback.
//
// The result is a normalized garment object ready to save to Supabase.
export const RecognizedGarmentSchema = z
  .record(z.string(), z.unknown())
  .transform((raw) => ({
    kind: extractKind(raw),
    category: extractCategory(raw),
    subcategory: extractSubcategory(raw),
    fit: extractFit(raw),
    primary_color: extractPrimaryColor(raw),
    secondary_colors: extractSecondaryColors(raw),
    pattern: extractPattern(raw),
    material: extractMaterial(raw),
    seasons: extractSeasons(raw),
    formality: extractFormality(raw),
    style_tags: extractStyleTags(raw),
    brand_guess: extractBrandGuess(raw),
    sneaker: extractSneaker(raw),
    confidence_notes: extractConfidenceNotes(raw),
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
