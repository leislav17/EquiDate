create function public.equidate_remove_live_entry(
  actor uuid, target_event uuid, target_class uuid, start_version uuid,
  target_position integer, target_manual uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  removed_key text;
  qualifier_key text;
begin
  if (target_position is null) = (target_manual is null) then
    raise exception 'Datos inválidos' using errcode = '22023';
  end if;
  perform 1 from auth.users u
  where u.id = actor and u.raw_app_meta_data->>'equidate_external' = 'true'
    and (u.banned_until is null or u.banned_until <= clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode = '42501'; end if;
  perform 1 from public.external_event_assignments a
  join public.events e on e.id = a.event_id
  join public.competition_classes c on c.event_id = e.id
  where a.user_id = actor and e.id = target_event and c.id = target_class
    and coalesce(e.discipline, 'jumping') = 'jumping'
    and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date <= e.end_date + 1
  for share of a, e, c;
  if not found then raise exception 'Concurso no autorizado' using errcode = '42501'; end if;

  perform 1 from public.live_start_snapshots
  where class_id = target_class and version_id is not distinct from start_version for update;
  if not found then raise exception 'La lista del vivo cambió' using errcode = '40001'; end if;

  if target_manual is not null then
    perform 1 from public.manual_live_entries
    where class_id = target_class and id = target_manual for update;
    if not found then return; end if;
    removed_key := 'm:' || target_manual;
    qualifier_key := removed_key;

    update public.manual_live_tracking
    set current_manual_id = case when current_manual_id = target_manual then null else current_manual_id end,
        no_shows = array_remove(no_shows, target_manual)
    where class_id = target_class;

    delete from public.manual_live_entries
    where class_id = target_class and id = target_manual;
  else
    if start_version is null then raise exception 'Binomio inválido' using errcode = '22023'; end if;
    if not exists (
      select 1 from public.live_start_snapshots s
      cross join lateral jsonb_array_elements(s.entries) item
      where s.class_id = target_class and (item->>'position')::integer = target_position
    ) then return; end if;
    removed_key := 'p:' || target_position;
    qualifier_key := 'p:' || start_version || ':' || target_position;

    update public.live_start_snapshots s
    set entries = coalesce((
      select jsonb_agg(item order by ordinal)
      from jsonb_array_elements(s.entries) with ordinality as rows(item, ordinal)
      where (item->>'position')::integer <> target_position
    ), '[]'::jsonb)
    where s.class_id = target_class;

    update public.live_tracking
    set current_position = case when current_position = target_position then null else current_position end,
        no_shows = array_remove(no_shows, target_position),
        live_order = array_remove(live_order, target_position)
    where class_id = target_class and start_version_id = start_version;

    delete from public.provisional_live_results
    where class_id = target_class and start_version_id = start_version and position = target_position;
  end if;

  delete from public.live_second_round_qualifiers
  where class_id = target_class and entry_key = qualifier_key;

  if start_version is null then
    update public.live_manual_only_order
    set entries = array_remove(entries, removed_key), revision = revision + 1
    where class_id = target_class;
  else
    update public.live_combined_order
    set entries = array_remove(entries, removed_key), revision = revision + 1
    where class_id = target_class and start_version_id = start_version;
  end if;
end $$;
revoke all on function public.equidate_remove_live_entry(uuid,uuid,uuid,uuid,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.equidate_remove_live_entry(uuid,uuid,uuid,uuid,integer,uuid)
  to service_role;

-- Serialize a manual-only reorder with removal before validating its row identities.
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
  perform 1 from public.live_start_snapshots h
    where h.class_id=target_class and h.version_id is null for share;
  if not found then raise exception 'El listado cambió' using errcode='40001'; end if;
  select array_agg('m:'||m.id::text order by 'm:'||m.id::text) into valid_entries from public.manual_live_entries m where m.class_id=target_class;
  if coalesce(cardinality(valid_entries),0)<>cardinality(new_entries) or (select array_agg(x order by x) from unnest(new_entries) x) is distinct from valid_entries then raise exception 'Orden inv�lido'; end if;
  insert into public.live_manual_only_order(class_id) values(target_class) on conflict do nothing;
  select revision into actual_revision from public.live_manual_only_order where class_id=target_class for update;
  if actual_revision<>expected_revision then raise exception 'El orden cambi�' using errcode='40001'; end if;
  update public.live_manual_only_order set entries=new_entries,revision=revision+1 where class_id=target_class returning revision into result_revision;
  return result_revision;
end $$;
