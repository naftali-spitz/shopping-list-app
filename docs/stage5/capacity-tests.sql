-- Rollback-only capacity fault. No other connection sees the replacement helper.
create or replace function dev_monitoring.storage_bytes() returns bigint language sql security invoker set search_path=pg_catalog as $$ select 100000000::bigint $$;
do $$
declare c jsonb;fixture_id uuid:=gen_random_uuid();actor uuid;answer jsonb;
begin
 select command into c from public.stage3_dev_operations where command->>'type'='stage4.product.update' limit 1;
 actor:=(c->>'user_id')::uuid;
 insert into dev_monitoring.operators values(actor) on conflict do nothing;
 perform public.stage5_monitoring_service('mode',actor,'{"mode":"ON"}');
 c:=c||jsonb_build_object('id',fixture_id,'correlation_id',gen_random_uuid(),'issued_ms',(extract(epoch from clock_timestamp())*1000)::bigint,'expires_ms',(extract(epoch from clock_timestamp())*1000)::bigint+300000);
 answer:=public.stage3_dev_accept_service(c,repeat('0',64));
 if answer->>'id'<>fixture_id::text then raise exception 'Monitoring failure changed acceptance';end if;
 answer:=public.stage5_monitoring_service('sync');
 if answer->>'error'<>'capacity' then raise exception 'Capacity guard failed';end if;
 answer:=public.stage5_monitoring_service('ingest',actor,'{"records":[]}');
 if answer->>'persisted'<>'false' or answer->>'error'<>'capacity' then raise exception 'Capacity rejection not explicit';end if;
 if not exists(select 1 from public.stage3_dev_operations where id=fixture_id) then raise exception 'Acceptance lost';end if;
end $$;
select 'PASS: isolated capacity rejection leaves durable shopping acceptance intact; no successful persistence acknowledgement' as result;
