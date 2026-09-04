-- Harden household-scoped RPC authorization.
--
-- 1. Prevent delete_shopping_history_entry from updating products outside the
--    requested household when product IDs originate from client-writable JSON.
-- 2. Make the SECURITY INVOKER helper RPCs explicitly enforce authentication
--    and household membership instead of relying only on underlying RLS.
-- 3. Pin search_path and remove anonymous execution from write RPCs.

create or replace function public.restore_shopping_list(
  p_household_id uuid,
  p_product_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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

  update public.products p
  set checked = true
  from public.categories c
  where c.id = p.category_id
    and c.household_id = p_household_id
    and p.id = any(p_product_ids);
end;
$$;

revoke all on function public.restore_shopping_list(uuid, uuid[]) from public;
revoke all on function public.restore_shopping_list(uuid, uuid[]) from anon;
grant execute on function public.restore_shopping_list(uuid, uuid[]) to authenticated, service_role;

create or replace function public.add_products_to_shopping_list(
  p_household_id uuid,
  p_product_names text[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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

  update public.products p
  set checked = true
  from public.categories c
  where c.id = p.category_id
    and c.household_id = p_household_id
    and p.name = any(p_product_names);
end;
$$;

revoke all on function public.add_products_to_shopping_list(uuid, text[]) from public;
revoke all on function public.add_products_to_shopping_list(uuid, text[]) from anon;
grant execute on function public.add_products_to_shopping_list(uuid, text[]) to authenticated, service_role;

create or replace function public.refresh_product_usage_counts(
  p_household_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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

  update public.products p
  set usage_count = (
    select count(*)::integer
    from public.shopping_history sh
    where sh.household_id = p_household_id
      and exists (
        select 1
        from jsonb_array_elements(sh.items) as item
        where item ->> 'id' = p.id::text
      )
  )
  from public.categories c
  where c.id = p.category_id
    and c.household_id = p_household_id;
end;
$$;

revoke all on function public.refresh_product_usage_counts(uuid) from public;
revoke all on function public.refresh_product_usage_counts(uuid) from anon;
grant execute on function public.refresh_product_usage_counts(uuid) to authenticated, service_role;

create or replace function public.delete_shopping_history_entry(
  p_household_id uuid,
  p_history_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_items jsonb;
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

  delete from public.shopping_history sh
  where sh.id = p_history_id
    and sh.household_id = p_household_id
  returning sh.items into v_deleted_items;

  if v_deleted_items is null then
    raise exception 'History entry not found';
  end if;

  with deleted_product_ids as (
    select distinct (item ->> 'id')::uuid as product_id
    from jsonb_array_elements(coalesce(v_deleted_items, '[]'::jsonb)) as item
    where jsonb_typeof(item) = 'object'
      and item ? 'id'
      and item ->> 'id' is not null
      and item ->> 'id' <> ''
  )
  update public.products p
  set usage_count = greatest(coalesce(p.usage_count, 0) - 1, 0)
  from public.categories c
  where c.id = p.category_id
    and c.household_id = p_household_id
    and p.id in (select product_id from deleted_product_ids);
end;
$$;

revoke all on function public.delete_shopping_history_entry(uuid, uuid) from public;
revoke all on function public.delete_shopping_history_entry(uuid, uuid) from anon;
grant execute on function public.delete_shopping_history_entry(uuid, uuid) to authenticated, service_role;
