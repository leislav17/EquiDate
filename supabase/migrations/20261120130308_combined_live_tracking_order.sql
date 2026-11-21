create or replace function public.equidate_set_combined_live_order(
  actor uuid, target_event uuid, target_class uuid, start_version uuid,
  expected_revision bigint, new_entries text[]
) returns bigint language plpgsql security definer set search_path = '' as $$
declare actual_revision bigint; valid_entries text[]; result_revision bigint;
begin
  if actor is null or new_entries is null or array_position(new_entries, null) is not null
    then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor
    and u.raw_app_meta_data->>'equidate_external'='true'
    and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a
    join public.events e on e.id=a.event_id
    join public.competition_classes c on c.event_id=e.id
    join public.start_lists h on h.class_id=c.id
    where a.user_id=actor and e.id=target_event and c.id=target_class
      and h.version_id=start_version and coalesce(e.discipline,'jumping')='jumping'
      and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date <= e.end_date+1
    for share of a,e,c,h;
  if not found then raise exception 'Acceso o listado inválido' using errcode='42501'; end if;
  select array_agg(k order by k) into valid_entries from (
    select 'p:' || (item->>'position') as k
      from public.start_list_versions v cross join lateral jsonb_array_elements(v.entries) item
      where v.class_id=target_class and v.id=start_version
    union all
    select 'm:' || m.id::text from public.manual_live_entries m where m.class_id=target_class
  ) entries;
  if coalesce(cardinality(valid_entries),0) <> cardinality(new_entries)
     or (select array_agg(x order by x) from unnest(new_entries) x)
       is distinct from valid_entries then raise exception 'Orden inválido'; end if;
  insert into public.live_combined_order(class_id,start_version_id)
    values(target_class,start_version) on conflict do nothing;
  select revision into actual_revision from public.live_combined_order
    where class_id=target_class and start_version_id=start_version for update;
  if actual_revision <> expected_revision then
    raise exception 'El orden cambió; actualizá' using errcode='40001';
  end if;
  update public.live_combined_order set entries=new_entries, revision=revision+1
    where class_id=target_class and start_version_id=start_version returning revision into result_revision;
  insert into public.live_tracking(class_id,start_version_id,live_order)
    values(target_class,start_version, array(select substring(k from 3)::integer from unnest(new_entries) with ordinality as t(k,n) where k like 'p:%' order by n))
    on conflict(class_id,start_version_id) do update set live_order=excluded.live_order;
  return result_revision;
end $$;
revoke all on function public.equidate_set_combined_live_order(uuid,uuid,uuid,uuid,bigint,text[]) from public,anon,authenticated;
grant execute on function public.equidate_set_combined_live_order(uuid,uuid,uuid,uuid,bigint,text[]) to service_role;

-- A live session may begin before an official start list exists.
create table public.live_manual_only_order (
  class_id uuid primary key references public.competition_classes(id) on delete cascade,
  entries text[] not null default '{}', revision bigint not null default 0
);
alter table public.live_manual_only_order enable row level security;
revoke all on public.live_manual_only_order from public,anon,authenticated;
grant select on public.live_manual_only_order to anon,authenticated;
grant all on public.live_manual_only_order to service_role;
create policy live_manual_only_order_public_read on public.live_manual_only_order for select to anon,authenticated using (
  exists(select 1 from public.competition_classes c join public.events e on e.id=c.event_id where c.id=live_manual_only_order.class_id and e.status='published')
);
create function public.equidate_set_manual_only_order(actor uuid, target_event uuid, target_class uuid, expected_revision bigint, new_entries text[])
returns bigint language plpgsql security definer set search_path='' as $$
declare actual_revision bigint; valid_entries text[]; result_revision bigint;
begin
  if actor is null or target_event is null or target_class is null or expected_revision is null or new_entries is null or array_position(new_entries,null) is not null then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a join public.events e on e.id=a.event_id join public.competition_classes c on c.event_id=e.id
    where a.user_id=actor and e.id=target_event and c.id=target_class and coalesce(e.discipline,'jumping')='jumping'
    and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date<=e.end_date+1 for share of a,e,c;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  if exists(select 1 from public.start_lists h where h.class_id=target_class and h.version_id is not null) then raise exception 'El listado cambió' using errcode='40001'; end if;
  select array_agg('m:'||m.id::text order by 'm:'||m.id::text) into valid_entries from public.manual_live_entries m where m.class_id=target_class;
  if coalesce(cardinality(valid_entries),0)<>cardinality(new_entries) or (select array_agg(x order by x) from unnest(new_entries) x) is distinct from valid_entries then raise exception 'Orden inválido'; end if;
  insert into public.live_manual_only_order(class_id) values(target_class) on conflict do nothing;
  select revision into actual_revision from public.live_manual_only_order where class_id=target_class for update;
  if actual_revision<>expected_revision then raise exception 'El orden cambió' using errcode='40001'; end if;
  update public.live_manual_only_order set entries=new_entries,revision=revision+1 where class_id=target_class returning revision into result_revision;
  return result_revision;
end $$;
revoke all on function public.equidate_set_manual_only_order(uuid,uuid,uuid,bigint,text[]) from public,anon,authenticated;
grant execute on function public.equidate_set_manual_only_order(uuid,uuid,uuid,bigint,text[]) to service_role;
