-- Own immutable outcomes may be reconciled without an existing household (new
-- list command expired before commit) or after membership revocation. No new
-- household data is read. New snapshots always require current local membership.
SET ROLE shopping_stage2_owner;
CREATE FUNCTION shopping.stage4_operation_status(c jsonb, canonical_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  actor uuid := shopping.current_user_id();
  scope uuid := shopping.current_household_id();
  operation uuid := (c->>'id')::uuid;
  previous shopping.operations;
  original jsonb;
  answer jsonb;
  outcome text;
BEGIN
  IF actor IS NULL OR actor::text IS DISTINCT FROM c->>'user_id'
     OR scope IS NULL OR scope::text IS DISTINCT FROM c->>'household_id'
     OR c->>'type' IS DISTINCT FROM 'stage4.operation.status'
     OR c->>'aud' IS DISTINCT FROM 'urn:shopping:stage3:debian:development'
     OR canonical_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid reconciliation context' USING ERRCODE='42501';
  END IF;
  INSERT INTO shopping.principals(id,issuer,subject)
    VALUES(actor,'https://njomxqthjglqesxchlbm.supabase.co/auth/v1',actor::text) ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT FROM shopping.principals WHERE id=actor AND subject=actor::text AND active
    AND issuer='https://njomxqthjglqesxchlbm.supabase.co/auth/v1' FOR SHARE) THEN
    RAISE EXCEPTION 'Principal inactive' USING ERRCODE='42501';
  END IF;
  SELECT * INTO previous FROM shopping.operations WHERE id=operation;
  IF FOUND THEN
    IF previous.user_id<>actor OR previous.household_id<>scope OR previous.canonical_hash<>canonical_hash THEN
      RAISE EXCEPTION 'Operation ID conflict' USING ERRCODE='23505';
    END IF;
    RETURN previous.result;
  END IF;
  IF (c->>'expires_ms')::bigint<=extract(epoch FROM clock_timestamp())*1000 THEN outcome:='expired';
  ELSE
    SELECT result INTO original FROM shopping.operations
      WHERE id=(c->'payload'->>'operation_id')::uuid AND household_id=scope AND user_id=actor;
    outcome:=CASE WHEN FOUND THEN 'found' ELSE 'not_found' END;
  END IF;
  answer:=jsonb_build_object('operation_id',operation,'household_id',scope,'user_id',actor,'correlation_id',c->>'correlation_id',
    'audience',c->>'aud','status',outcome,'data',original);
  INSERT INTO shopping.operations(id,household_id,user_id,canonical_hash,operation_type,correlation_id,result)
    VALUES(operation,scope,actor,canonical_hash,c->>'type',(c->>'correlation_id')::uuid,answer);
  INSERT INTO shopping.result_outbox(operation_id,household_id,user_id,result) VALUES(operation,scope,actor,answer);
  RETURN answer;
END $$;
REVOKE ALL ON FUNCTION shopping.stage4_operation_status(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shopping.stage4_operation_status(jsonb,text) TO shopping_stage2_runtime;
RESET ROLE;
