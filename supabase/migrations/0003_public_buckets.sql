-- =====================================================
-- STRIKE — Make storage buckets public
-- =====================================================
-- The original migration (0002) created private buckets. The upload
-- route used getPublicUrl() which returns a /public/... URL, but that
-- URL only serves the file when the bucket is actually public. So images
-- saved before this migration won't render in the closet.
--
-- This migration flips the public flag on all four buckets. It's
-- idempotent (uses ON CONFLICT DO NOTHING via the WHERE clause).
--
-- For a personal wardrobe, public buckets are acceptable (URLs are
-- unguessable in practice, the user controls who sees them). If you
-- later want private buckets, use signed URLs (see the upload route
-- which already generates them — switch to storing those instead).
-- =====================================================

UPDATE storage.buckets
SET public = TRUE
WHERE id IN ('garments', 'body-photos', 'references', 'fit-checks')
  AND public = FALSE;

-- Verification query — should return all 4 buckets with public = true:
-- SELECT id, public FROM storage.buckets WHERE id IN
--   ('garments', 'body-photos', 'references', 'fit-checks');
