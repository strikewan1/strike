-- =====================================================
-- STRIKE — Hotfix: handle_new_user trigger search_path
-- =====================================================
-- Apply this in Supabase SQL Editor to fix the live database.
-- The cause: when Supabase's auth.users INSERT fires the trigger,
-- the session's search_path doesn't include `public`. The function's
-- unqualified `INSERT INTO profiles` then fails with
-- "relation profiles does not exist".
--
-- The fix forces search_path to public inside the function and
-- schema-qualifies every table reference.
--
-- Idempotent: safe to run multiple times.
-- Apply order: in Supabase SQL Editor, paste this whole file and Run.
-- =====================================================

-- 1. Drop the broken trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Recreate function with explicit search_path + schema-qualified refs
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

-- 3. Owner must be postgres so the function bypasses RLS when inserting
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 4. supabase_auth_admin needs schema/table/function grants to execute the trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- 5. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verification (run separately if you want):
-- SELECT trigger_name, action_statement
--   FROM information_schema.triggers
--   WHERE event_object_schema = 'auth' AND event_object_table = 'users';
-- Expected: on_auth_user_created | EXECUTE FUNCTION public.handle_new_user()
--
-- SELECT n.nspname, r.rolname, prosecdef, proconfig
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   JOIN pg_roles r ON p.proowner = r.oid
--   WHERE p.proname = 'handle_new_user';
-- Expected: public | postgres | true | {"search_path=public, pg_temp"}
