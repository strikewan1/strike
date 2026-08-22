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

export const RecognizedGarmentSchema = z.object({
  kind: z.enum(["garment", "sneaker", "accessory"]),
  category: z.enum(GARMENT_CATEGORIES),
  subcategory: z.string(),
  fit: z.string().nullable(),
  primary_color: z.string(),
  secondary_colors: z.array(z.string()).default([]),
  pattern: z.enum(PATTERNS).default("solid"),
  material: z.enum(MATERIALS).nullable(),
  seasons: z.array(
    z.enum(["spring", "summer", "fall", "winter", "all"]),
  ),
  formality: z.number().int().min(0).max(5),
  style_tags: z.array(z.string()).default([]),
  brand_guess: z.string().nullable(),
  sneaker: z
    .object({
      model_guess: z.string().nullable(),
      colorway: z.string().nullable(),
      silhouette: z.string().nullable(),
      prominence: z.enum(["neutral", "icon", "statement"]).nullable(),
    })
    .nullable(),
  confidence_notes: z.string().nullable(),
});

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
