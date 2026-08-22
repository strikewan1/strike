-- =====================================================
-- STRIKE — Wardrobe Intelligence
-- Initial schema migration
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE garment_kind AS ENUM ('garment', 'sneaker', 'accessory');

CREATE TYPE wardrobe_status AS ENUM (
  'unrated',
  'core',
  'useful',
  'special',
  'question',
  'exit'
);

CREATE TYPE sneaker_prominence AS ENUM ('neutral', 'icon', 'statement');

CREATE TYPE season AS ENUM ('spring', 'summer', 'fall', 'winter', 'all');

CREATE TYPE layer_role AS ENUM ('top', 'bottom', 'layer', 'footwear', 'accessory');

CREATE TYPE fit_rating AS ENUM ('love', 'works', 'meh', 'fail');

CREATE TYPE wishlist_status AS ENUM (
  'inspiration',
  'maybe',
  'priority',
  'dismissed',
  'bought'
);

-- =====================================================
-- PROFILES — extends auth.users
-- =====================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  style_dna JSONB NOT NULL DEFAULT '{"preset":"creative_amekaji_executive"}'::jsonb,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- BODY PROFILE
-- =====================================================

CREATE TABLE body_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  top_size TEXT,
  bottom_size TEXT,
  shoe_size NUMERIC(4,1),
  waist_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  shoulders_cm NUMERIC(5,1),
  inseam_cm NUMERIC(5,1),
  photo_front_url TEXT,
  photo_side_url TEXT,
  photo_full_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- GARMENTS — unified table for clothes, sneakers, accessories
-- =====================================================

CREATE TABLE garments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind garment_kind NOT NULL DEFAULT 'garment',

  -- Images
  original_image_url TEXT NOT NULL,
  cleaned_image_url TEXT,

  -- Classification
  category TEXT NOT NULL, -- e.g. 'top', 'bottom', 'footwear', 'outerwear', 'accessory'
  subcategory TEXT, -- e.g. 'polo', 'fatigue_pants', 'jordan_retro'
  fit TEXT, -- 'slim','regular','relaxed','boxy','oversized','straight','tapered','wide','cropped'

  -- Colors
  primary_color TEXT,
  secondary_colors TEXT[] DEFAULT '{}',
  pattern TEXT, -- 'solid','stripe','plaid','graphic','camo','floral','abstract'

  -- Material & season
  material TEXT, -- 'cotton','denim','wool','leather','nylon','linen','polyester'
  seasons season[] DEFAULT '{}',
  formality SMALLINT CHECK (formality BETWEEN 0 AND 5), -- 0=very casual, 5=very formal

  -- Brand & size
  brand TEXT,
  size TEXT,

  -- Style tags
  style_tags TEXT[] DEFAULT '{}',

  -- Sneaker-specific
  sneaker_model TEXT,
  sneaker_colorway TEXT,
  sneaker_silhouette TEXT,
  sneaker_prominence sneaker_prominence,

  -- Audit & scoring (computed progressively)
  wardrobe_status wardrobe_status NOT NULL DEFAULT 'unrated',
  style_score SMALLINT CHECK (style_score BETWEEN 0 AND 100),
  style_score_reasons TEXT[] DEFAULT '{}',

  -- Usage tracking
  wear_count INTEGER NOT NULL DEFAULT 0,
  last_worn DATE,

  -- User flags
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,

  -- AI provenance
  ai_recognized BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for closet queries
CREATE INDEX idx_garments_user_kind ON garments(user_id, kind);
CREATE INDEX idx_garments_user_category ON garments(user_id, category);
CREATE INDEX idx_garments_user_archived ON garments(user_id, archived);
CREATE INDEX idx_garments_user_favorite ON garments(user_id, favorite);
CREATE INDEX idx_garments_tags ON garments USING GIN (style_tags);
CREATE INDEX idx_garments_colors ON garments USING GIN (secondary_colors);
CREATE INDEX idx_garments_brand_trgm ON garments USING GIN (brand gin_trgm_ops);
CREATE INDEX idx_garments_subcategory_trgm ON garments USING GIN (subcategory gin_trgm_ops);

-- =====================================================
-- AI CACHE — dedupe recognition calls
-- =====================================================

