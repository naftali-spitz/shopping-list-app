-- Preserve the original starter template order. now() is transaction-stable and
-- gives every category in atomic seeding the same timestamp; clock_timestamp()
-- records the actual insertion order while retaining the baseline created_at sort.
SET ROLE shopping_stage2_owner;
DO $migration$
DECLARE
  definition text := pg_get_functiondef('shopping.stage4_lifecycle(jsonb,text,jsonb)'::regprocedure);
  original text := $old$INSERT INTO shopping.categories(id,household_id,name,icon) VALUES(category_id,target,category->>'name',category->>'icon');$old$;
  corrected text := $new$INSERT INTO shopping.categories(id,household_id,name,icon,created_at) VALUES(category_id,target,category->>'name',category->>'icon',clock_timestamp());$new$;
BEGIN
  IF position(original IN definition)=0 THEN RAISE EXCEPTION 'Expected seed implementation missing'; END IF;
  EXECUTE replace(definition,original,corrected);
END $migration$;
RESET ROLE;
