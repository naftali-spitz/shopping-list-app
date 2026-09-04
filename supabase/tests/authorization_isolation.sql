-- FutureCart tenant-isolation regression tests.
-- Run on a disposable/dev database only.
-- Everything is wrapped in a transaction and rolled back.

begin;

-- Synthetic identities. These are not login-capable users and are rolled back.
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.households (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Isolation household A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Isolation household B');

insert into public.household_members (id, household_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.categories (id, household_id, name) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'A category'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'B category');

insert into public.products (id, category_id, name, usage_count, checked, quantity, display_order) values
  ('aaaaaaaa-3333-3333-3333-333333333333', 'aaaaaaaa-1111-1111-1111-111111111111', 'A product', 5, false, 1, 100),
  ('bbbbbbbb-4444-4444-4444-444444444444', 'bbbbbbbb-2222-2222-2222-222222222222', 'B product', 7, false, 1, 100);

-- Simulate authenticated user A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

-- Direct table RLS: A sees A's rows and not B's rows.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.categories;
  if v_count <> 1 then
    raise exception 'RLS failure: user A should see exactly one category, saw %', v_count;
  end if;

  select count(*) into v_count from public.products;
  if v_count <> 1 then
    raise exception 'RLS failure: user A should see exactly one product, saw %', v_count;
  end if;

  select count(*) into v_count from public.households;
  if v_count <> 0 then
    raise exception 'RLS failure: households should be deny-by-default for direct SELECT';
  end if;

  select count(*) into v_count from public.list_my_households();
  if v_count <> 1 then
    raise exception 'RPC failure: list_my_households should return exactly user A household';
  end if;
end;
$$;

-- User A may write history for A, even with adversarial JSON contents. This
-- reproduces the pre-fix input that used to let the delete RPC mutate B.
insert into public.shopping_history (id, household_id, items)
values (
  'aaaaaaaa-5555-5555-5555-555555555555',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  jsonb_build_array(jsonb_build_object('id', 'bbbbbbbb-4444-4444-4444-444444444444'))
);

-- User A must not be able to insert history into B.
do $$
declare
  v_blocked boolean := false;
begin
  begin
    insert into public.shopping_history (id, household_id, items)
    values (
      'bbbbbbbb-6666-6666-6666-666666666666',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      '[]'::jsonb
    );
  exception
    when insufficient_privilege then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'RLS failure: user A inserted shopping history into household B';
  end if;
end;
$$;

-- Household-scoped helper RPCs must reject a foreign household explicitly.
do $$
declare
  v_blocked boolean;
begin
  v_blocked := false;
  begin
    perform public.add_products_to_shopping_list(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      array['B product']::text[]
    );
  exception when others then
    if position('not a member' in lower(sqlerrm)) > 0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'RPC failure: add_products_to_shopping_list accepted household B for user A';
  end if;

  v_blocked := false;
  begin
    perform public.restore_shopping_list(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      array['bbbbbbbb-4444-4444-4444-444444444444'::uuid]
    );
  exception when others then
    if position('not a member' in lower(sqlerrm)) > 0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'RPC failure: restore_shopping_list accepted household B for user A';
  end if;

  v_blocked := false;
  begin
    perform public.refresh_product_usage_counts('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2');
  exception when others then
    if position('not a member' in lower(sqlerrm)) > 0 then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'RPC failure: refresh_product_usage_counts accepted household B for user A';
  end if;
end;
$$;

-- Regression for the confirmed exploit: deleting A history containing B's
-- product UUID must not change B's product usage_count.
select public.delete_shopping_history_entry(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-5555-5555-5555-555555555555'
);

reset role;

do $$
declare
  v_usage integer;
  v_history_count integer;
begin
  select usage_count into v_usage
  from public.products
  where id = 'bbbbbbbb-4444-4444-4444-444444444444';

  if v_usage <> 7 then
    raise exception 'Isolation failure: household B usage_count changed to %', v_usage;
  end if;

  select count(*) into v_history_count
  from public.shopping_history
  where id = 'aaaaaaaa-5555-5555-5555-555555555555';

  if v_history_count <> 0 then
    raise exception 'Functional failure: requested household A history row was not deleted';
  end if;
end;
$$;

rollback;
