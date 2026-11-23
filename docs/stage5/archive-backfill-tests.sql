-- BEGIN / ROLLBACK only. All fixtures and mode changes remain transaction-local.
do $$
declare actor uuid:='b14c52c3-9026-4e91-95a5-e6914ea40b8f';h uuid:=gen_random_uuid();op uuid:=gen_random_uuid();c jsonb;r jsonb;
begin
 select command into c from public.stage3_dev_operations where command->>'type'='stage4.product.update' limit 1;
 perform public.stage5_monitoring_service('mode',actor,'{"mode":"MID"}');
 c:=c||jsonb_build_object('id',op,'correlation_id',gen_random_uuid(),'issued_ms',(extract(epoch from clock_timestamp())*1000)::bigint,'expires_ms',(extract(epoch from clock_timestamp())*1000)::bigint+300000);
 perform public.stage3_dev_accept_service(c,repeat('0',64));
 perform public.stage5_monitoring_service('mode',actor,'{"mode":"OFF"}');perform public.stage5_monitoring_service('sync');
 if exists(select 1 from dev_monitoring.operations where operation_id=op) then raise exception 'OFF wrote monitoring history';end if;
 perform public.stage5_monitoring_service('mode',actor,'{"mode":"MID"}');perform public.stage5_monitoring_service('sync');
 if not exists(select 1 from dev_monitoring.operations where operation_id=op) then raise exception 'Durable pre-OFF acceptance failed backfill';end if;
 -- Two cleanup passes for the same day must merge exact sums/counts, not average averages.
 for n in 1..2 loop
  op:=gen_random_uuid();
  insert into dev_monitoring.operations(operation_id,correlation_id,actor_id,household_id,operation_type,outcome,started_at,accepted_at,mode)
   values(op,gen_random_uuid(),actor,h,'stage4.product.update','committed',clock_timestamp(),date_trunc('day',clock_timestamp()-interval '91 days'),'MID');
  insert into dev_monitoring.records(id,operation_id,correlation_id,source,record)
   select gen_random_uuid(),op,correlation_id,'browser',jsonb_build_object('metrics',jsonb_build_object('tap_saved_ms',n*100,'tap_optimistic_ms',n*10)) from dev_monitoring.operations where operation_id=op;
  perform public.stage5_monitoring_cleanup_service();
 end loop;
 if not exists(select 1 from dev_monitoring.aggregates where household_id=h and saved_n=2 and saved_sum_ms=300 and optimistic_n=2 and optimistic_sum_ms=30) then raise exception 'Archived latency sums/counts incorrect';end if;
 r:=public.stage5_monitoring_service('history',actor,jsonb_build_object('household_id',h,'from',clock_timestamp()-interval '100 days','route','direct_lan'));
 if jsonb_array_length(r->'aggregates')<>0 then raise exception 'Archived routes mixed';end if;
end $$;
select 'PASS: OFF has no new history, re-enabled durable backfill, exact archived sums/counts across cleanup passes, route isolation' as result;
