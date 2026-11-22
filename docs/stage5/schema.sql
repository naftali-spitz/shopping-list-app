do $$ begin if to_regclass('public.stage3_dev_operations') is null then raise exception 'Development gateway prerequisite missing';end if;end $$;
-- Only FutureCart Dev njomxqthjglqesxchlbm. Isolated optional diagnostics.
create schema if not exists dev_monitoring;
revoke all on schema dev_monitoring from public, anon, authenticated;
grant usage on schema dev_monitoring to service_role;
create table dev_monitoring.settings (
 id boolean primary key default true check(id), mode text not null default 'MID' check(mode in ('OFF','MID','ON')),
 epoch integer not null default 0, detail_days integer not null default 90 check(detail_days between 1 and 90),
 aggregate_days integer not null default 365 check(aggregate_days between 90 and 366),
 max_operations integer not null default 200000 check(max_operations between 100 and 200000),
 max_records integer not null default 1000000 check(max_records between 100 and 1000000)
);
insert into dev_monitoring.settings(id) values(true);
create table dev_monitoring.operators(user_id uuid primary key references auth.users(id));
create table dev_monitoring.mode_audit(id bigint generated always as identity primary key,at timestamptz not null default clock_timestamp(),user_id uuid not null,mode text not null,epoch integer not null);
create table dev_monitoring.operations (
 operation_id uuid primary key, correlation_id uuid not null, actor_id uuid not null, household_id uuid not null,
 operation_type text not null, outcome text not null, started_at timestamptz not null, accepted_at timestamptz not null, ended_at timestamptz,
 frontend_host text not null default 'vercel' check(frontend_host in ('vercel','debian_lan')),
 backend_route text not null default 'flespi' check(backend_route in ('flespi','direct_lan')),
 environment text not null default 'development' check(environment='development'),
 mode text not null check(mode in ('MID','ON')), callback_count integer not null default 0,
 trace_completeness text not null default 'partial', last_updated timestamptz not null default clock_timestamp()
);
create index monitoring_actor_time on dev_monitoring.operations(actor_id,household_id,accepted_at desc);
create index monitoring_route_time on dev_monitoring.operations(backend_route,mode,accepted_at desc);
create index monitoring_correlation on dev_monitoring.operations(correlation_id);
create table dev_monitoring.records (
 id uuid primary key, operation_id uuid not null references dev_monitoring.operations(operation_id) on delete cascade,
 correlation_id uuid not null, source text not null check(source in ('browser','debian')),
 recorded_at timestamptz not null default clock_timestamp(), record jsonb not null check(octet_length(record::text)<=16000)
);
create index monitoring_records_operation on dev_monitoring.records(operation_id,recorded_at);
create table dev_monitoring.aggregates (
 day date not null, actor_id uuid not null, household_id uuid not null, backend_route text not null, mode text not null,operation_type text not null,
 total bigint not null, successful bigint not null, callback_attempts bigint not null,
 primary key(day,actor_id,household_id,backend_route,mode,operation_type)
);
create table dev_monitoring.health(id boolean primary key default true check(id),last_sync timestamptz,capacity_rejections bigint not null default 0,rejected_records bigint not null default 0);
insert into dev_monitoring.health(id) values(true);
alter table public.stage3_dev_operations add column monitoring_mode text, add column monitoring_epoch integer;
-- A single local setting read, no diagnostic writes or external I/O in acceptance.
create function dev_monitoring.tag_operation() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.command->>'type' not in ('snapshot','operation.status','stage4.snapshot','stage4.operation.status') then
   select mode,epoch into new.monitoring_mode,new.monitoring_epoch from dev_monitoring.settings where id;
 end if;
 return new;
exception when others then return new; -- Optional diagnostics must not reject a shopping acceptance.
end; $$;
revoke all on function dev_monitoring.tag_operation() from public,anon,authenticated;
create trigger stage5_monitoring_tag before insert on public.stage3_dev_operations for each row execute function dev_monitoring.tag_operation();
create index stage5_monitoring_candidates on public.stage3_dev_operations(accepted_at) where monitoring_mode in ('MID','ON');

