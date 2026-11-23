-- PostgreSQL row-locking SELECT also checks UPDATE policies. The runtime can
-- update only the identity column to its existing value, never grants/revocation.
SET ROLE shopping_stage2_owner;
SET search_path=shopping,pg_catalog;
CREATE POLICY principal_lock ON principals FOR UPDATE TO shopping_stage2_runtime
  USING(id=current_user_id()) WITH CHECK(id=current_user_id());
CREATE POLICY membership_lock ON household_members FOR UPDATE TO shopping_stage2_runtime
  USING(user_id=current_user_id()) WITH CHECK(user_id=current_user_id());
RESET ROLE;
