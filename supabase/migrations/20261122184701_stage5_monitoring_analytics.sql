-- FutureCart Dev only; prerequisite schema is absent from production.
create function public.stage5_monitoring_analytics_service(p_actor uuid,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz:=coalesce((p_body->>'from')::timestamptz,clock_timestamp()-interval '24 hours');
 u timestamptz:=coalesce((p_body->>'to')::timestamptz,clock_timestamp());answer jsonb;
begin
 if not exists(select 1 from dev_monitoring.operators where user_id=p_actor) then raise insufficient_privilege;end if;
 if u<t or u-t>interval '366 days' then raise check_violation;end if;
 with candidates as materialized (
  select m.* from dev_monitoring.operations m where actor_id=p_actor and household_id=(p_body->>'household_id')::uuid and accepted_at between t and u
   and (p_body->>'route' is null or backend_route=p_body->>'route') and (p_body->>'mode' is null or mode=p_body->>'mode')
   and (p_body->>'outcome' is null or outcome=p_body->>'outcome') and (p_body->>'type' is null or operation_type=p_body->>'type')
   and (p_body->>'id' is null or operation_id=(p_body->>'id')::uuid or correlation_id=(p_body->>'id')::uuid)
 ), metrics as materialized (
  -- One maximum reported duration per metric and operation; attempts remain separate in detail.
  select c.operation_id,e.key,max((e.value#>>'{}')::double precision) value
  from candidates c join dev_monitoring.records r using(operation_id) cross join lateral jsonb_each(r.record->'metrics') e
  group by c.operation_id,e.key
 ), summary as (
  select count(*) total,count(*) filter(where outcome='committed') successful,
   count(*) filter(where outcome='pending') pending,
   count(*) filter(where outcome not in ('committed','pending')) failed,
   count(*) filter(where exists(select 1 from metrics x where x.operation_id=c.operation_id and x.key='retry_count' and x.value>0)) client_retried,
   count(*) filter(where not exists(select 1 from dev_monitoring.records r where r.operation_id=c.operation_id and source='browser')) missing_browser,
   count(*) filter(where not exists(select 1 from dev_monitoring.records r where r.operation_id=c.operation_id and source='debian')) missing_debian
  from candidates c
 ), metric_stats as (
  select key,count(*) n,avg(value) average,percentile_cont(.5) within group(order by value) p50,
   case when count(*)>=100 then percentile_cont(.95) within group(order by value) end p95,
   case when count(*)>=1000 then percentile_cont(.99) within group(order by value) end p99
  from metrics group by key
 ), trend as (
  select date_trunc('hour',c.accepted_at) as "hour",m.key,count(*) n,avg(m.value) average,percentile_cont(.5) within group(order by m.value) p50
  from candidates c join metrics m using(operation_id) group by 1,2
 ), outcomes as (
  select date_trunc('hour',accepted_at) as "hour",count(*) total,count(*) filter(where outcome='committed') successful,count(*) filter(where outcome not in ('committed','pending')) failed from candidates group by 1
 ) select jsonb_build_object('summary',(select to_jsonb(s) from summary s),'metrics',coalesce((select jsonb_agg(s) from metric_stats s),'[]'),
  'trend',coalesce((select jsonb_agg(s order by "hour") from trend s),'[]'),'outcomes',coalesce((select jsonb_agg(s order by "hour") from outcomes s),'[]'),
  'scope','entire authorized filtered date range','retry_definition','client retry count only; duplicate callback receipts are not retry proof') into answer;
 return answer;
end; $$;
revoke all on function public.stage5_monitoring_analytics_service(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.stage5_monitoring_analytics_service(uuid,jsonb) to service_role;
-- Conservative POC record caps; admission metrics/capacity remain visible.
update dev_monitoring.settings set max_operations=10000,max_records=30000;
alter table dev_monitoring.settings alter column max_operations set default 10000,alter column max_records set default 30000;
