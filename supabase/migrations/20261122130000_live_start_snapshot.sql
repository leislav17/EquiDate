-- Keep live participants and their source version fixed when the operator starts.
create table public.live_start_snapshots (
  class_id uuid primary key references public.live_result_starts(class_id) on delete cascade,
  version_id uuid,
  entries jsonb not null default '[]'::jsonb,
  foreign key (class_id, version_id) references public.start_list_versions(class_id, id) on delete restrict
);
alter table public.live_start_snapshots enable row level security;
revoke all on public.live_start_snapshots from public, anon, authenticated;
grant select on public.live_start_snapshots to anon, authenticated;
grant all on public.live_start_snapshots to service_role;
create policy live_start_snapshots_shared_read on public.live_start_snapshots
  for select to anon, authenticated
  using (exists (
    select 1 from public.live_result_starts s
    where s.class_id = live_start_snapshots.class_id and s.public_visible
  ));

-- The previous public live used the head current at migration time.
insert into public.live_start_snapshots (class_id, version_id, entries)
select s.class_id, v.id, coalesce(v.entries, '[]'::jsonb)
from public.live_result_starts s
left join public.start_lists h on h.class_id = s.class_id
left join public.start_list_versions v on v.class_id = s.class_id and v.id = h.version_id;

create function public.equidate_snapshot_live_start()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.live_start_snapshots (class_id, version_id, entries)
  select new.class_id, v.id, coalesce(v.entries, '[]'::jsonb)
  from (select new.class_id as class_id) c
  left join public.start_lists h on h.class_id = c.class_id
  left join public.start_list_versions v on v.class_id = c.class_id and v.id = h.version_id;
  return new;
end $$;
revoke all on function public.equidate_snapshot_live_start() from public, anon, authenticated;
create trigger snapshot_live_start after insert on public.live_result_starts
for each row execute function public.equidate_snapshot_live_start();

alter policy provisional_live_results_public_read on public.provisional_live_results using (
  exists (select 1 from public.live_start_snapshots s
    where s.class_id = provisional_live_results.class_id and s.version_id = provisional_live_results.start_version_id)
);

alter policy live_tracking_public_read on public.live_tracking using (
  exists (select 1 from public.live_start_snapshots s
    where s.class_id = live_tracking.class_id and s.version_id = live_tracking.start_version_id)
);

alter policy live_combined_order_public_read on public.live_combined_order using (
  exists (select 1 from public.live_start_snapshots s
    where s.class_id = live_combined_order.class_id and s.version_id = live_combined_order.start_version_id)
);

