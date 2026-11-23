do $$
declare h uuid:=gen_random_uuid();a uuid:='b14c52c3-9026-4e91-95a5-e6914ea40b8f';r jsonb;
begin
 insert into dev_monitoring.operations(operation_id,correlation_id,actor_id,household_id,operation_type,outcome,started_at,accepted_at,mode)
 select gen_random_uuid(),gen_random_uuid(),a,h,'stage4.household.members',outcome,clock_timestamp(),clock_timestamp(),'MID' from unnest(array['snapshot','found']) outcome;
 r:=public.stage5_monitoring_analytics_service(a,jsonb_build_object('household_id',h));
 if (r->'summary'->>'successful')::integer<>2 or (r->'summary'->>'failed')::integer<>0 then raise exception 'Read outcome misclassified';end if;
end $$;
select 'PASS: snapshot/found are successful reads; no false failure-rate inflation' as result;
