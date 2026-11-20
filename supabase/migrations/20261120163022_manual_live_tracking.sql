create table public.manual_live_tracking (
  class_id uuid primary key references public.competition_classes(id) on delete cascade,
  current_manual_id uuid references public.manual_live_entries(id) on delete set null,
  no_shows uuid[] not null default '{}'
);
alter table public.manual_live_tracking enable row level security;
revoke all on public.manual_live_tracking from public,anon,authenticated;
grant select on public.manual_live_tracking to anon,authenticated;
grant all on public.manual_live_tracking to service_role;
create policy manual_live_tracking_public_read on public.manual_live_tracking for select to anon,authenticated using (
  exists(select 1 from public.competition_classes c join public.events e on e.id=c.event_id where c.id=manual_live_tracking.class_id and e.status='published')
);

create function public.equidate_manual_tracking_action(actor uuid, target_event uuid, target_class uuid, target_manual uuid, action text)
returns void language plpgsql security definer set search_path='' as $$
declare was_current boolean; version_id uuid;
begin
  if actor is null or target_event is null or target_class is null or target_manual is null or action not in ('current','absent','restore','advance') then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a join public.events e on e.id=a.event_id join public.competition_classes c on c.event_id=e.id
    where a.user_id=actor and e.id=target_event and c.id=target_class and coalesce(e.discipline,'jumping')='jumping'
      and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date<=e.end_date+1 for share of a,e,c;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.manual_live_entries m where m.class_id=target_class and m.id=target_manual for share;
  if not found then raise exception 'Binomio inválido'; end if;
  insert into public.manual_live_tracking(class_id) values(target_class) on conflict do nothing;
  perform 1 from public.manual_live_tracking where class_id=target_class for update;
  if action='current' then
    if exists(select 1 from public.manual_live_tracking where class_id=target_class and target_manual=any(no_shows)) then raise exception 'No se presentó'; end if;
    update public.live_tracking set current_position=null where class_id=target_class;
    update public.manual_live_tracking set current_manual_id=target_manual where class_id=target_class;
  elsif action='restore' then
    update public.manual_live_tracking set no_shows=array_remove(no_shows,target_manual) where class_id=target_class;
  elsif action='absent' then
    if exists(select 1 from public.manual_live_entries where id=target_manual and time_seconds is not null) then raise exception 'Ya tiene resultado'; end if;
    select current_manual_id=target_manual into was_current from public.manual_live_tracking where class_id=target_class;
    update public.manual_live_tracking set no_shows=array_append(array_remove(no_shows,target_manual),target_manual) where class_id=target_class;
    if was_current then
      select h.version_id into version_id from public.start_lists h where h.class_id=target_class;
      perform public.equidate_advance_combined(actor,target_event,target_class,version_id,'m:'||target_manual::text);
    end if;
  elsif action='advance' then
    update public.manual_live_tracking set current_manual_id=null where class_id=target_class and current_manual_id=target_manual;
  end if;
