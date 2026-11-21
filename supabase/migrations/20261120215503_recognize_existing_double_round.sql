CREATE OR REPLACE FUNCTION public.equidate_set_second_round_qualification(actor uuid, target_event uuid, target_class uuid, start_version uuid, target_position integer, target_manual uuid, qualified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare event_end date; selected_key text;
begin
  if actor is null or target_event is null or target_class is null or qualified is null or ((target_manual is null)=(target_position is null)) then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date>event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event and (c.live_format='double_round' or (c.live_format is null and (coalesce(c.name,'') || ' ' || coalesce(c.description,'')) ~* '(^|[^[:alnum:]_])(dr|doble[[:space:]]+recorrido)($|[^[:alnum:]_])')) for share;
  if not found then raise exception 'Prueba no autorizada o modalidad inválida' using errcode='42501'; end if;
  if target_manual is not null then
    perform 1 from public.manual_live_entries m where m.id=target_manual and m.class_id=target_class for share;
    if not found then raise exception 'Binomio inválido'; end if;
    selected_key:='m:'||target_manual::text;
  else
    if target_position<1 or start_version is null then raise exception 'Binomio inválido'; end if;
    perform 1 from public.start_lists h where h.class_id=target_class and h.version_id=start_version for share;
    if not found then raise exception 'El listado cambió' using errcode='40001'; end if;
    perform 1 from public.start_list_versions v cross join lateral jsonb_array_elements(v.entries) item where v.class_id=target_class and v.id=start_version and (item->>'position')::integer=target_position;
    if not found then raise exception 'Binomio inválido'; end if;
    selected_key:='p:'||start_version::text||':'||target_position::text;
  end if;
  if qualified then insert into public.live_second_round_qualifiers(class_id,entry_key) values(target_class,selected_key) on conflict do nothing;
  else delete from public.live_second_round_qualifiers q where q.class_id=target_class and q.entry_key=selected_key;
  end if;
end $function$
