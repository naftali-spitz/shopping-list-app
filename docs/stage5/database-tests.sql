-- Run inside BEGIN / ROLLBACK only on njomxqthjglqesxchlbm.
do $$
declare c jsonb; actor uuid; house uuid; fixture_id uuid:=gen_random_uuid(); correlation uuid:=gen_random_uuid(); record_id uuid:=gen_random_uuid(); r jsonb; answer jsonb; n bigint;
begin
 select command into c from public.stage3_dev_operations where command->>'type'='stage4.product.update' limit 1;
 if c is null then raise exception 'Missing existing synthetic Dev fixture';end if;
 actor:=(c->>'user_id')::uuid;house:=(c->>'household_id')::uuid;
 insert into dev_monitoring.operators values(actor) on conflict do nothing;
 perform public.stage5_monitoring_service('mode',actor,'{"mode":"ON"}');
 c:=c||jsonb_build_object('id',fixture_id,'correlation_id',correlation,'issued_ms',(extract(epoch from clock_timestamp())*1000)::bigint,'expires_ms',(extract(epoch from clock_timestamp())*1000)::bigint+300000);
 perform public.stage3_dev_accept_service(c,repeat('0',64));
 if (select monitoring_mode from public.stage3_dev_operations where stage3_dev_operations.id=fixture_id)<>'ON' then raise exception 'Mode tag failed';end if;
 perform public.stage5_monitoring_service('sync');
 if not exists(select 1 from dev_monitoring.operations where operation_id=fixture_id and mode='ON') then raise exception 'Summary missing';end if;
 r:=jsonb_build_object('id',record_id,'operation_id',fixture_id,'correlation_id',correlation,'mode','ON','source','browser','metrics',jsonb_build_object('tap_saved_ms',123),'spans','[]'::jsonb,'clock','monotonic','schema_version',1);
 perform public.stage5_monitoring_service('ingest',actor,jsonb_build_object('records',jsonb_build_array(r)));
 perform public.stage5_monitoring_service('ingest',actor,jsonb_build_object('records',jsonb_build_array(r)));
 if (select count(*) from dev_monitoring.records where operation_id=fixture_id)<>1 then raise exception 'Duplicate retry inserted records';end if;
 begin
  perform public.stage5_monitoring_service('ingest',gen_random_uuid(),jsonb_build_object('records',jsonb_build_array(r)));
  raise exception 'Cross actor ingestion allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.stage5_monitoring_service('mode',gen_random_uuid(),'{"mode":"OFF"}');
  raise exception 'Unauthorized mode allowed';
 exception when insufficient_privilege then null;end;
 answer:=public.stage5_monitoring_service('history',actor,jsonb_build_object('household_id',gen_random_uuid()));
 if jsonb_array_length(answer->'operations')<>0 then raise exception 'Household leak';end if;
 perform public.stage5_monitoring_service('mode',actor,'{"mode":"OFF"}');
 answer:=public.stage5_monitoring_service('ingest',actor,jsonb_build_object('records',jsonb_build_array(r)));
 if answer->>'disabled'<>'true' then raise exception 'OFF ingestion allowed';end if;
 if has_function_privilege('authenticated','public.stage5_monitoring_service(text,uuid,jsonb)','execute') then raise exception 'Public privileged RPC';end if;
 if has_schema_privilege('authenticated','dev_monitoring','usage') then raise exception 'Public schema access';end if;
 -- Retention aggregates only optional monitoring data; original gateway evidence remains.
 update dev_monitoring.operations set accepted_at=clock_timestamp()-interval '91 days' where operation_id=fixture_id;
 perform public.stage5_monitoring_cleanup_service();
 if exists(select 1 from dev_monitoring.operations where operation_id=fixture_id) then raise exception 'Retention failed';end if;
 if not exists(select 1 from dev_monitoring.aggregates where actor_id=actor) then raise exception 'Downsample missing';end if;
 if not exists(select 1 from public.stage3_dev_operations where stage3_dev_operations.id=fixture_id) then raise exception 'Business evidence deleted';end if;
end $$;
select 'PASS: mode, derivation, idempotence, actor/household isolation, OFF, privileges, retention, business preservation' as result;
