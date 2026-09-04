create or replace function public.get_or_create_current_household()
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

  select hm.household_id
  into v_household_id
  from public.household_members hm
  where hm.user_id = auth.uid()
  order by hm.created_at asc
  limit 1;

  if v_household_id is null then
    insert into public.households (name)
    values ('My household')
    returning id into v_household_id;

    insert into public.household_members (household_id, user_id, role)
    values (v_household_id, auth.uid(), 'owner');
  end if;

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

create or replace function public.list_my_households()
returns table (
  household_id uuid,
  household_name text,
  member_role text
)
language sql
security definer
set search_path = public
as $$
  select
    h.id as household_id,
    h.name as household_name,
    hm.role as member_role
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where hm.user_id = auth.uid()
  order by h.created_at asc;
$$;

create or replace function public.create_household(p_name text default 'My household')
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
  v_household_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_household_name := nullif(trim(p_name), '');

  insert into public.households (name)
  values (coalesce(v_household_name, 'My household'))
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'owner');

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

grant execute on function public.get_or_create_current_household() to authenticated;
grant execute on function public.list_my_households() to authenticated;
grant execute on function public.create_household(text) to authenticated;
