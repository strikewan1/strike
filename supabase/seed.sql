-- =====================================================
-- STRIKE — Seed data for development
-- Run AFTER migrations. Use a test user id.
-- =====================================================

-- IMPORTANT: Replace with your actual test user id from auth.users
\set test_user_id '''00000000-0000-0000-0000-000000000000'''

INSERT INTO body_profiles (
  user_id, height_cm, weight_kg, top_size, bottom_size, shoe_size,
  waist_cm, chest_cm, shoulders_cm, inseam_cm
) VALUES (
  :test_user_id, 178, 74, 'M', '30', 10,
  82, 98, 46, 80
) ON CONFLICT (user_id) DO NOTHING;

-- Example garments (Creative Amekaji Executive starter pack)
INSERT INTO garments (user_id, kind, category, subcategory, fit, primary_color, secondary_colors, pattern, material, seasons, formality, style_tags, brand, wardrobe_status, favorite, cleaned_image_url)
VALUES
  (:test_user_id, 'garment', 'top', 'heavyweight_tee', 'boxy', 'white', '{}', 'solid', 'cotton', ARRAY['spring','summer','fall'], 1, ARRAY['amekaji','minimal','casual'], 'Anonymous Ism', 'core', true, '/seed/white_tee.jpg'),
  (:test_user_id, 'garment', 'top', 'polo', 'relaxed', 'navy', '{}', 'solid', 'cotton', ARRAY['spring','summer','fall'], 2, ARRAY['cityboy','smart_casual'], NULL, 'useful', false, '/seed/navy_polo.jpg'),
  (:test_user_id, 'garment', 'top', 'shirt', 'relaxed', 'ecru', '{}', 'solid', 'cotton', ARRAY['spring','summer','fall','winter'], 3, ARRAY['amekaji','workwear'], 'Beams Plus', 'core', true, '/seed/ecru_shirt.jpg'),
  (:test_user_id, 'garment', 'top', 'sweater', 'regular', 'olive', '{}', 'solid', 'wool', ARRAY['fall','winter'], 3, ARRAY['amekaji','ivy'], 'Cableami', 'useful', false, '/seed/olive_sweater.jpg'),
  (:test_user_id, 'garment', 'outerwear', 'chore_jacket', 'regular', 'navy', '{}', 'solid', 'cotton', ARRAY['fall','winter','spring'], 3, ARRAY['amekaji','workwear'], 'orSlow', 'core', true, '/seed/chore_jacket.jpg'),
  (:test_user_id, 'garment', 'outerwear', 'blazer', 'relaxed', 'charcoal', '{}', 'solid', 'wool', ARRAY['fall','winter','spring'], 4, ARRAY['creative_executive','ivy'], NULL, 'useful', false, '/seed/charcoal_blazer.jpg'),
  (:test_user_id, 'garment', 'bottom', 'fatigue_pants', 'relaxed_straight', 'olive', '{}', 'solid', 'cotton', ARRAY['fall','winter','spring'], 1, ARRAY['amekaji','workwear','military'], 'orSlow', 'core', true, '/seed/olive_fatigue.jpg'),
  (:test_user_id, 'garment', 'bottom', 'jeans', 'straight', 'indigo', '{}', 'solid', 'denim', ARRAY['all'], 1, ARRAY['amekaji','denim'], 'Tanuki', 'core', true, '/seed/indigo_jeans.jpg'),
  (:test_user_id, 'garment', 'bottom', 'chino', 'tapered', 'khaki', '{}', 'solid', 'cotton', ARRAY['spring','summer','fall'], 2, ARRAY['ivy','cityboy'], NULL, 'useful', false, '/seed/khaki_chino.jpg'),
  (:test_user_id, 'sneaker', 'footwear', 'jordan_retro', 'regular', 'white', ARRAY['fire_red','black'], 'solid', 'leather', ARRAY['all'], 1, ARRAY['statement','sneakerhead'], 'Air Jordan', 'core', true, '/seed/jordan3.jpg'),
  (:test_user_id, 'sneaker', 'footwear', 'dunk', 'regular', 'white', ARRAY['black'], 'solid', 'leather', ARRAY['all'], 1, ARRAY['icon','sneakerhead'], 'Nike', 'useful', false, '/seed/dunk_panda.jpg'),
  (:test_user_id, 'sneaker', 'footwear', 'new_balance', 'regular', 'grey', ARRAY['white','navy'], 'solid', 'suede', ARRAY['all'], 1, ARRAY['icon','sneakerhead','amekaji'], 'New Balance', 'core', true, '/seed/nb_990.jpg'),
  (:test_user_id, 'accessory', 'accessory', 'cap', 'regular', 'navy', '{}', 'solid', 'cotton', ARRAY['spring','summer','fall'], 1, ARRAY['cityboy','casual'], NULL, 'useful', false, '/seed/navy_cap.jpg'),
  (:test_user_id, 'accessory', 'accessory', 'watch', 'regular', 'silver', ARRAY['black'], 'solid', 'metal', ARRAY['all'], 4, ARRAY['creative_executive','minimal'], NULL, 'core', true, '/seed/silver_watch.jpg'),
  (:test_user_id, 'accessory', 'accessory', 'belt', 'regular', 'brown', '{}', 'solid', 'leather', ARRAY['all'], 3, ARRAY['amekaji','ivy'], NULL, 'core', false, '/seed/brown_belt.jpg')
ON CONFLICT DO NOTHING;

-- Update sneaker-specific fields
UPDATE garments SET
  sneaker_model = subcategory,
  sneaker_colorway = primary_color || COALESCE(' / ' || array_to_string(secondary_colors, ' / '), ''),
  sneaker_silhouette = CASE subcategory
    WHEN 'jordan_retro' THEN 'Air Jordan 3'
    WHEN 'dunk' THEN 'Nike Dunk Low'
    WHEN 'new_balance' THEN 'New Balance 990'
    ELSE NULL
  END,
  sneaker_prominence = CASE subcategory
    WHEN 'jordan_retro' THEN 'statement'::sneaker_prominence
    WHEN 'dunk' THEN 'icon'::sneaker_prominence
    WHEN 'new_balance' THEN 'neutral'::sneaker_prominence
    ELSE NULL
  END
WHERE kind = 'sneaker';
