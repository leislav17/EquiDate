alter table public.live_tracking add column live_order integer[];

create function public.equidate_reorder_live(actor uuid, target_event uuid, target_class uuid, start_version uuid, expected_order integer[], new_order integer[])
returns void language plpgsql security definer set search_path='' as $$
declare event_end date; original_order integer[]; actual_order integer[]; n integer;
begin
  if actor is null or target_event is null or target_class is null or start_version is null or expected_order is null or new_order is null then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inválida'; end if;
  perform 1 from public.start_lists h where h.class_id=target_class and h.version_id=start_version for share;
  if not found then raise exception 'El orden publicado cambió' using errcode='40001'; end if;
  select array_agg((item->>'position')::integer order by (item->>'position')::integer) into original_order from public.start_list_versions v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.id=start_version;
  if original_order is null or cardinality(new_order) <> cardinality(original_order) or array_position(new_order,null) is not null then raise exception 'Orden inválido'; end if;
  select count(distinct x) into n from unnest(new_order) x;
  if n <> cardinality(original_order) or not (new_order @> original_order and original_order @> new_order) then raise exception 'Orden inválido'; end if;
  insert into public.live_tracking(class_id,start_version_id) values(target_class,start_version) on conflict do nothing;
  select coalesce(live_order,original_order) into actual_order from public.live_tracking where class_id=target_class and start_version_id=start_version for update;
  if expected_order is distinct from actual_order then raise exception 'El orden cambió; actualizá' using errcode='40001'; end if;
  update public.live_tracking set live_order=new_order where class_id=target_class and start_version_id=start_version;
end $$;
revoke all on function public.equidate_reorder_live(uuid,uuid,uuid,uuid,integer[],integer[]) from public, anon, authenticated;
grant execute on function public.equidate_reorder_live(uuid,uuid,uuid,uuid,integer[],integer[]) to service_role;

create or replace function public.equidate_live_tracking_action(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, action text)
returns void language plpgsql security definer set search_path='' as $$
declare event_end date; current_pos integer; next_pos integer;
begin
  if actor is null or target_event is null or target_class is null or start_version is null or target_position is null or target_position < 1 or action not in ('current','absent','restore','advance') then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inválida'; end if;
  perform 1 from public.start_lists h where h.class_id=target_class and h.version_id=start_version for share;
  if not found then raise exception 'El orden publicado cambió' using errcode='40001'; end if;
  perform 1 from public.start_list_versions v, jsonb_array_elements(v.entries) item where v.class_id=target_class and v.id=start_version and (item->>'position')::integer=target_position;
  if not found then raise exception 'Binomio inválido'; end if;
  insert into public.live_tracking(class_id,start_version_id) values(target_class,start_version) on conflict do nothing;
  select current_position into current_pos from public.live_tracking where class_id=target_class and start_version_id=start_version for update;
  if action='current' then
    if exists(select 1 from public.live_tracking where class_id=target_class and start_version_id=start_version and target_position=any(no_shows)) then raise exception 'El binomio no se presentó'; end if;
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
      (select array_agg((item->>'position')::integer order by (item->>'position')::integer) from public.start_list_versions v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.id=start_version)
    )) with ordinality candidate(pos,idx)
    where candidate.idx > coalesce(array_position(coalesce((select live_order from public.live_tracking where class_id=target_class and start_version_id=start_version),
      (select array_agg((item->>'position')::integer order by (item->>'position')::integer) from public.start_list_versions v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.id=start_version)),target_position),0)
      and not exists(select 1 from public.provisional_live_results r where r.class_id=target_class and r.start_version_id=start_version and r.position=candidate.pos)
      and not exists(select 1 from public.live_tracking t where t.class_id=target_class and t.start_version_id=start_version and candidate.pos=any(t.no_shows)) order by candidate.idx limit 1;
    update public.live_tracking set current_position=next_pos where class_id=target_class and start_version_id=start_version;
  end if;
end $$;