create or replace function public.equidate_external_save_live_result(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, faults integer, seconds numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare event_end date;
begin
  if actor is null or target_event is null or target_class is null or start_version is null or target_position is null or target_position < 1 or faults is null or faults not between 0 and 999 or seconds is null or seconds < 0 or seconds > 9999999 or seconds <> round(seconds, 2) then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido o concurso inv�lido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inv�lida'; end if;
  perform 1 from public.live_start_snapshots h where h.class_id=target_class and h.version_id=start_version for share;
  if not found then raise exception 'El orden publicado cambi�. Actualiz� antes de guardar.' using errcode='40001'; end if;
  perform 1 from public.live_start_snapshots v, jsonb_array_elements(v.entries) item where v.class_id=target_class and v.version_id=start_version and (item->>'position')::integer=target_position;
  if not found then raise exception 'Binomio inv�lido'; end if;
  insert into public.provisional_live_results(class_id,start_version_id,position,obstacle_faults,time_seconds)
  values(target_class,start_version,target_position,faults,seconds)
  on conflict(class_id,start_version_id,position) do update set obstacle_faults=excluded.obstacle_faults,time_seconds=excluded.time_seconds,updated_at=clock_timestamp();
end $$;

create or replace function public.equidate_reorder_live(actor uuid, target_event uuid, target_class uuid, start_version uuid, expected_order integer[], new_order integer[])
returns void language plpgsql security definer set search_path='' as $$
declare event_end date; original_order integer[]; actual_order integer[]; n integer;
begin
  if actor is null or target_event is null or target_class is null or start_version is null or expected_order is null or new_order is null then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inv�lida'; end if;
  perform 1 from public.live_start_snapshots h where h.class_id=target_class and h.version_id=start_version for share;
  if not found then raise exception 'El orden publicado cambi�' using errcode='40001'; end if;
  select array_agg((item->>'position')::integer order by (item->>'position')::integer) into original_order from public.live_start_snapshots v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.version_id=start_version;
  if original_order is null or cardinality(new_order) <> cardinality(original_order) or array_position(new_order,null) is not null then raise exception 'Orden inv�lido'; end if;
  select count(distinct x) into n from unnest(new_order) x;
  if n <> cardinality(original_order) or not (new_order @> original_order and original_order @> new_order) then raise exception 'Orden inv�lido'; end if;
  insert into public.live_tracking(class_id,start_version_id) values(target_class,start_version) on conflict do nothing;
  select coalesce(live_order,original_order) into actual_order from public.live_tracking where class_id=target_class and start_version_id=start_version for update;
  if expected_order is distinct from actual_order then raise exception 'El orden cambi�; actualiz�' using errcode='40001'; end if;
  update public.live_tracking set live_order=new_order where class_id=target_class and start_version_id=start_version;
end $$;

create or replace function public.equidate_live_tracking_action(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, action text)
returns void language plpgsql security definer set search_path='' as $$
declare event_end date; current_pos integer; next_pos integer;
begin
  if actor is null or target_event is null or target_class is null or start_version is null or target_position is null or target_position < 1 or action not in ('current','absent','restore','advance') then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inv�lida'; end if;
  perform 1 from public.live_start_snapshots h where h.class_id=target_class and h.version_id=start_version for share;
  if not found then raise exception 'El orden publicado cambi�' using errcode='40001'; end if;
  perform 1 from public.live_start_snapshots v, jsonb_array_elements(v.entries) item where v.class_id=target_class and v.version_id=start_version and (item->>'position')::integer=target_position;
  if not found then raise exception 'Binomio inv�lido'; end if;
  insert into public.live_tracking(class_id,start_version_id) values(target_class,start_version) on conflict do nothing;
  select current_position into current_pos from public.live_tracking where class_id=target_class and start_version_id=start_version for update;
  if action='current' then
    if exists(select 1 from public.live_tracking where class_id=target_class and start_version_id=start_version and target_position=any(no_shows)) then raise exception 'El binomio no se present�'; end if;
    update public.live_tracking set current_position=target_position where class_id=target_class and start_version_id=start_version;
  elsif action='restore' then
    update public.live_tracking set no_shows=array_remove(no_shows,target_position) where class_id=target_class and start_version_id=start_version;
  elsif action='absent' then
    if exists(select 1 from public.provisional_live_results where class_id=target_class and start_version_id=start_version and position=target_position) then raise exception 'Ya tiene resultado'; end if;
    update public.live_tracking set no_shows=array_append(array_remove(no_shows,target_position),target_position) where class_id=target_class and start_version_id=start_version;
  end if;
  if current_pos=target_position and action in ('absent','advance') then
    select candidate.pos into next_pos from unnest(coalesce(
      (select live_order from public.live_tracking where class_id=target_class and start_version_id=start_version),
      (select array_agg((item->>'position')::integer order by (item->>'position')::integer) from public.live_start_snapshots v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.version_id=start_version)
    )) with ordinality candidate(pos,idx)
    where candidate.idx > coalesce(array_position(coalesce((select live_order from public.live_tracking where class_id=target_class and start_version_id=start_version),
      (select array_agg((item->>'position')::integer order by (item->>'position')::integer) from public.live_start_snapshots v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.version_id=start_version)),target_position),0)
      and not exists(select 1 from public.provisional_live_results r where r.class_id=target_class and r.start_version_id=start_version and r.position=candidate.pos)
      and not exists(select 1 from public.live_tracking t where t.class_id=target_class and t.start_version_id=start_version and candidate.pos=any(t.no_shows)) order by candidate.idx limit 1;
    update public.live_tracking set current_position=next_pos where class_id=target_class and start_version_id=start_version;
  end if;
end $$;

create or replace function public.equidate_set_combined_live_order(
  actor uuid, target_event uuid, target_class uuid, start_version uuid,
  expected_revision bigint, new_entries text[]
) returns bigint language plpgsql security definer set search_path = '' as $$
declare actual_revision bigint; valid_entries text[]; result_revision bigint;
begin
  if actor is null or new_entries is null or array_position(new_entries, null) is not null
    then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor
    and u.raw_app_meta_data->>'equidate_external'='true'
    and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a
    join public.events e on e.id=a.event_id
    join public.competition_classes c on c.event_id=e.id
    join public.live_start_snapshots h on h.class_id=c.id
    where a.user_id=actor and e.id=target_event and c.id=target_class
      and h.version_id=start_version and coalesce(e.discipline,'jumping')='jumping'
      and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date <= e.end_date+1
    for share of a,e,c,h;
  if not found then raise exception 'Acceso o listado inv�lido' using errcode='42501'; end if;
  select array_agg(k order by k) into valid_entries from (
    select 'p:' || (item->>'position') as k
      from public.live_start_snapshots v cross join lateral jsonb_array_elements(v.entries) item
      where v.class_id=target_class and v.version_id=start_version
    union all
    select 'm:' || m.id::text from public.manual_live_entries m where m.class_id=target_class
  ) entries;
  if coalesce(cardinality(valid_entries),0) <> cardinality(new_entries)
     or (select array_agg(x order by x) from unnest(new_entries) x)
       is distinct from valid_entries then raise exception 'Orden inv�lido'; end if;
  insert into public.live_combined_order(class_id,start_version_id)
    values(target_class,start_version) on conflict do nothing;
  select revision into actual_revision from public.live_combined_order
    where class_id=target_class and start_version_id=start_version for update;
  if actual_revision <> expected_revision then
    raise exception 'El orden cambi�; actualiz�' using errcode='40001';
  end if;
  update public.live_combined_order set entries=new_entries, revision=revision+1
    where class_id=target_class and start_version_id=start_version returning revision into result_revision;
  insert into public.live_tracking(class_id,start_version_id,live_order)
    values(target_class,start_version, array(select substring(k from 3)::integer from unnest(new_entries) with ordinality as t(k,n) where k like 'p:%' order by n))
    on conflict(class_id,start_version_id) do update set live_order=excluded.live_order;
  return result_revision;
end $$;

create or replace function public.equidate_set_manual_only_order(actor uuid, target_event uuid, target_class uuid, expected_revision bigint, new_entries text[])
returns bigint language plpgsql security definer set search_path='' as $$
declare actual_revision bigint; valid_entries text[]; result_revision bigint;
begin
  if actor is null or target_event is null or target_class is null or expected_revision is null or new_entries is null or array_position(new_entries,null) is not null then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a join public.events e on e.id=a.event_id join public.competition_classes c on c.event_id=e.id
    where a.user_id=actor and e.id=target_event and c.id=target_class and coalesce(e.discipline,'jumping')='jumping'
    and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date<=e.end_date+1 for share of a,e,c;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  if not exists(select 1 from public.live_start_snapshots h where h.class_id=target_class and h.version_id is null) then raise exception 'El listado cambi�' using errcode='40001'; end if;
  select array_agg('m:'||m.id::text order by 'm:'||m.id::text) into valid_entries from public.manual_live_entries m where m.class_id=target_class;
  if coalesce(cardinality(valid_entries),0)<>cardinality(new_entries) or (select array_agg(x order by x) from unnest(new_entries) x) is distinct from valid_entries then raise exception 'Orden inv�lido'; end if;
  insert into public.live_manual_only_order(class_id) values(target_class) on conflict do nothing;
  select revision into actual_revision from public.live_manual_only_order where class_id=target_class for update;
  if actual_revision<>expected_revision then raise exception 'El orden cambi�' using errcode='40001'; end if;
  update public.live_manual_only_order set entries=new_entries,revision=revision+1 where class_id=target_class returning revision into result_revision;
  return result_revision;
end $$;

create or replace function public.equidate_manual_tracking_action(actor uuid, target_event uuid, target_class uuid, target_manual uuid, action text)
returns void language plpgsql security definer set search_path='' as $$
declare was_current boolean; version_id uuid;
begin
  if actor is null or target_event is null or target_class is null or target_manual is null or action not in ('current','absent','restore','advance') then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a join public.events e on e.id=a.event_id join public.competition_classes c on c.event_id=e.id
    where a.user_id=actor and e.id=target_event and c.id=target_class and coalesce(e.discipline,'jumping')='jumping'
      and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date<=e.end_date+1 for share of a,e,c;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  if not exists(select 1 from public.live_start_snapshots where class_id=target_class) then raise exception 'La carga no comenzó'; end if;
  perform 1 from public.manual_live_entries m where m.class_id=target_class and m.id=target_manual for share;
  if not found then raise exception 'Binomio inv�lido'; end if;
  insert into public.manual_live_tracking(class_id) values(target_class) on conflict do nothing;
  perform 1 from public.manual_live_tracking where class_id=target_class for update;
  if action='current' then
    if exists(select 1 from public.manual_live_tracking where class_id=target_class and target_manual=any(no_shows)) then raise exception 'No se present�'; end if;
    update public.live_tracking set current_position=null where class_id=target_class;
    update public.manual_live_tracking set current_manual_id=target_manual where class_id=target_class;
  elsif action='restore' then
    update public.manual_live_tracking set no_shows=array_remove(no_shows,target_manual) where class_id=target_class;
  elsif action='absent' then
    if exists(select 1 from public.manual_live_entries where id=target_manual and time_seconds is not null) then raise exception 'Ya tiene resultado'; end if;
    select current_manual_id=target_manual into was_current from public.manual_live_tracking where class_id=target_class;
    update public.manual_live_tracking set no_shows=array_append(array_remove(no_shows,target_manual),target_manual) where class_id=target_class;
    if was_current then
      select h.version_id into version_id from public.live_start_snapshots h where h.class_id=target_class;
      perform public.equidate_advance_combined(actor,target_event,target_class,version_id,'m:'||target_manual::text);
    end if;
  elsif action='advance' then
    update public.manual_live_tracking set current_manual_id=null where class_id=target_class and current_manual_id=target_manual;
  end if;
end $$;

create or replace function public.equidate_advance_combined(actor uuid,target_event uuid,target_class uuid,start_version uuid,current_key text)
returns void language plpgsql security definer set search_path='' as $$
declare sequence text[]; next_key text; pos integer; manual_id uuid; current_manual uuid; current_position integer;
begin
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a join public.events e on e.id=a.event_id join public.competition_classes c on c.event_id=e.id
    where a.user_id=actor and e.id=target_event and c.id=target_class and coalesce(e.discipline,'jumping')='jumping' and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date<=e.end_date+1 for share of a,e,c;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  if not exists(select 1 from public.live_start_snapshots where class_id=target_class and version_id is not distinct from start_version) then raise exception 'Listado cambiado' using errcode='40001'; end if;
  insert into public.manual_live_tracking(class_id) values(target_class) on conflict do nothing;
  select current_manual_id into current_manual from public.manual_live_tracking where class_id=target_class for update;
  if start_version is not null then
    insert into public.live_tracking(class_id,start_version_id) values(target_class,start_version) on conflict do nothing;
    select t.current_position into current_position from public.live_tracking t where t.class_id=target_class and t.start_version_id=start_version for update;
  end if;
  if current_key is distinct from coalesce('m:'||current_manual::text, 'p:'||current_position::text) then return; end if;
  if start_version is not null then
    select entries into sequence from public.live_combined_order where class_id=target_class and start_version_id=start_version;
    if sequence is null or cardinality(sequence)=0 then
      select array_agg('p:'||p::text order by ord) into sequence from unnest(coalesce((select live_order from public.live_tracking where class_id=target_class and start_version_id=start_version),
        (select array_agg((item->>'position')::integer order by (item->>'position')::integer) from public.live_start_snapshots v cross join lateral jsonb_array_elements(v.entries) item where v.version_id=start_version and v.class_id=target_class))) with ordinality x(p,ord);
    end if;
  else select entries into sequence from public.live_manual_only_order where class_id=target_class; end if;
  sequence:=coalesce(sequence,'{}')||coalesce((select array_agg('m:'||m.id::text order by m.created_at) from public.manual_live_entries m where m.class_id=target_class and not ('m:'||m.id::text=any(coalesce(sequence,'{}')))),'{}');
  for next_key in select value from unnest(sequence) with ordinality x(value,idx) where idx>coalesce(array_position(sequence,current_key),cardinality(sequence)) order by idx loop
    if left(next_key,2)='m:' then
      manual_id:=substring(next_key from 3)::uuid;
      if exists(select 1 from public.manual_live_entries m where m.class_id=target_class and m.id=manual_id and m.time_seconds is null)
        and not exists(select 1 from public.manual_live_tracking t where t.class_id=target_class and manual_id=any(t.no_shows)) then exit; end if;
    elsif left(next_key,2)='p:' then
      pos:=substring(next_key from 3)::integer;
      if not exists(select 1 from public.provisional_live_results r where r.class_id=target_class and r.start_version_id=start_version and r.position=pos)
        and not exists(select 1 from public.live_tracking t where t.class_id=target_class and t.start_version_id=start_version and pos=any(t.no_shows)) then exit; end if;
    end if;
    next_key:=null;
  end loop;
  update public.manual_live_tracking set current_manual_id=case when left(next_key,2)='m:' then substring(next_key from 3)::uuid else null end where class_id=target_class;
  if start_version is not null then update public.live_tracking set current_position=case when left(next_key,2)='p:' then substring(next_key from 3)::integer else null end where class_id=target_class and start_version_id=start_version; end if;
end $$;

create or replace function public.equidate_set_second_round_qualification(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, target_manual uuid, qualified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare event_end date; selected_key text;
begin
  if actor is null or target_event is null or target_class is null or qualified is null or ((target_manual is null)=(target_position is null)) then raise exception 'Datos inv�lidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date>event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event and (c.live_format='double_round' or (c.live_format is null and (coalesce(c.name,'') || ' ' || coalesce(c.description,'')) ~* '(^|[^[:alnum:]_])(dr|doble[[:space:]]+recorrido|1[[:space:]]*(d|desempate)|un[[:space:]]+desempate)($|[^[:alnum:]_])')) for share;
  if not found then raise exception 'Prueba no autorizada o modalidad inv�lida' using errcode='42501'; end if;
  if not exists(select 1 from public.live_start_snapshots where class_id=target_class) then raise exception 'La carga no comenzó'; end if;
  if target_manual is not null then
    perform 1 from public.manual_live_entries m where m.id=target_manual and m.class_id=target_class for share;
    if not found then raise exception 'Binomio inv�lido'; end if;
    selected_key:='m:'||target_manual::text;
  else
    if target_position<1 or start_version is null then raise exception 'Binomio inv�lido'; end if;
    perform 1 from public.live_start_snapshots h where h.class_id=target_class and h.version_id=start_version for share;
    if not found then raise exception 'El listado cambi�' using errcode='40001'; end if;
    perform 1 from public.live_start_snapshots v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.version_id=start_version and (item->>'position')::integer=target_position;
    if not found then raise exception 'Binomio inv�lido'; end if;
    selected_key:='p:'||start_version::text||':'||target_position::text;
  end if;
  if qualified then insert into public.live_second_round_qualifiers(class_id,entry_key) values(target_class,selected_key) on conflict do nothing;
  else delete from public.live_second_round_qualifiers q where q.class_id=target_class and q.entry_key=selected_key;
  end if;
end $function$;
