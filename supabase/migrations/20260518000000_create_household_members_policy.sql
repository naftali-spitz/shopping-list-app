create policy "Users can read own household memberships"
on household_members
for select
using (
  user_id = auth.uid()
);
