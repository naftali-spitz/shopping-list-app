SET ROLE shopping_stage2_owner;
ALTER FUNCTION shopping.current_user_id() SET search_path=pg_catalog;
ALTER FUNCTION shopping.current_household_id() SET search_path=pg_catalog;
RESET ROLE;
