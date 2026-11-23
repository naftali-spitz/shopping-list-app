-- Additive development-only lifecycle. Existing business rows and ledgers remain.
-- Account discovery/join commands use an actor scope, not a household FK.
SET ROLE shopping_stage2_owner;
ALTER TABLE shopping.operations DROP CONSTRAINT operations_household_id_fkey;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['principals','households','household_members','household_invites','categories','products','shopping_history','operations','result_outbox'] LOOP
    EXECUTE format('CREATE POLICY lifecycle_owner ON shopping.%I TO shopping_stage2_owner USING(true) WITH CHECK(true)',t);
  END LOOP;
END $$;

CREATE FUNCTION shopping.stage4_lifecycle(c jsonb, canonical_hash text, starter jsonb DEFAULT '[]')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  actor uuid := shopping.current_user_id();
  scope uuid := shopping.current_household_id();
  operation uuid := (c->>'id')::uuid;
  kind text := c->>'type';
  payload jsonb := c->'payload';
  target uuid := scope;
  member_role text;
  household shopping.households;
  invite shopping.household_invites;
  previous shopping.operations;
  outcome text := 'committed';
  body jsonb;
  answer jsonb;
  category jsonb;
  product jsonb;
  category_id uuid;
BEGIN
  IF actor IS NULL OR scope IS NULL OR actor<>(c->>'user_id')::uuid OR scope<>(c->>'household_id')::uuid
     OR canonical_hash !~ '^[a-f0-9]{64}$'
     OR kind NOT IN ('stage4.household.list','stage4.household.create','stage4.household.rename','stage4.household.members',
       'stage4.household.delete','stage4.household.seed','stage4.invite.create','stage4.invite.accept','stage4.invite.revoke','stage4.membership.remove') THEN
    RAISE EXCEPTION 'Invalid lifecycle context' USING ERRCODE='42501';
  END IF;
  -- A newly verified provider subject may be mapped once; inactive mappings are
  -- never reactivated by login or invite acceptance. No client identity claims.
  INSERT INTO shopping.principals(id,issuer,subject)
    VALUES(actor,'https://njomxqthjglqesxchlbm.supabase.co/auth/v1',actor::text) ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT FROM shopping.principals WHERE id=actor AND subject=actor::text
      AND issuer='https://njomxqthjglqesxchlbm.supabase.co/auth/v1' AND active FOR SHARE) THEN
    RAISE EXCEPTION 'Principal inactive' USING ERRCODE='42501';
  END IF;
  SELECT * INTO previous FROM shopping.operations WHERE id=operation;
  IF FOUND THEN
    IF previous.user_id<>actor OR previous.household_id<>scope OR previous.canonical_hash<>canonical_hash THEN
      RAISE EXCEPTION 'Operation ID conflict' USING ERRCODE='23505';
    END IF;
    RETURN previous.result;
  END IF;
  IF (c->>'expires_ms')::bigint<=extract(epoch FROM clock_timestamp())*1000 THEN
    outcome:='expired';
  ELSE
    BEGIN
      IF kind IN ('stage4.household.list','stage4.invite.accept') AND scope<>actor THEN
        outcome:='forbidden';
      ELSIF kind='stage4.household.list' THEN
        SELECT jsonb_build_object('households',coalesce(jsonb_agg(jsonb_build_object(
          'id',h.id,'name',h.name,'role',m.role,'version',h.version) ORDER BY h.name,h.id),'[]')) INTO body
          FROM shopping.household_members m JOIN shopping.households h ON h.id=m.household_id
          WHERE m.user_id=actor AND m.active AND h.deleted_at IS NULL;
        outcome:='snapshot';
      ELSIF kind='stage4.household.create' THEN
        INSERT INTO shopping.households(id,name) VALUES(scope,payload->>'name') RETURNING * INTO household;
        INSERT INTO shopping.household_members(household_id,user_id,role) VALUES(scope,actor,'owner');
        body:=jsonb_build_object('record',jsonb_build_object('id',scope,'name',household.name,'role','owner','version',household.version),'household_version',household.version);
      ELSE
        IF kind='stage4.invite.accept' THEN
          SELECT * INTO invite FROM shopping.household_invites
            WHERE token_hash=encode(sha256(convert_to(payload->>'token','UTF8')),'hex') AND revoked_at IS NULL AND expires_at>clock_timestamp();
          IF NOT FOUND THEN outcome:='not_found'; ELSE target:=invite.household_id; END IF;
        END IF;
        IF outcome='committed' THEN
          PERFORM pg_advisory_xact_lock(hashtextextended(target::text,0));
          SELECT * INTO household FROM shopping.households WHERE id=target AND deleted_at IS NULL FOR UPDATE;
          IF NOT FOUND THEN outcome:='not_found';
          ELSE
            SELECT role INTO member_role FROM shopping.household_members WHERE household_id=target AND user_id=actor AND active FOR SHARE;
            IF kind<>'stage4.invite.accept' AND member_role IS NULL THEN outcome:='forbidden';
            ELSIF kind IN ('stage4.household.rename','stage4.household.delete','stage4.membership.remove') AND member_role<>'owner' THEN outcome:='forbidden';
            ELSIF kind IN ('stage4.household.rename','stage4.household.delete','stage4.membership.remove','stage4.household.seed')
              AND household.version<>(c->>'expected_version')::bigint THEN
              outcome:='version_conflict';body:=jsonb_build_object('current_version',household.version);
            ELSIF kind='stage4.household.members' THEN
              SELECT jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'role',role) ORDER BY role,user_id),'[]')) INTO body
                FROM shopping.household_members WHERE household_id=target AND active;
              outcome:='snapshot';
            ELSE
              IF kind='stage4.invite.accept' THEN
                -- Lock and recheck invitation after obtaining the household lane.
                SELECT * INTO invite FROM shopping.household_invites WHERE id=invite.id AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
                IF NOT FOUND THEN outcome:='not_found';
                ELSE
                  INSERT INTO shopping.household_members(household_id,user_id,role) VALUES(target,actor,'member')
                    ON CONFLICT(household_id,user_id) DO UPDATE SET active=true;
                  SELECT role INTO member_role FROM shopping.household_members WHERE household_id=target AND user_id=actor;
                  body:=jsonb_build_object('id',target,'name',household.name,'role',member_role,'version',household.version+1);
                END IF;
              ELSIF kind='stage4.household.rename' THEN
                UPDATE shopping.households SET name=payload->>'name' WHERE id=target;
                body:=jsonb_build_object('id',target,'name',payload->>'name','role',member_role,'version',household.version+1);
              ELSIF kind='stage4.household.delete' THEN
                UPDATE shopping.households SET deleted_at=clock_timestamp() WHERE id=target;
                UPDATE shopping.household_members SET active=false WHERE household_id=target;
                UPDATE shopping.household_invites SET revoked_at=clock_timestamp() WHERE household_id=target AND revoked_at IS NULL;
                body:=jsonb_build_object('id',target,'deleted',true);
              ELSIF kind='stage4.membership.remove' THEN
                IF (payload->>'user_id')::uuid=actor THEN outcome:='forbidden';
                ELSE
                  UPDATE shopping.household_members SET active=false WHERE household_id=target AND user_id=(payload->>'user_id')::uuid AND role='member' AND active;
                  IF NOT FOUND THEN outcome:='not_found'; ELSE body:=jsonb_build_object('user_id',payload->>'user_id','active',false); END IF;
                END IF;
              ELSIF kind='stage4.invite.create' THEN
                INSERT INTO shopping.household_invites(id,household_id,token_hash,created_by,expires_at)
                  VALUES((payload->>'id')::uuid,target,encode(sha256(convert_to(payload->>'token','UTF8')),'hex'),actor,clock_timestamp()+interval '14 days') RETURNING * INTO invite;
                body:=jsonb_build_object('id',invite.id,'token',payload->>'token','householdName',household.name,'expiresAt',invite.expires_at);
              ELSIF kind='stage4.invite.revoke' THEN
                UPDATE shopping.household_invites SET revoked_at=clock_timestamp()
                  WHERE id=(payload->>'id')::uuid AND household_id=target AND revoked_at IS NULL;
                IF NOT FOUND THEN outcome:='not_found'; ELSE body:=jsonb_build_object('id',payload->>'id','revoked',true); END IF;
              ELSIF kind='stage4.household.seed' THEN
                IF EXISTS(SELECT FROM shopping.categories WHERE household_id=target AND deleted_at IS NULL) THEN
                  outcome:='record_id_conflict';
                ELSE
                  FOR category IN SELECT value FROM jsonb_array_elements(starter) LOOP
                    category_id:=gen_random_uuid();
                    INSERT INTO shopping.categories(id,household_id,name,icon) VALUES(category_id,target,category->>'name',category->>'icon');
                    FOR product IN SELECT jsonb_build_object('name',value,'display_order',ordinality*1000) FROM jsonb_array_elements_text(category->'products') WITH ORDINALITY LOOP
                      INSERT INTO shopping.products(id,household_id,category_id,name,display_order)
                        VALUES(gen_random_uuid(),target,category_id,product->>'name',(product->>'display_order')::integer);
                    END LOOP;
                  END LOOP;
                  body:=jsonb_build_object('id',target,'seeded',true);
                END IF;
              END IF;
              IF outcome='committed' THEN
                UPDATE shopping.households SET version=version+1 WHERE id=target RETURNING version INTO household.version;
                body:=jsonb_build_object('record',body,'household_version',household.version);
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN unique_violation THEN outcome:='record_id_conflict';body:=NULL;
    END;
  END IF;
  answer:=jsonb_build_object('operation_id',operation,'household_id',scope,'user_id',actor,'correlation_id',c->>'correlation_id',
    'audience',c->>'aud','status',outcome,'data',body);
  INSERT INTO shopping.operations(id,household_id,user_id,canonical_hash,operation_type,correlation_id,result)
    VALUES(operation,scope,actor,canonical_hash,kind,(c->>'correlation_id')::uuid,answer);
  INSERT INTO shopping.result_outbox(operation_id,household_id,user_id,result) VALUES(operation,scope,actor,answer);
  RETURN answer;
END $$;
REVOKE ALL ON FUNCTION shopping.stage4_lifecycle(jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shopping.stage4_lifecycle(jsonb,text,jsonb) TO shopping_stage2_runtime;
RESET ROLE;
