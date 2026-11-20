-- DEVELOPMENT ONLY. Business data remains in Debian PostgreSQL.
create table public.stage3_dev_operations (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  household_id uuid not null references public.households(id),
  correlation_id uuid not null,
  canonical_hash text not null check(length(canonical_hash)=64),
  command jsonb not null check(octet_length(command::text)<=20000),
  accepted_at timestamptz not null default clock_timestamp(),
  result jsonb,
  confirmed_at timestamptz,
  callback_count integer not null default 0
);
alter table public.stage3_dev_operations enable row level security;
alter table public.stage3_dev_operations force row level security;
revoke all on public.stage3_dev_operations from public,anon,authenticated;
grant select,insert,update on public.stage3_dev_operations to service_role;
create index stage3_dev_pending on public.stage3_dev_operations(accepted_at) where result is null;
create index stage3_dev_actor on public.stage3_dev_operations(user_id,accepted_at);

create function public.stage3_dev_accept_service(p_command jsonb,p_hash text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare old public.stage3_dev_operations; subject uuid := (p_command->>'user_id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('stage3:'||subject::text,0));
  select * into old from public.stage3_dev_operations where id=(p_command->>'id')::uuid;
  if found then
    if old.user_id<>subject or old.household_id<>(p_command->>'household_id')::uuid or old.canonical_hash<>p_hash then
      raise exception 'Operation ID conflict' using errcode='23505';
    end if;
    return jsonb_build_object('id',old.id,'accepted_at',old.accepted_at,'result',old.result,'duplicate',true);
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
  return jsonb_build_object('id',old.id,'accepted_at',old.accepted_at,'result',null,'duplicate',false);
end; $$;

create function public.stage3_dev_result_service(p_result jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare old public.stage3_dev_operations;
begin
  select * into old from public.stage3_dev_operations where id=(p_result->>'operation_id')::uuid for update;
  if not found or old.user_id<>(p_result->>'user_id')::uuid or old.household_id<>(p_result->>'household_id')::uuid or
     old.correlation_id<>(p_result->>'correlation_id')::uuid then
    raise exception 'Result binding mismatch' using errcode='42501';
  end if;
  if old.result is not null and old.result<>p_result then
    raise exception 'Terminal result immutable' using errcode='23505';
  end if;
  update public.stage3_dev_operations set result=p_result,confirmed_at=coalesce(confirmed_at,clock_timestamp()),callback_count=callback_count+1 where id=old.id;
  return jsonb_build_object('id',old.id,'duplicate',old.result is not null);
end; $$;
revoke all on function public.stage3_dev_accept_service(jsonb,text) from public,anon,authenticated;
revoke all on function public.stage3_dev_result_service(jsonb) from public,anon,authenticated;
grant execute on function public.stage3_dev_accept_service(jsonb,text) to service_role;
grant execute on function public.stage3_dev_result_service(jsonb) to service_role;