-- All calls service-only after Edge verifies session/signature. No client SQL API.
create function public.stage5_monitoring_service(p_action text,p_actor uuid default null,p_body jsonb default '{}') returns jsonb
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
  perform pg_advisory_xact_lock(hashtextextended('stage5-maintenance',0));
  -- Called in an independent Debian timer. No browser needs to stay open.
  if s.mode='OFF' then return jsonb_build_object('mode','OFF','persisted',false); end if;
  for row in select g.* from public.stage3_dev_operations g left join dev_monitoring.operations m on m.operation_id=g.id
    where g.monitoring_mode in ('MID','ON') and g.monitoring_epoch=s.epoch and g.accepted_at>clock_timestamp()-make_interval(days=>s.detail_days)
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
    if (select count(*) from dev_monitoring.records)>=s.max_records then update dev_monitoring.health set capacity_rejections=capacity_rejections+1 where id;raise exception 'capacity' using errcode='54000';end if;
    if s.mode<>'ON' or op.mode<>'ON' then r:=jsonb_set(r,'{spans}','[]');end if;
    insert into dev_monitoring.records(id,operation_id,correlation_id,source,record) values((r->>'id')::uuid,op.operation_id,op.correlation_id,r->>'source',r);
    n:=n+1;
  end loop;
  return jsonb_build_object('persisted',true,'inserted',n,'rejected',rejected);
 end if;
 if not is_operator then raise insufficient_privilege;end if;
 if p_action='history' then
  t:=coalesce((p_body->>'from')::timestamptz,clock_timestamp()-interval '24 hours');until_time:=coalesce((p_body->>'to')::timestamptz,clock_timestamp());
  if until_time<t or until_time-t>interval '366 days' then raise check_violation;end if;
  select coalesce(jsonb_agg(to_jsonb(q)-'actor_id'-'household_id'),'[]') into result from (
    select m.*,coalesce((select jsonb_agg(record order by recorded_at) from dev_monitoring.records r where r.operation_id=m.operation_id),'[]') records
    from dev_monitoring.operations m where actor_id=p_actor and household_id=(p_body->>'household_id')::uuid and accepted_at between t and until_time
    and (p_body->>'route' is null or backend_route=p_body->>'route') and (p_body->>'mode' is null or mode=p_body->>'mode')
    and (p_body->>'outcome' is null or outcome=p_body->>'outcome') and (p_body->>'type' is null or operation_type=p_body->>'type')
    and (p_body->>'id' is null or operation_id=(p_body->>'id')::uuid or correlation_id=(p_body->>'id')::uuid)
    order by accepted_at desc limit 200 offset least(greatest(coalesce((p_body->>'offset')::integer,0),0),200000)
  ) q;
  return jsonb_build_object('operations',result,'mode',s.mode,'health',(select to_jsonb(h) from dev_monitoring.health h where id),'limit',200,
    'aggregates',coalesce((select jsonb_agg(to_jsonb(a)-'actor_id'-'household_id') from dev_monitoring.aggregates a where actor_id=p_actor and household_id=(p_body->>'household_id')::uuid and day between t::date and until_time::date),'[]'));
 end if;
 raise check_violation;
end; $$;
revoke all on function public.stage5_monitoring_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.stage5_monitoring_service(text,uuid,jsonb) to service_role;
-- Separate scheduled maintenance, never touches shopping reconciliation data.
create function public.stage5_monitoring_cleanup_service() returns void language plpgsql security invoker set search_path=pg_catalog as $$
declare s dev_monitoring.settings;
begin
 perform pg_advisory_xact_lock(hashtextextended('stage5-maintenance',0));
 select * into s from dev_monitoring.settings where id;
 insert into dev_monitoring.aggregates
 select accepted_at::date,actor_id,household_id,backend_route,mode,operation_type,count(*),count(*) filter(where outcome='committed'),sum(callback_count)
 from dev_monitoring.operations where accepted_at<clock_timestamp()-make_interval(days=>s.detail_days) group by 1,2,3,4,5,6
 on conflict(day,actor_id,household_id,backend_route,mode,operation_type) do update set total=dev_monitoring.aggregates.total+excluded.total,successful=dev_monitoring.aggregates.successful+excluded.successful,callback_attempts=dev_monitoring.aggregates.callback_attempts+excluded.callback_attempts;
 delete from dev_monitoring.operations where accepted_at<clock_timestamp()-make_interval(days=>s.detail_days);
 delete from dev_monitoring.aggregates where day<current_date-s.aggregate_days;
 delete from dev_monitoring.mode_audit where at<clock_timestamp()-make_interval(days=>s.aggregate_days);
end; $$;
revoke all on function public.stage5_monitoring_cleanup_service() from public,anon,authenticated;
grant execute on function public.stage5_monitoring_cleanup_service() to service_role;
grant select,insert,update,delete on all tables in schema dev_monitoring to service_role;
grant usage,select on all sequences in schema dev_monitoring to service_role;
do $$ declare t text;begin for t in select tablename from pg_tables where schemaname='dev_monitoring' loop execute format('alter table dev_monitoring.%I enable row level security',t);execute format('alter table dev_monitoring.%I force row level security',t);end loop;end $$;

create or replace function public.stage3_dev_accept_service(p_command jsonb,p_hash text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare old public.stage3_dev_operations; subject uuid := (p_command->>'user_id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('stage3:'||subject::text,0));
  select * into old from public.stage3_dev_operations where id=(p_command->>'id')::uuid;
  if found then
    if old.user_id<>subject or old.household_id<>(p_command->>'household_id')::uuid or old.canonical_hash<>p_hash then
      raise exception 'Operation ID conflict' using errcode='23505';
    end if;
    return jsonb_build_object('id',old.id,'accepted_at',old.accepted_at,'result',old.result,'duplicate',true,'monitoring_mode',old.monitoring_mode);
  end if;
  if (select count(*) from public.stage3_dev_operations where user_id=subject and accepted_at>clock_timestamp()-interval '1 minute')>=60 then
    raise exception 'Rate limited' using errcode='54000';
  end if;
  if p_command->>'iss' is distinct from 'urn:shopping:stage3:vercel:development' or
     p_command->>'aud' is distinct from 'urn:shopping:stage3:debian:development' or
     (p_command->>'expires_ms')::bigint<=extract(epoch from clock_timestamp())*1000 then
    raise exception 'Invalid or expired command' using errcode='22023';
  end if;
  insert into public.stage3_dev_operations(id,user_id,household_id,correlation_id,canonical_hash,command)
    values((p_command->>'id')::uuid,subject,(p_command->>'household_id')::uuid,(p_command->>'correlation_id')::uuid,p_hash,p_command)
    returning * into old;
  return jsonb_build_object('id',old.id,'accepted_at',old.accepted_at,'result',null,'duplicate',false,'monitoring_mode',old.monitoring_mode);
end; $$;
