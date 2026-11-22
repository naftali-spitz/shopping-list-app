do $$
declare a uuid:='b14c52c3-9026-4e91-95a5-e6914ea40b8f';h uuid:=gen_random_uuid();op uuid;c uuid;
begin
 for n in 1..2 loop
  op:=gen_random_uuid();c:=gen_random_uuid();
  insert into dev_monitoring.operations(operation_id,correlation_id,actor_id,household_id,operation_type,outcome,started_at,accepted_at,mode)
   values(op,c,a,h,'stage4.product.update','committed',clock_timestamp(),clock_timestamp()-interval '91 days','MID');
  insert into dev_monitoring.records(id,operation_id,correlation_id,source,record) values(gen_random_uuid(),op,c,'browser',jsonb_build_object('metrics',case when n=1 then '{"tap_saved_ms":100}'::jsonb else '{"action_saved_ms":200}'::jsonb end));
 end loop;
 perform public.stage5_monitoring_cleanup_service();
 if not exists(select 1 from dev_monitoring.aggregates where household_id=h and saved_n=1 and saved_sum_ms=100 and action_saved_n=1 and action_saved_sum_ms=200) then raise exception 'Different start boundaries were mixed';end if;
end $$;
select 'PASS: archived action-entry and legacy operation-creation latency cohorts remain separate' as result;