CREATE TABLE ai_cache (
  image_hash TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- OUTFIT_REFERENCES — inspiration (separate from closet)
-- Note: was originally `references` but renamed to avoid PostgreSQL
-- reserved-word conflict and to be more semantically explicit.
-- =====================================================

CREATE TABLE outfit_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  detected_items JSONB,
  style_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outfit_references_user ON outfit_references(user_id);

-- =====================================================
-- OUTFITS — generated or manually created
-- =====================================================

CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  occasion TEXT,
  context_text TEXT,
  formality SMALLINT,
  sneaker_id UUID REFERENCES garments(id) ON DELETE SET NULL,
  weather JSONB,
  explanation TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  planned_for DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outfits_user ON outfits(user_id);
CREATE INDEX idx_outfits_planned ON outfits(user_id, planned_for DESC);

-- =====================================================
-- OUTFIT ITEMS — many-to-many with role
-- =====================================================

CREATE TABLE outfit_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  layer_role layer_role NOT NULL,
  slot_order SMALLINT NOT NULL DEFAULT 0,
  UNIQUE(outfit_id, garment_id)
);

CREATE INDEX idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_garment ON outfit_items(garment_id);

-- =====================================================
-- WEAR HISTORY — outfits actually worn
-- =====================================================

CREATE TABLE wear_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id) ON DELETE SET NULL,
  garment_ids UUID[] NOT NULL DEFAULT '{}',
  occasion TEXT,
  context TEXT,
  worn_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wear_history_user_date ON wear_history(user_id, worn_on DESC);
CREATE INDEX idx_wear_history_garments ON wear_history USING GIN (garment_ids);

-- =====================================================
-- FIT CHECKS — real photo + rating
-- =====================================================

CREATE TABLE fit_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id) ON DELETE SET NULL,
  photo_url TEXT,
  rating fit_rating NOT NULL,
  context TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fit_checks_user ON fit_checks(user_id, taken_at DESC);

-- =====================================================
-- STYLE PREFERENCES — derived from feedback
-- =====================================================

CREATE TABLE style_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- WISHLIST
-- =====================================================

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference_id UUID REFERENCES outfit_references(id) ON DELETE SET NULL,
  garment_id UUID REFERENCES garments(id) ON DELETE SET NULL,
  image_url TEXT,
  description TEXT,
  status wishlist_status NOT NULL DEFAULT 'inspiration',
  closet_duplicate_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wishlist_user_status ON wishlist_items(user_id, status);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_body_profiles_updated_at
  BEFORE UPDATE ON body_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_garments_updated_at
  BEFORE UPDATE ON garments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_wishlist_updated_at
  BEFORE UPDATE ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =====================================================
-- PROFILE AUTO-CREATE on signup
-- =====================================================
-- Note: `SET search_path = public, pg_temp` is REQUIRED so that INSERT
-- statements resolve to the `public` schema when the trigger fires from
-- `auth.users`. Without this, Supabase's restricted search_path causes
-- "relation profiles does not exist" because the function looks in the
-- `auth` schema first.
-- Also: all table references are schema-qualified (`public.profiles`) as
-- belt-and-suspenders for the same reason.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.style_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Explicit ownership ensures bypass-RLS when inserting into profiles.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wear_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fit_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Helper: policies are symmetric (SELECT/INSERT/UPDATE/DELETE == own user_id)
CREATE POLICY "own_profiles" ON profiles FOR ALL
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "own_body_profiles" ON body_profiles FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_garments" ON garments FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_outfit_references" ON outfit_references FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_outfits" ON outfits FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_outfit_items" ON outfit_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM outfits o
      WHERE o.id = outfit_items.outfit_id AND o.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfits o
      WHERE o.id = outfit_items.outfit_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "own_wear_history" ON wear_history FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_fit_checks" ON fit_checks FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_style_preferences" ON style_preferences FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_wishlist" ON wishlist_items FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ai_cache is server-managed; no client policies (RLS off)
ALTER TABLE ai_cache DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- GRANTS — supabase_auth_admin needs schema/table/function access
-- to execute triggers and insert into public.* tables during auth flows.
-- Without these, the handle_new_user trigger fails with
-- "permission denied for table profiles".
-- =====================================================

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
-- These are created via Supabase Storage UI or migration helper.
-- Required buckets:
--   - garments (private)
--   - body-photos (private)
--   - references (private)
--   - fit-checks (private)
-- =====================================================
