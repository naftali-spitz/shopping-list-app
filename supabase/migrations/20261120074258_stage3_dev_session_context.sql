-- DEVELOPMENT ONLY: njomxqthjglqesxchlbm. Never apply to production.
-- A narrowly scoped definer is required because callers cannot read auth.sessions.
-- It accepts no user/session/role claims from arguments and returns no session secrets.
create function public.stage3_dev_session_context(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  claims jsonb := auth.jwt();
  subject uuid := auth.uid();
  sid uuid;
  member_role text;
begin
  if subject is null or claims->>'iss' is distinct from 'https://njomxqthjglqesxchlbm.supabase.co/auth/v1'
     or claims->>'role' is distinct from 'authenticated' or claims->>'aud' is distinct from 'authenticated'
     or coalesce((claims->>'exp')::bigint,0) <= extract(epoch from clock_timestamp())
     or coalesce((claims->>'is_anonymous')::boolean,true) then
    raise exception 'Invalid development identity' using errcode = '42501';
  end if;
  sid := (claims->>'session_id')::uuid;
  if sid is null or not exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=sid and s.user_id=subject
      and (s.not_after is null or s.not_after>clock_timestamp())
      and u.deleted_at is null and not u.is_anonymous
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
  ) then
    raise exception 'Session inactive' using errcode = '42501';
  end if;
  select hm.role into member_role from public.household_members hm
    where hm.user_id=subject and hm.household_id=p_household_id;
  if member_role is null or member_role not in ('owner','member') then
    raise exception 'Household forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object('user_id',subject,'session_id',sid,
    'household_id',p_household_id,'role',member_role,
    'issuer','https://njomxqthjglqesxchlbm.supabase.co/auth/v1');
end;
$$;
revoke all on function public.stage3_dev_session_context(uuid) from public, anon;
grant execute on function public.stage3_dev_session_context(uuid) to authenticated;
