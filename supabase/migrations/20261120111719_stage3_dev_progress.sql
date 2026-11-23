-- DEVELOPMENT ONLY: ordering of diagnostic progress cannot change terminal results.
alter table public.stage3_dev_operations add column progress_state text,
  add column progress_issued_ms bigint, add column progress_at timestamptz;
create function public.stage3_dev_progress_service(p_progress jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare old public.stage3_dev_operations;
begin
  select * into old from public.stage3_dev_operations where id=(p_progress->>'operation_id')::uuid for update;
  if not found or old.user_id<>(p_progress->>'user_id')::uuid or old.household_id<>(p_progress->>'household_id')::uuid or old.correlation_id<>(p_progress->>'correlation_id')::uuid then
    raise exception 'Progress binding mismatch' using errcode='42501';
  end if;
  if p_progress->>'state' not in ('processing','failed_retryable','reconciliation_required') then
    raise exception 'Invalid progress' using errcode='22023';
  end if;
  if old.result is null and (old.progress_issued_ms is null or old.progress_issued_ms<(p_progress->>'issued_ms')::bigint) then
    update public.stage3_dev_operations set progress_state=p_progress->>'state',progress_issued_ms=(p_progress->>'issued_ms')::bigint,progress_at=clock_timestamp() where id=old.id;
  end if;
  return jsonb_build_object('id',old.id,'terminal',old.result is not null);
end; $$;
revoke all on function public.stage3_dev_progress_service(jsonb) from public,anon,authenticated;
grant execute on function public.stage3_dev_progress_service(jsonb) to service_role;
