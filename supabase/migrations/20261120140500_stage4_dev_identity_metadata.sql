-- DEVELOPMENT ONLY njomxqthjglqesxchlbm. Never apply to production.
-- Gateway rows are transport metadata, not Supabase business households. New
-- PostgreSQL-only households/account-scoped commands must not require mirrored
-- business writes. Preserve auth.users FK, all rows, RLS and immutable RPCs.
ALTER TABLE public.stage3_dev_operations DROP CONSTRAINT stage3_dev_operations_household_id_fkey;

CREATE FUNCTION public.stage4_dev_session_context()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  claims jsonb := auth.jwt();
  subject uuid := auth.uid();
  sid uuid;
BEGIN
  IF subject IS NULL OR claims->>'iss' IS DISTINCT FROM 'https://njomxqthjglqesxchlbm.supabase.co/auth/v1'
     OR claims->>'role' IS DISTINCT FROM 'authenticated' OR claims->>'aud' IS DISTINCT FROM 'authenticated'
     OR coalesce((claims->>'exp')::bigint,0)<=extract(epoch FROM clock_timestamp())
     OR coalesce((claims->>'is_anonymous')::boolean,true) THEN
    RAISE EXCEPTION 'Invalid development identity' USING ERRCODE='42501';
  END IF;
  sid := (claims->>'session_id')::uuid;
  IF sid IS NULL OR NOT EXISTS(
    SELECT FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
    WHERE s.id=sid AND s.user_id=subject AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
      AND u.deleted_at IS NULL AND NOT u.is_anonymous AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Session inactive' USING ERRCODE='42501'; END IF;
  -- No household/role assertion: local PostgreSQL is the business authority.
  RETURN jsonb_build_object('user_id',subject,'session_id',sid,'issuer','https://njomxqthjglqesxchlbm.supabase.co/auth/v1');
END $$;
REVOKE ALL ON FUNCTION public.stage4_dev_session_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stage4_dev_session_context() TO authenticated;