end $$;
revoke all on function public.equidate_manual_tracking_action(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.equidate_manual_tracking_action(uuid,uuid,uuid,uuid,text) to service_role;

create function public.equidate_published_tracking_action(actor uuid,target_event uuid,target_class uuid,start_version uuid,target_position integer,action text)
returns void language plpgsql security definer set search_path='' as $$
declare was_current boolean;
begin
  if action='absent' then
    perform public.equidate_live_tracking_action(actor,target_event,target_class,start_version,target_position,'restore');
    if exists(select 1 from public.provisional_live_results where class_id=target_class and start_version_id=start_version and position=target_position) then raise exception 'Ya tiene resultado'; end if;
    select current_position=target_position into was_current from public.live_tracking where class_id=target_class and start_version_id=start_version;
    update public.live_tracking set no_shows=array_append(array_remove(no_shows,target_position),target_position) where class_id=target_class and start_version_id=start_version;
    if was_current then perform public.equidate_advance_combined(actor,target_event,target_class,start_version,'p:'||target_position::text); end if;
  else
    perform public.equidate_live_tracking_action(actor,target_event,target_class,start_version,target_position,action);
  end if;
  if action='current' then update public.manual_live_tracking set current_manual_id=null where class_id=target_class; end if;
end $$;
revoke all on function public.equidate_published_tracking_action(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.equidate_published_tracking_action(uuid,uuid,uuid,uuid,integer,text) to service_role;

-- Advance in the shared sequence, retaining the identity of each kind of entry.
create function public.equidate_advance_combined(actor uuid,target_event uuid,target_class uuid,start_version uuid,current_key text)
returns void language plpgsql security definer set search_path='' as $$
declare sequence text[]; next_key text; pos integer; manual_id uuid; current_manual uuid; current_position integer;
begin
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a join public.events e on e.id=a.event_id join public.competition_classes c on c.event_id=e.id
    where a.user_id=actor and e.id=target_event and c.id=target_class and coalesce(e.discipline,'jumping')='jumping' and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date<=e.end_date+1 for share of a,e,c;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  if start_version is not null and not exists(select 1 from public.start_lists where class_id=target_class and version_id=start_version) then raise exception 'Listado cambiado' using errcode='40001'; end if;
  if start_version is null and exists(select 1 from public.start_lists where class_id=target_class and version_id is not null) then raise exception 'Listado cambiado' using errcode='40001'; end if;
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
        (select array_agg((item->>'position')::integer order by (item->>'position')::integer) from public.start_list_versions v cross join lateral jsonb_array_elements(v.entries) item where v.id=start_version and v.class_id=target_class))) with ordinality x(p,ord);
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
revoke all on function public.equidate_advance_combined(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.equidate_advance_combined(uuid,uuid,uuid,uuid,text) to service_role;

create function public.equidate_save_published_combined(actor uuid,target_event uuid,target_class uuid,start_version uuid,target_position integer,faults integer,seconds numeric,second_faults integer,second_seconds numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.equidate_live_tracking_action(actor,target_event,target_class,start_version,target_position,'restore');
  perform public.equidate_external_save_live_result_phases(actor,target_event,target_class,start_version,target_position,faults,seconds,second_faults,second_seconds);
  perform public.equidate_advance_combined(actor,target_event,target_class,start_version,'p:'||target_position::text);
end $$;
revoke all on function public.equidate_save_published_combined(uuid,uuid,uuid,uuid,integer,integer,numeric,integer,numeric) from public,anon,authenticated;
grant execute on function public.equidate_save_published_combined(uuid,uuid,uuid,uuid,integer,integer,numeric,integer,numeric) to service_role;

create function public.equidate_save_manual_combined(actor uuid,target_event uuid,target_class uuid,start_version uuid,target_manual uuid,faults integer,seconds numeric,second_faults integer,second_seconds numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
  if faults is null or faults not between 0 and 999 or seconds is null or seconds<0 or seconds>9999999 or seconds<>round(seconds,2) or (second_faults is null)<>(second_seconds is null) or second_faults not between 0 and 999 or second_seconds<0 or second_seconds>9999999 or second_seconds<>round(second_seconds,2) then raise exception 'Datos inválidos'; end if;
  perform public.equidate_manual_tracking_action(actor,target_event,target_class,target_manual,'restore');
  update public.manual_live_entries set obstacle_faults=faults,time_seconds=seconds,phase2_faults=second_faults,phase2_seconds=second_seconds where id=target_manual and class_id=target_class;
  perform public.equidate_advance_combined(actor,target_event,target_class,start_version,'m:'||target_manual::text);
end $$;
revoke all on function public.equidate_save_manual_combined(uuid,uuid,uuid,uuid,uuid,integer,numeric,integer,numeric) from public,anon,authenticated;
grant execute on function public.equidate_save_manual_combined(uuid,uuid,uuid,uuid,uuid,integer,numeric,integer,numeric) to service_role;
