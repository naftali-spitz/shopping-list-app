CREATE SCHEMA shopping AUTHORIZATION shopping_stage2_owner;
SET ROLE shopping_stage2_owner;
SET search_path=shopping,pg_catalog;
CREATE TABLE schema_migrations(version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE principals(id uuid PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL, active boolean NOT NULL DEFAULT true, UNIQUE(issuer,subject));
CREATE TABLE households(id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), version bigint NOT NULL DEFAULT 1 CHECK(version>0), deleted_at timestamptz);
CREATE TABLE household_members(household_id uuid NOT NULL REFERENCES households, user_id uuid NOT NULL REFERENCES principals, role text NOT NULL CHECK(role IN ('owner','member')), active boolean NOT NULL DEFAULT true, PRIMARY KEY(household_id,user_id));
CREATE INDEX membership_user_idx ON household_members(user_id,household_id) WHERE active;
CREATE TABLE categories(id uuid PRIMARY KEY, household_id uuid NOT NULL REFERENCES households, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), icon text NOT NULL DEFAULT 'general', version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(id,household_id));
CREATE INDEX category_household_idx ON categories(household_id) WHERE deleted_at IS NULL;
CREATE TABLE products(id uuid PRIMARY KEY, household_id uuid NOT NULL REFERENCES households, category_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), checked boolean NOT NULL DEFAULT false, quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 9999), display_order integer CHECK(display_order BETWEEN 0 AND 1000000), usage_count integer NOT NULL DEFAULT 0 CHECK(usage_count>=0), version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, FOREIGN KEY(category_id,household_id) REFERENCES categories(id,household_id));
CREATE INDEX product_household_category_idx ON products(household_id,category_id,display_order) WHERE deleted_at IS NULL;
CREATE TABLE shopping_history(id uuid PRIMARY KEY, household_id uuid NOT NULL REFERENCES households, items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'), exported_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1 CHECK(version>0), deleted_at timestamptz);
CREATE INDEX history_household_idx ON shopping_history(household_id,exported_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE household_invites(id uuid PRIMARY KEY, household_id uuid NOT NULL REFERENCES households, token_hash text UNIQUE NOT NULL, created_by uuid NOT NULL REFERENCES principals, expires_at timestamptz NOT NULL, revoked_at timestamptz);
CREATE TABLE operations(id uuid PRIMARY KEY, household_id uuid NOT NULL REFERENCES households, user_id uuid NOT NULL REFERENCES principals, canonical_hash text NOT NULL CHECK(length(canonical_hash)=64), operation_type text NOT NULL, correlation_id uuid NOT NULL, result jsonb NOT NULL, committed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX operation_household_user_idx ON operations(household_id,user_id,committed_at);
CREATE TABLE result_outbox(operation_id uuid PRIMARY KEY REFERENCES operations, household_id uuid NOT NULL, user_id uuid NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text);
CREATE INDEX outbox_pending_idx ON result_outbox(created_at) WHERE delivered_at IS NULL;

CREATE FUNCTION current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('shopping.user_id',true),'')::uuid $$;
CREATE FUNCTION current_household_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('shopping.household_id',true),'')::uuid $$;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members FORCE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON household_members FOR SELECT TO shopping_stage2_runtime USING(user_id=current_user_id());
CREATE FUNCTION authorized(h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,shopping AS $$ SELECT EXISTS(SELECT FROM shopping.household_members WHERE household_id=h AND user_id=shopping.current_user_id() AND active) $$;
ALTER TABLE principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals FORCE ROW LEVEL SECURITY;
CREATE POLICY own_principal ON principals FOR SELECT TO shopping_stage2_runtime USING(id=current_user_id());
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE households FORCE ROW LEVEL SECURITY;
CREATE POLICY own_household ON households TO shopping_stage2_runtime USING(id=current_household_id() AND authorized(id)) WITH CHECK(id=current_household_id() AND authorized(id));
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','shopping_history','household_invites','operations','result_outbox'] LOOP
    EXECUTE format('ALTER TABLE shopping.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE shopping.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY scoped ON shopping.%I TO shopping_stage2_runtime USING(household_id=shopping.current_household_id() AND shopping.authorized(household_id)) WITH CHECK(household_id=shopping.current_household_id() AND shopping.authorized(household_id))',t);
  END LOOP;
END $$;
CREATE POLICY outbox_dispatch ON result_outbox TO shopping_stage2_dispatcher USING(true) WITH CHECK(true);
REVOKE ALL ON ALL TABLES IN SCHEMA shopping FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shopping FROM PUBLIC;
GRANT USAGE ON SCHEMA shopping TO shopping_stage2_runtime,shopping_stage2_dispatcher;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA shopping TO shopping_stage2_runtime;
GRANT SELECT ON principals,household_members TO shopping_stage2_runtime;
-- FOR SHARE authorization checks require UPDATE privilege; only no-op lock
-- columns are granted, never membership role/active or principal identity.
GRANT UPDATE(user_id) ON household_members TO shopping_stage2_runtime;
GRANT UPDATE(id) ON principals TO shopping_stage2_runtime;
GRANT SELECT,UPDATE(version) ON households TO shopping_stage2_runtime;
GRANT SELECT,INSERT,UPDATE ON categories,products,shopping_history,operations TO shopping_stage2_runtime;
GRANT INSERT ON result_outbox TO shopping_stage2_runtime;
GRANT SELECT ON result_outbox TO shopping_stage2_dispatcher;
GRANT UPDATE(delivered_at,attempts,last_error) ON result_outbox TO shopping_stage2_dispatcher;
RESET ROLE;
