-- Transaction-only synthetic history; caller must BEGIN / ROLLBACK in Dev.
do $$
declare actor uuid:='b14c52c3-9026-4e91-95a5-e6914ea40b8f';house uuid:=gen_random_uuid();row record;answer jsonb;stat jsonb;
begin
 for n in 1..250 loop
  insert into dev_monitoring.operations(operation_id,correlation_id,actor_id,household_id,operation_type,outcome,started_at,accepted_at,ended_at,mode)
   values(gen_random_uuid(),gen_random_uuid(),actor,house,'stage4.product.update','committed',clock_timestamp(),clock_timestamp(),clock_timestamp(),'MID') returning * into row;
  insert into dev_monitoring.records(id,operation_id,correlation_id,source,record)
   values(gen_random_uuid(),row.operation_id,row.correlation_id,'browser',jsonb_build_object('metrics',jsonb_build_object('tap_saved_ms',n,'retry_count',case when n<=25 then 1 else 0 end))),
   (gen_random_uuid(),row.operation_id,row.correlation_id,'browser',jsonb_build_object('metrics',jsonb_build_object('tap_saved_ms',n))),
   (gen_random_uuid(),row.operation_id,row.correlation_id,'debian',jsonb_build_object('metrics',jsonb_build_object('database_ms',2)));
 end loop;
 answer:=public.stage5_monitoring_analytics_service(actor,jsonb_build_object('household_id',house,'route','flespi'));
 if (answer->'summary'->>'total')::integer<>250 or (answer->'summary'->>'client_retried')::integer<>25 then raise exception 'Full-range counts or retry attribution wrong';end if;
 select x into stat from jsonb_array_elements(answer->'metrics') x where x->>'key'='tap_saved_ms';
 if (stat->>'n')::integer<>250 or (stat->>'p50')::numeric<>125.5 or abs((stat->>'p95')::numeric-237.55)>0.0001 or stat->>'p99' is not null then raise exception 'Percentiles/sample count incorrect';end if;
 answer:=public.stage5_monitoring_analytics_service(actor,jsonb_build_object('household_id',house,'route','direct_lan'));
 if (answer->'summary'->>'total')::integer<>0 then raise exception 'Future route mixed with measured route';end if;
 begin
  perform public.stage5_monitoring_analytics_service(gen_random_uuid(),jsonb_build_object('household_id',house));raise exception 'Unauthorized analytics exposed';
 exception when insufficient_privilege then null;end;
end $$;
select 'PASS: 250 operations across pages, duplicate evidence counted once, retry attribution, P50/P95/P99 guard, route separation, authorization' as result;
