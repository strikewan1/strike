// Database types for Supabase. Hand-maintained to match migrations.
// In production you'd generate these with `supabase gen types typescript`.

export type GarmentKind = "garment" | "sneaker" | "accessory";

export type WardrobeStatus =
  | "unrated"
  | "core"
  | "useful"
  | "special"
  | "question"
  | "exit";

export type SneakerProminence = "neutral" | "icon" | "statement";

export type Season = "spring" | "summer" | "fall" | "winter" | "all";

export type LayerRole = "top" | "bottom" | "layer" | "footwear" | "accessory";

export type FitRating = "love" | "works" | "meh" | "fail";

export type WishlistStatus =
  | "inspiration"
  | "maybe"
  | "priority"
  | "dismissed"
  | "bought";

export interface Profile {
  id: string;
  display_name: string | null;
  style_dna: {
    preset: string;
    customizations?: Record<string, unknown>;
  };
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BodyProfile {
  user_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  top_size: string | null;
  bottom_size: string | null;
  shoe_size: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  shoulders_cm: number | null;
  inseam_cm: number | null;
  photo_front_url: string | null;
  photo_side_url: string | null;
  photo_full_url: string | null;
  updated_at: string;
}

export interface Garment {
  id: string;
  user_id: string;
  kind: GarmentKind;
  original_image_url: string;
  cleaned_image_url: string | null;
  category: string;
  subcategory: string | null;
  fit: string | null;
  primary_color: string | null;
  secondary_colors: string[];
  pattern: string | null;
  material: string | null;
  seasons: Season[];
  formality: number | null;
  style_tags: string[];
  brand: string | null;
  size: string | null;
  sneaker_model: string | null;
  sneaker_colorway: string | null;
  sneaker_silhouette: string | null;
  sneaker_prominence: SneakerProminence | null;
  wardrobe_status: WardrobeStatus;
  style_score: number | null;
  style_score_reasons: string[];
  wear_count: number;
  last_worn: string | null;
  favorite: boolean;
  archived: boolean;
  notes: string | null;
  ai_recognized: boolean;
  ai_confidence: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  title: string | null;
  occasion: string | null;
  context_text: string | null;
  formality: number | null;
  sneaker_id: string | null;
  weather: { temp?: number; conditions?: string } | null;
  explanation: string | null;
  ai_generated: boolean;
  planned_for: string | null;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  garment_id: string;
  layer_role: LayerRole;
  slot_order: number;
}

export interface WearHistory {
  id: string;
  user_id: string;
  outfit_id: string | null;
  garment_ids: string[];
  occasion: string | null;
  context: string | null;
  worn_on: string;
  created_at: string;
}

export interface FitCheck {
  id: string;
  user_id: string;
  outfit_id: string | null;
  photo_url: string | null;
  rating: FitRating;
  context: string | null;
  taken_at: string;
  created_at: string;
}

export interface OutfitReference {
  id: string;
  user_id: string;
  image_url: string;
  source_url: string | null;
  title: string | null;
  detected_items: unknown | null;
  style_tags: string[];
  notes: string | null;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  reference_id: string | null;
  garment_id: string | null;
  image_url: string | null;
  description: string | null;
  status: WishlistStatus;
  closet_duplicate_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StylePreferences {
  user_id: string;
  prefs: {
    prefers_relaxed_over_slim?: boolean;
    top_sneakers?: string[];
    top_combos?: Array<{ items: string[]; rating: FitRating }>;
    avoid_long_layering?: boolean;
    favorite_categories?: string[];
    favorite_colors?: string[];
    [key: string]: unknown;
  };
  updated_at: string;
}

// Insert types (omit server-managed fields)
export type GarmentInsert = Omit<
  Garment,
  "id" | "created_at" | "updated_at" | "wear_count" | "last_worn"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  wear_count?: number;
  last_worn?: string | null;
};

export type OutfitInsert = Omit<
  Outfit,
  "id" | "created_at"
> & {
  id?: string;
  created_at?: string;
};

export type OutfitItemInsert = Omit<OutfitItem, "id"> & { id?: string };
