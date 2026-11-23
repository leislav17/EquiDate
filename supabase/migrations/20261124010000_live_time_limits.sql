create table public.live_time_limits (
  class_id uuid primary key references public.live_result_starts(class_id) on delete cascade,
  settings jsonb not null
);

alter table public.live_time_limits enable row level security;
revoke all on public.live_time_limits from public, anon, authenticated;
grant select on public.live_time_limits to anon, authenticated;
grant all on public.live_time_limits to service_role;

create policy live_time_limits_shared_read on public.live_time_limits
  for select to anon, authenticated using (
    exists (select 1 from public.live_result_starts s
      where s.class_id = live_time_limits.class_id and s.public_visible)
  );

create function public.equidate_live_time_limits(
  target_event uuid, target_class uuid, expected jsonb default null, proposed jsonb default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_settings jsonb;
begin
  perform 1 from auth.users u
  where u.id = auth.uid() and u.raw_app_meta_data->>'equidate_external' = 'true'
    and (u.banned_until is null or u.banned_until <= clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode = '42501'; end if;

  perform 1 from public.external_event_assignments a
  join public.events e on e.id = a.event_id
  join public.competition_classes c on c.event_id = e.id
  where a.user_id = auth.uid() and e.id = target_event and c.id = target_class
    and coalesce(e.discipline, 'jumping') = 'jumping'
    and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date <= e.end_date + 1
  for share of a, e, c;
  if not found then raise exception 'Concurso no autorizado' using errcode = '42501'; end if;

  perform 1 from public.live_result_starts where class_id = target_class for update;
  if not found then raise exception 'La carga todavía no comenzó' using errcode = '42501'; end if;

  select settings into current_settings from public.live_time_limits where class_id = target_class;
  current_settings := coalesce(current_settings, '{}'::jsonb);
  if proposed is null then return current_settings; end if;
  if expected is distinct from current_settings then
    raise exception 'Otra sesión cambió los tiempos acordados' using errcode = '40001';
  end if;

  if jsonb_typeof(proposed) <> 'object' or octet_length(proposed::text) > 4096 then
    raise exception 'Tiempos inválidos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(proposed) as p(key, value)
    where p.key not in ('1', '2') or jsonb_typeof(p.value) <> 'object') then
    raise exception 'Parte inválida' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(proposed) p cross join lateral jsonb_each(p.value) f
    where f.key not in ('distance', 'sharedAllowed', 'schoolAllowed', 'thirdAllowed',
      'sharedOptimal', 'schoolOptimal', 'thirdOptimal')
      or jsonb_typeof(f.value) <> 'number'
      or f.value::text !~ '^[1-9][0-9]{0,5}$'
  ) then
    raise exception 'Ingresá valores positivos en números enteros' using errcode = '22023';
  end if;

  insert into public.live_time_limits(class_id, settings) values (target_class, proposed)
  on conflict (class_id) do update set settings = excluded.settings;
  return proposed;
end $$;

revoke all on function public.equidate_live_time_limits(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.equidate_live_time_limits(uuid,uuid,jsonb,jsonb) to authenticated;
