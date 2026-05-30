create extension if not exists pgcrypto;

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  last_accepted_at timestamptz,
  last_accepted_by uuid
);

alter table public.household_invites enable row level security;

create policy if not exists "household members can view household invites"
on public.household_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_invites.household_id
      and hm.user_id = auth.uid()
  )
);

create or replace function public.create_household_invite(p_household_id uuid)
returns table (
  invite_token text,
  household_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_household_name text;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this household';
  end if;

  select h.name
  into v_household_name
  from public.households h
  where h.id = p_household_id;

  if v_household_name is null then
    raise exception 'Household not found';
  end if;

  insert into public.household_invites (household_id, created_by)
  values (p_household_id, auth.uid())
  returning token, household_invites.expires_at
  into v_token, v_expires_at;

  return query
  select v_token, v_household_name, v_expires_at;
end;
$$;

create or replace function public.accept_household_invite(p_token text)
returns table (
  household_id uuid,
  household_name text,
  member_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select hi.household_id
  into v_household_id
  from public.household_invites hi
  where hi.token = p_token
    and hi.expires_at > now();

  if v_household_id is null then
    raise exception 'Invite not found or expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  select v_household_id, auth.uid(), 'member'
  where not exists (
    select 1
    from public.household_members hm
    where hm.household_id = v_household_id
      and hm.user_id = auth.uid()
  );

  update public.household_invites
  set last_accepted_at = now(),
      last_accepted_by = auth.uid()
  where token = p_token;

  return query
  select
    h.id as household_id,
    h.name as household_name,
    hm.role as member_role
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where h.id = v_household_id
    and hm.user_id = auth.uid();
end;
$$;

grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
