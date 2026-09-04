-- FutureCart production database baseline
-- Captured read-only from production on 2026-09-04.
--
-- This file intentionally contains the objects that existed before the
-- repository's later migration files, plus the final state of production
-- objects that are otherwise missing from version control.
--
-- Intentionally NOT created here because existing repository migrations
-- create them later:
--   * household_members SELECT policy
--   * get_or_create_current_household / list_my_households / create_household
--   * household_invites table, policy, and invite RPCs
--   * delete_household RPC

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp without time zone default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  created_at timestamp without time zone default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  icon text default 'general',
  created_at timestamp without time zone default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade,
  name text not null,
  usage_count integer default 0,
  checked boolean default false,
  created_at timestamp without time zone default now(),
  quantity numeric(10,2) not null default 1,
  display_order integer,
  constraint products_quantity_minimum check (quantity >= 1)
);

create index products_category_display_order_idx
on public.products(category_id, display_order);

create table public.shopping_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  items jsonb not null,
  exported_at timestamp without time zone default now()
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.shopping_history enable row level security;

create policy "Users can read own household categories"
on public.categories
for select
using (
  household_id in (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
  )
);

create policy "Users can insert own household categories"
on public.categories
for insert
with check (
  household_id in (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
  )
);

create policy "Users can update own household categories"
on public.categories
for update
using (
  household_id in (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
  )
)
with check (
  household_id in (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
  )
);

create policy "Users can delete own household categories"
on public.categories
for delete
using (
  household_id in (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
  )
);

create policy "Users can manage household products"
on public.products
for all
using (
  exists (
    select 1
    from public.categories c
    join public.household_members hm on hm.household_id = c.household_id
    where c.id = products.category_id
      and hm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.categories c
    join public.household_members hm on hm.household_id = c.household_id
    where c.id = products.category_id
      and hm.user_id = auth.uid()
  )
);

create policy "household members can view history"
on public.shopping_history
for select
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = shopping_history.household_id
      and hm.user_id = auth.uid()
  )
);

create policy "household members can insert history"
on public.shopping_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = shopping_history.household_id
      and hm.user_id = auth.uid()
  )
);

create or replace function public.restore_shopping_list(
  p_household_id uuid,
  p_product_ids uuid[]
)
returns void
language plpgsql
as $$
begin
  update products p
  set checked = true
  from categories c
  where c.id = p.category_id
    and c.household_id = p_household_id
    and p.id = any(p_product_ids);
end;
$$;

create or replace function public.add_products_to_shopping_list(
  p_household_id uuid,
  p_product_names text[]
)
returns void
language plpgsql
as $$
begin
  update products p
  set checked = true
  from categories c
  where c.id = p.category_id
    and c.household_id = p_household_id
    and p.name = any(p_product_names);
end;
$$;

create or replace function public.refresh_product_usage_counts(
  p_household_id uuid
)
returns void
language plpgsql
as $$
begin
  update products p
  set usage_count = (
    select count(*)::integer
    from shopping_history sh
    where sh.household_id = p_household_id
      and exists (
        select 1
        from jsonb_array_elements(sh.items) as item
        where item ->> 'id' = p.id::text
      )
  )
  from categories c
  where c.id = p.category_id
    and c.household_id = p_household_id;
end;
$$;

create or replace function public.export_shopping_list(
  p_household_id uuid
)
returns void
language plpgsql
security definer
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

  with unchecked as (
    update public.products p
    set checked = false
    from public.categories c
    where c.id = p.category_id
      and c.household_id = p_household_id
      and p.checked = true
    returning
      p.id,
      p.name,
      p.category_id,
      p.quantity
  ), inserted_history as (
    insert into public.shopping_history (
      household_id,
      items,
      exported_at
    )
    select
      p_household_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'category_id', category_id,
            'quantity', quantity
          )
        ),
        '[]'::jsonb
      ),
      now()
    from unchecked
    returning id
  )
  update public.products p
  set usage_count = coalesce(p.usage_count, 0) + 1
  where p.id in (select distinct id from unchecked);
end;
$$;

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
  where p.id in (select product_id from deleted_product_ids);
end;
$$;

-- Match production table privileges. RLS remains the row-level authorization layer.
grant all on table public.households to anon, authenticated, service_role;
grant all on table public.household_members to anon, authenticated, service_role;
grant all on table public.categories to anon, authenticated, service_role;
grant all on table public.products to anon, authenticated, service_role;
grant all on table public.shopping_history to anon, authenticated, service_role;

-- Match production function privileges for the non-SECURITY-DEFINER helpers.
grant execute on function public.restore_shopping_list(uuid, uuid[]) to anon, authenticated, service_role;
grant execute on function public.add_products_to_shopping_list(uuid, text[]) to anon, authenticated, service_role;
grant execute on function public.refresh_product_usage_counts(uuid) to anon, authenticated, service_role;

-- Production restricts these two SECURITY DEFINER functions to signed-in users.
revoke all on function public.export_shopping_list(uuid) from public;
revoke all on function public.export_shopping_list(uuid) from anon;
grant execute on function public.export_shopping_list(uuid) to authenticated, service_role;

revoke all on function public.delete_shopping_history_entry(uuid, uuid) from public;
revoke all on function public.delete_shopping_history_entry(uuid, uuid) from anon;
grant execute on function public.delete_shopping_history_entry(uuid, uuid) to authenticated, service_role;

-- Production Realtime publication membership.
alter publication supabase_realtime add table
  public.categories,
  public.products,
  public.shopping_history;
