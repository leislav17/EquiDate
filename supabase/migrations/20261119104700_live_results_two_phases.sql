alter table public.provisional_live_results
  add column phase2_faults integer check (phase2_faults between 0 and 999),
  add column phase2_seconds numeric(9,2) check (phase2_seconds between 0 and 9999999),
  add constraint phase2_complete check ((phase2_faults is null) = (phase2_seconds is null));

create function public.equidate_external_save_live_result_phases(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, faults integer, seconds numeric, second_faults integer, second_seconds numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (second_faults is null) <> (second_seconds is null) or (second_faults is not null and (second_faults not between 0 and 999 or second_seconds < 0 or second_seconds > 9999999 or second_seconds <> round(second_seconds, 2))) then
    raise exception 'Datos inválidos';
  end if;
  perform public.equidate_external_save_live_result(actor, target_event, target_class, start_version, target_position, faults, seconds);
  update public.provisional_live_results set phase2_faults=second_faults, phase2_seconds=second_seconds
    where class_id=target_class and start_version_id=start_version and position=target_position;
end $$;
revoke all on function public.equidate_external_save_live_result_phases(uuid,uuid,uuid,uuid,integer,integer,numeric,integer,numeric) from public, anon, authenticated;
grant execute on function public.equidate_external_save_live_result_phases(uuid,uuid,uuid,uuid,integer,integer,numeric,integer,numeric) to service_role;
