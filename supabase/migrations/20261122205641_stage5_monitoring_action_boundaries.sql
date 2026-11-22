-- Different latency start boundaries are retained as separate distributions.
alter table dev_monitoring.aggregates
 add column action_saved_n bigint not null default 0,
 add column action_saved_sum_ms numeric not null default 0,
 add column action_optimistic_n bigint not null default 0,
 add column action_optimistic_sum_ms numeric not null default 0;
create or replace function public.stage5_monitoring_service(p_action text,p_actor uuid default null,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare s dev_monitoring.settings; row record; r jsonb; old jsonb; op dev_monitoring.operations; n integer:=0; rejected integer:=0; t timestamptz; until_time timestamptz; result jsonb; is_operator boolean;
begin
 if p_action='mode' then select * into s from dev_monitoring.settings where id for update;else select * into s from dev_monitoring.settings where id for share;end if;
 select exists(select 1 from dev_monitoring.operators where user_id=p_actor) into is_operator;
 if p_action='config' then return jsonb_build_object('mode',s.mode,'epoch',s.epoch,'operator',is_operator,'batch_size',50,'flush_ms',5000); end if;
 if p_action='mode' then
  if not is_operator or p_body->>'mode' not in ('OFF','MID','ON') then raise insufficient_privilege; end if;
  update dev_monitoring.settings set mode=p_body->>'mode',epoch=epoch+case when p_body->>'mode'='OFF' and mode<>'OFF' then 1 else 0 end where id returning * into s;
  insert into dev_monitoring.mode_audit(user_id,mode,epoch) values(p_actor,s.mode,s.epoch);
  return jsonb_build_object('mode',s.mode,'epoch',s.epoch);
 end if;
 if p_action='sync' then
  perform pg_advisory_xact_lock(hashtextextended('stage5-capacity',0));
  if dev_monitoring.storage_bytes()+512000>s.max_bytes then update dev_monitoring.health set capacity_rejections=capacity_rejections+1 where id;return jsonb_build_object('mode',s.mode,'epoch',s.epoch,'persisted',false,'error','capacity');end if;
  perform pg_advisory_xact_lock(hashtextextended('stage5-maintenance',0));
  -- Called in an independent Debian timer. No browser needs to stay open.
  if s.mode='OFF' then return jsonb_build_object('mode','OFF','persisted',false); end if;
  for row in select g.* from public.stage3_dev_operations g left join dev_monitoring.operations m on m.operation_id=g.id
    where g.monitoring_mode in ('MID','ON') and g.accepted_at>clock_timestamp()-make_interval(days=>s.detail_days)
    and (m.operation_id is null or m.outcome is distinct from coalesce(g.result->>'status','pending') or m.callback_count<>g.callback_count)
    order by g.accepted_at limit 500 loop
    if not exists(select 1 from dev_monitoring.operations where operation_id=row.id) and (select count(*) from dev_monitoring.operations)>=s.max_operations then
      update dev_monitoring.health set capacity_rejections=capacity_rejections+1 where id;exit;
    end if;
    insert into dev_monitoring.operations(operation_id,correlation_id,actor_id,household_id,operation_type,outcome,started_at,accepted_at,ended_at,mode,callback_count)
    values(row.id,row.correlation_id,row.user_id,row.household_id,row.command->>'type',coalesce(row.result->>'status','pending'),to_timestamp((row.command->>'issued_ms')::bigint/1000.0),row.accepted_at,row.confirmed_at,row.monitoring_mode,row.callback_count)
    on conflict(operation_id) do update set outcome=excluded.outcome,ended_at=excluded.ended_at,callback_count=excluded.callback_count,last_updated=clock_timestamp();
    n:=n+1;
  end loop;
  update dev_monitoring.health set last_sync=clock_timestamp() where id;
  return jsonb_build_object('mode',s.mode,'epoch',s.epoch,'derived',n);
 end if;
 if p_action='ingest' then
  perform pg_advisory_xact_lock(hashtextextended('stage5-capacity',0));
  if dev_monitoring.storage_bytes()+octet_length(p_body::text)*3>s.max_bytes then update dev_monitoring.health set capacity_rejections=capacity_rejections+1 where id;return jsonb_build_object('mode',s.mode,'epoch',s.epoch,'persisted',false,'error','capacity');end if;
  if s.mode='OFF' then return jsonb_build_object('persisted',false,'disabled',true); end if;
  if jsonb_array_length(p_body->'records')>100 then raise check_violation; end if;
  -- Batch transaction, immutable IDs. Source and ownership are assigned by Edge.
  for r in select value from jsonb_array_elements(p_body->'records') loop
    select * into op from dev_monitoring.operations where operation_id=(r->>'operation_id')::uuid;
    if not found then update dev_monitoring.health set rejected_records=rejected_records+1 where id;rejected:=rejected+1;continue;end if;
    if op.correlation_id<>(r->>'correlation_id')::uuid or p_actor is not null and op.actor_id<>p_actor then raise insufficient_privilege; end if;
    if not exists(select 1 from public.stage3_dev_operations where id=op.operation_id and monitoring_epoch=s.epoch) then rejected:=rejected+1;continue; end if;
    if s.mode<>'ON' or op.mode<>'ON' then r:=jsonb_set(r,'{spans}','[]');end if;
    select record into old from dev_monitoring.records where id=(r->>'id')::uuid;
    if found then if old-'spans'<>r-'spans' then raise unique_violation;end if;continue;end if;
    if (select count(*) from dev_monitoring.records where operation_id=op.operation_id)>=100 then update dev_monitoring.health set rejected_records=rejected_records+1 where id;rejected:=rejected+1;continue;end if;
    if (select count(*) from dev_monitoring.records)>=s.max_records then update dev_monitoring.health set capacity_rejections=capacity_rejections+1 where id;return jsonb_build_object('persisted',false,'error','capacity');end if;
    if s.mode<>'ON' or op.mode<>'ON' then r:=jsonb_set(r,'{spans}','[]');end if;
    insert into dev_monitoring.records(id,operation_id,correlation_id,source,record) values((r->>'id')::uuid,op.operation_id,op.correlation_id,r->>'source',r);
    n:=n+1;
  end loop;
  return jsonb_build_object('persisted',true,'inserted',n,'rejected',rejected);
 end if;
 if not is_operator then raise insufficient_privilege;end if;
 if p_action='detail' then
  select to_jsonb(m)-'actor_id'-'household_id' || jsonb_build_object('records',coalesce((select jsonb_agg(record order by recorded_at) from dev_monitoring.records r where r.operation_id=m.operation_id),'[]')) into result
   from dev_monitoring.operations m where actor_id=p_actor and household_id=(p_body->>'household_id')::uuid and operation_id=(p_body->>'id')::uuid;
  return jsonb_build_object('operation',result);
 end if;
 if p_action='history' then
  t:=coalesce((p_body->>'from')::timestamptz,clock_timestamp()-interval '24 hours');until_time:=coalesce((p_body->>'to')::timestamptz,clock_timestamp());
  if until_time<t or until_time-t>interval '366 days' then raise check_violation;end if;
  select coalesce(jsonb_agg(to_jsonb(q)-'actor_id'-'household_id'),'[]') into result from (
    select m.*,coalesce((select jsonb_agg(jsonb_set(r.record,'{spans}','[]')) from (select record from dev_monitoring.records r where r.operation_id=m.operation_id order by case when source='browser' and (record->'metrics' ? 'tap_saved_ms' or record->'metrics' ? 'action_saved_ms') then 0 when source='browser' then 1 else 2 end,recorded_at desc limit 3) r),'[]') records
    from dev_monitoring.operations m where actor_id=p_actor and household_id=(p_body->>'household_id')::uuid and accepted_at between t and until_time
    and (p_body->>'route' is null or backend_route=p_body->>'route') and (p_body->>'mode' is null or mode=p_body->>'mode')
    and (p_body->>'outcome' is null or outcome=p_body->>'outcome') and (p_body->>'type' is null or operation_type=p_body->>'type')
    and (p_body->>'id' is null or operation_id=(p_body->>'id')::uuid or correlation_id=(p_body->>'id')::uuid)
    order by accepted_at desc limit 200 offset least(greatest(coalesce((p_body->>'offset')::integer,0),0),200000)
  ) q;
  return jsonb_build_object('operations',result,'mode',s.mode,'health',(select to_jsonb(h) from dev_monitoring.health h where id),'limit',200,
    'aggregates',coalesce((select jsonb_agg(to_jsonb(a)-'actor_id'-'household_id') from dev_monitoring.aggregates a where actor_id=p_actor and household_id=(p_body->>'household_id')::uuid and day between t::date and until_time::date and p_body->>'id' is null and p_body->>'outcome' is null and (p_body->>'route' is null or backend_route=p_body->>'route') and (p_body->>'mode' is null or mode=p_body->>'mode') and (p_body->>'type' is null or operation_type=p_body->>'type')),'[]'));
 end if;
 raise check_violation;
end; $$;

create or replace function public.stage5_monitoring_cleanup_service() returns void language plpgsql security invoker set search_path=pg_catalog set timezone='UTC' as $$
declare s dev_monitoring.settings;cutoff timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('stage5-capacity',0));
 perform pg_advisory_xact_lock(hashtextextended('stage5-maintenance',0));
 select * into s from dev_monitoring.settings where id;
 cutoff:=clock_timestamp()-make_interval(days=>s.detail_days);
 insert into dev_monitoring.aggregates(day,actor_id,household_id,backend_route,mode,operation_type,total,successful,callback_receipts,saved_n,saved_sum_ms,optimistic_n,optimistic_sum_ms,action_saved_n,action_saved_sum_ms,action_optimistic_n,action_optimistic_sum_ms)
 select m.accepted_at::date,m.actor_id,m.household_id,m.backend_route,m.mode,m.operation_type,count(*),count(*) filter(where m.outcome in ('committed','snapshot','found')),sum(m.callback_count),
 count(v.saved_ms),coalesce(sum(v.saved_ms),0),count(v.optimistic_ms),coalesce(sum(v.optimistic_ms),0),count(v.action_saved_ms),coalesce(sum(v.action_saved_ms),0),count(v.action_optimistic_ms),coalesce(sum(v.action_optimistic_ms),0)
 from dev_monitoring.operations m
 left join lateral (select max((r.record->'metrics'->>'tap_saved_ms')::numeric) filter(where m.outcome='committed') saved_ms,max((r.record->'metrics'->>'tap_optimistic_ms')::numeric) optimistic_ms,max((r.record->'metrics'->>'action_saved_ms')::numeric) filter(where m.outcome='committed') action_saved_ms,max((r.record->'metrics'->>'action_optimistic_ms')::numeric) action_optimistic_ms
  from dev_monitoring.records r where r.operation_id=m.operation_id and r.source='browser') v on true
 where m.accepted_at<cutoff group by 1,2,3,4,5,6
 on conflict(day,actor_id,household_id,backend_route,mode,operation_type) do update set
 total=dev_monitoring.aggregates.total+excluded.total,successful=dev_monitoring.aggregates.successful+excluded.successful,
 callback_receipts=dev_monitoring.aggregates.callback_receipts+excluded.callback_receipts,
 saved_n=dev_monitoring.aggregates.saved_n+excluded.saved_n,saved_sum_ms=dev_monitoring.aggregates.saved_sum_ms+excluded.saved_sum_ms,
 optimistic_n=dev_monitoring.aggregates.optimistic_n+excluded.optimistic_n,optimistic_sum_ms=dev_monitoring.aggregates.optimistic_sum_ms+excluded.optimistic_sum_ms,
 action_saved_n=dev_monitoring.aggregates.action_saved_n+excluded.action_saved_n,action_saved_sum_ms=dev_monitoring.aggregates.action_saved_sum_ms+excluded.action_saved_sum_ms,
 action_optimistic_n=dev_monitoring.aggregates.action_optimistic_n+excluded.action_optimistic_n,action_optimistic_sum_ms=dev_monitoring.aggregates.action_optimistic_sum_ms+excluded.action_optimistic_sum_ms;
 delete from dev_monitoring.operations where accepted_at<cutoff;
 delete from dev_monitoring.aggregates where day<current_date-s.aggregate_days;
 delete from dev_monitoring.mode_audit where at<clock_timestamp()-make_interval(days=>s.aggregate_days);
end; $$;
alter function public.stage5_monitoring_service(text,uuid,jsonb) set timezone='UTC';
alter function public.stage5_monitoring_analytics_service(uuid,jsonb) set timezone='UTC';
