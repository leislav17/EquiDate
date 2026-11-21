create table public.provisional_live_results (
  class_id uuid not null,
  start_version_id uuid not null,
  position integer not null check (position > 0),
  obstacle_faults integer not null check (obstacle_faults between 0 and 999),
  time_seconds numeric(9,2) not null check (time_seconds >= 0 and time_seconds <= 9999999),
  updated_at timestamptz not null default now(),
  primary key (class_id, start_version_id, position),
  foreign key (class_id, start_version_id) references public.start_list_versions(class_id, id) on delete restrict
);
alter table public.provisional_live_results enable row level security;
revoke all on public.provisional_live_results from public, anon, authenticated;
grant select on public.provisional_live_results to anon, authenticated;
grant all on public.provisional_live_results to service_role;
create policy provisional_live_results_public_read on public.provisional_live_results for select to anon, authenticated using (
  exists (select 1 from public.competition_classes c
    join public.events e on e.id=c.event_id
    join public.start_lists h on h.class_id=c.id
    join public.start_list_versions v on v.id=h.version_id and v.class_id=c.id
    where c.id=provisional_live_results.class_id and e.status='published'
      and h.version_id=provisional_live_results.start_version_id
      and exists (select 1 from jsonb_array_elements(v.entries) item
        where (item->>'position')::integer=provisional_live_results.position
          and length(trim(coalesce(item->>'category',''))) > 0))
);
create function public.equidate_external_save_live_result(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, faults integer, seconds numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare event_end date;
begin
  if actor is null or target_event is null or target_class is null or start_version is null or target_position is null or target_position < 1 or faults is null or faults not between 0 and 999 or seconds is null or seconds < 0 or seconds > 9999999 or seconds <> round(seconds, 2) then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido o concurso inválido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inválida'; end if;
  perform 1 from public.start_lists h where h.class_id=target_class and h.version_id=start_version for share;
  if not found then raise exception 'El orden publicado cambió. Actualizá antes de guardar.' using errcode='40001'; end if;
  perform 1 from public.start_list_versions v, jsonb_array_elements(v.entries) item where v.class_id=target_class and v.id=start_version and (item->>'position')::integer=target_position;
  if not found then raise exception 'Binomio inválido'; end if;
  insert into public.provisional_live_results(class_id,start_version_id,position,obstacle_faults,time_seconds)
  values(target_class,start_version,target_position,faults,seconds)
  on conflict(class_id,start_version_id,position) do update set obstacle_faults=excluded.obstacle_faults,time_seconds=excluded.time_seconds,updated_at=clock_timestamp();
end $$;
revoke all on function public.equidate_external_save_live_result(uuid,uuid,uuid,uuid,integer,integer,numeric) from public, anon, authenticated;
grant execute on function public.equidate_external_save_live_result(uuid,uuid,uuid,uuid,integer,integer,numeric) to service_role;
