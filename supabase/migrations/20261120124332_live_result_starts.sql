create table public.live_result_starts (
  class_id uuid primary key references public.competition_classes(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.live_result_starts enable row level security;
revoke all on public.live_result_starts from public, anon, authenticated;
grant select on public.live_result_starts to anon, authenticated;
grant all on public.live_result_starts to service_role;
create policy live_result_starts_public_read on public.live_result_starts for select to anon, authenticated using (
  exists (select 1 from public.competition_classes c join public.events e on e.id=c.event_id where c.id=class_id and e.status='published')
);

insert into public.live_result_starts (class_id)
select class_id from public.provisional_live_results
union select class_id from public.manual_live_entries where time_seconds is not null
on conflict do nothing;

create function public.equidate_start_live_results(actor uuid, target_event uuid, target_class uuid)
returns void language plpgsql security definer set search_path='' as $$
declare event_end date;
begin
  if actor is null or target_event is null or target_class is null then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inv�lida' using errcode='42501'; end if;
  insert into public.live_result_starts(class_id) values(target_class) on conflict do nothing;
end $$;
revoke all on function public.equidate_start_live_results(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.equidate_start_live_results(uuid,uuid,uuid) to service_role;

