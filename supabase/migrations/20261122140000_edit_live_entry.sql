create function public.equidate_edit_live_entry(
  actor uuid, target_event uuid, target_class uuid, start_version uuid,
  target_position integer, target_manual uuid, rider_name text, horse_name text, category_name text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (target_position is null) = (target_manual is null)
     or coalesce(length(btrim(rider_name)), 0) not between 1 and 160
     or coalesce(length(btrim(horse_name)), 0) not between 1 and 160
     or coalesce(length(btrim(category_name)), 0) not between 1 and 160 then
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
    update public.manual_live_entries
    set rider = btrim(rider_name), horse = btrim(horse_name), category = btrim(category_name)
    where class_id = target_class and id = target_manual;
  else
    update public.live_start_snapshots s
    set entries = (
      select jsonb_agg(
        case when (item->>'position')::integer = target_position
          then item || jsonb_build_object('rider', btrim(rider_name), 'horse', btrim(horse_name), 'category', btrim(category_name))
          else item end order by ordinal
      )
      from jsonb_array_elements(s.entries) with ordinality as rows(item, ordinal)
    )
    where s.class_id = target_class and exists (
      select 1 from jsonb_array_elements(s.entries) item
      where (item->>'position')::integer = target_position
    );
  end if;
  if not found then raise exception 'No se encontró el binomio' using errcode = '22023'; end if;
end $$;
revoke all on function public.equidate_edit_live_entry(uuid,uuid,uuid,uuid,integer,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.equidate_edit_live_entry(uuid,uuid,uuid,uuid,integer,uuid,text,text,text)
  to service_role;
