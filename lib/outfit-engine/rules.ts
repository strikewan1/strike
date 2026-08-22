// Outfit engine: local scoring rules that complement the LLM output.
// The LLM picks; this file scores & validates.

export interface ClosetItem {
  id: string;
  category: string;
  subcategory: string | null;
  fit: string | null;
  primary_color: string | null;
  secondary_colors: string[];
  formality: number | null;
  style_tags: string[];
  sneaker_prominence: string | null;
  wear_count: number;
  last_worn: string | null;
}

const NEUTRAL_PALETTE = new Set([
  "white",
  "black",
  "grey",
  "charcoal",
  "navy",
  "beige",
  "ecru",
  "cream",
  "tan",
  "brown",
  "olive",
  "khaki",
  "indigo",
]);

const EARTH_PALETTE = new Set([
  "olive",
  "brown",
  "tan",
  "beige",
  "ecru",
  "cream",
  "khaki",
  "mustard",
  "burgundy",
  "rust",
]);

const COMPLEMENTARY: Record<string, string[]> = {
  navy: ["white", "ecru", "beige", "tan", "cream", "grey", "burgundy"],
  white: ["navy", "black", "olive", "indigo", "brown", "tan", "burgundy"],
  black: ["white", "grey", "red", "olive", "tan"],
  grey: ["navy", "white", "black", "burgundy", "olive"],
  olive: ["white", "ecru", "navy", "tan", "cream", "black"],
  indigo: ["white", "ecru", "tan", "brown", "cream"],
  ecru: ["navy", "indigo", "olive", "brown", "black"],
  brown: ["white", "ecru", "navy", "olive", "tan"],
  beige: ["navy", "brown", "black", "white"],
  burgundy: ["white", "navy", "grey", "ecru", "olive"],
};

export function colorCompatibility(a: string | null, b: string | null): number {
  if (!a || !b) return 0.5;
  const an = a.toLowerCase();
  const bn = b.toLowerCase();

  if (an === bn) return 0.7; // monochrome / tonal

  // Look up explicit complementary pairs first — these are the strongest pairings
  const compA = COMPLEMENTARY[an];
  const compB = COMPLEMENTARY[bn];
  if (compA?.includes(bn) || compB?.includes(an)) return 1.0;

  if (NEUTRAL_PALETTE.has(an) || NEUTRAL_PALETTE.has(bn)) return 0.85;
  if (EARTH_PALETTE.has(an) && EARTH_PALETTE.has(bn)) return 0.9;

  return 0.5;
}

export function fitBalance(topFit: string | null, bottomFit: string | null): number {
  if (!topFit || !bottomFit) return 0.6;
  const slim = new Set(["slim", "skinny", "tapered"]);
  const relaxed = new Set(["relaxed", "wide", "straight", "regular"]);
  const oversized = new Set(["oversized", "boxy", "longline", "cropped"]);

  // Slim top + relaxed bottom = balanced
  if (slim.has(topFit) && relaxed.has(bottomFit)) return 1.0;
  if (relaxed.has(topFit) && slim.has(bottomFit)) return 0.9;
  if (slim.has(topFit) && slim.has(bottomFit)) return 0.7;
  if (relaxed.has(topFit) && relaxed.has(bottomFit)) return 0.85;
  if (oversized.has(topFit) && (slim.has(bottomFit) || relaxed.has(bottomFit))) return 0.95;
  if (relaxed.has(topFit) && oversized.has(bottomFit)) return 0.75;

  return 0.6;
}

export function formalityScore(items: ClosetItem[]): number {
  const formalities = items
    .map((i) => i.formality)
    .filter((f): f is number => f !== null);
  if (formalities.length === 0) return 0;
  const mean = formalities.reduce((a, b) => a + b, 0) / formalities.length;
  const variance =
    formalities.reduce((sum, f) => sum + (f - mean) ** 2, 0) /
    formalities.length;
  // High variance = mismatch; ideal variance < 1.5
  return Math.max(0, 1 - variance / 4);
}

export function rotationPenalty(item: ClosetItem): number {
  if (item.wear_count === 0) return 0.1; // encourage trying new things
  if (!item.last_worn) return 0;
  const days = Math.floor(
    (Date.now() - new Date(item.last_worn).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 2) return 0.5; // worn recently
  if (days < 7) return 0.2;
  return 0;
}

// Required slots for a complete outfit
export const REQUIRED_SLOTS = {
  top: ["top"],
  bottom: ["bottom"],
};
export const OPTIONAL_SLOTS = {
  layer: ["outerwear"],
  footwear: ["footwear"],
  accessory: ["accessory"],
};

export function isValidOutfit(items: ClosetItem[]): boolean {
  const categories = items.map((i) => i.category);
  return categories.includes("top") && categories.includes("bottom");
}

export function summarizeForLLM(items: ClosetItem[]) {
  return items.map((i) => ({
    id: i.id,
    category: i.category,
    subcategory: i.subcategory,
    fit: i.fit,
    color: i.primary_color,
    secondary: i.secondary_colors,
    formality: i.formality,
    tags: i.style_tags,
    prominence: i.sneaker_prominence,
    wear_count: i.wear_count,
    last_worn: i.last_worn,
  }));
}
