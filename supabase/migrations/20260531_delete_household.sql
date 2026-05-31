create or replace function public.delete_household(p_household_id uuid)
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
      and hm.role = 'owner'
  ) then
    raise exception 'Only the household owner can delete this household';
  end if;

  delete from public.products p
  using public.categories c
  where p.category_id = c.id
    and c.household_id = p_household_id;

  delete from public.shopping_history
  where household_id = p_household_id;

  delete from public.household_invites
  where household_id = p_household_id;

  delete from public.categories
  where household_id = p_household_id;

  delete from public.household_members
  where household_id = p_household_id;

  delete from public.households
  where id = p_household_id;
end;
$$;

grant execute on function public.delete_household(uuid) to authenticated;
