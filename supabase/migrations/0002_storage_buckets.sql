-- =====================================================
-- STRIKE — Storage buckets + RLS policies
-- Run AFTER 0001_initial.sql
-- =====================================================

-- =====================================================
-- BUCKETS (private by default)
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('garments', 'garments', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('body-photos', 'body-photos', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('references', 'references', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('fit-checks', 'fit-checks', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES — users can only access their own path
-- Convention: every object path starts with `{auth.uid()}/`
-- =====================================================

-- Helper: bucket name → policy label
DO $$
DECLARE
  bucket_name TEXT;
  buckets TEXT[] := ARRAY['garments', 'body-photos', 'references', 'fit-checks'];
BEGIN
  FOREACH bucket_name IN ARRAY buckets LOOP
    -- Drop existing policies if they exist (idempotent re-runs)
    EXECUTE format('DROP POLICY IF EXISTS "own_select_%s" ON storage.objects', bucket_name);
    EXECUTE format('DROP POLICY IF EXISTS "own_insert_%s" ON storage.objects', bucket_name);
    EXECUTE format('DROP POLICY IF EXISTS "own_update_%s" ON storage.objects', bucket_name);
    EXECUTE format('DROP POLICY IF EXISTS "own_delete_%s" ON storage.objects', bucket_name);

    -- SELECT: only objects in your own folder
    EXECUTE format(
      'CREATE POLICY "own_select_%s" ON storage.objects FOR SELECT TO authenticated USING (
        bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text
      )',
      bucket_name, bucket_name
    );

    -- INSERT: only into your own folder, files must start with your UID
    EXECUTE format(
      'CREATE POLICY "own_insert_%s" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
        bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text
      )',
      bucket_name, bucket_name
    );

    -- UPDATE: only your own objects
    EXECUTE format(
      'CREATE POLICY "own_update_%s" ON storage.objects FOR UPDATE TO authenticated USING (
        bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text
      ) WITH CHECK (
        bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text
      )',
      bucket_name, bucket_name, bucket_name
    );

    -- DELETE: only your own objects
    EXECUTE format(
      'CREATE POLICY "own_delete_%s" ON storage.objects FOR DELETE TO authenticated USING (
        bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text
      )',
      bucket_name, bucket_name
    );
  END LOOP;
END $$;
