-- Only the verified Edge Function may call this function; authorization and write
-- are evaluated in one transaction against current account and assignment state.
create function public.equidate_external_save_stream(actor uuid, target_event uuid, target_day uuid, target_arena uuid, video_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare event_end date; is_primary boolean;
begin
  if actor is null or target_event is null or target_day is null or target_arena is null then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id = actor
    and u.raw_app_meta_data->>'equidate_external' = 'true'
    and (u.banned_until is null or u.banned_until <= clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id = target_event for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date > event_end + 1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_days d where d.id=target_day and d.event_id=target_event for update;
  if not found then raise exception 'Jornada inválida'; end if;
  select a.is_primary into is_primary from public.competition_arenas a where a.id=target_arena and a.event_id=target_event;
  if not found then raise exception 'Pista inválida'; end if;
  if is_primary then update public.competition_days set youtube_url = nullif(trim(video_url),'') where id=target_day; end if;
  if nullif(trim(video_url),'') is null then
    delete from public.competition_streams where day_id=target_day and arena_id=target_arena;
  else
    insert into public.competition_streams(event_id,day_id,arena_id,youtube_url) values(target_event,target_day,target_arena,trim(video_url))
    on conflict(day_id,arena_id) do update set youtube_url=excluded.youtube_url;
  end if;
end $$;
revoke all on function public.equidate_external_save_stream(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.equidate_external_save_stream(uuid,uuid,uuid,uuid,text) to service_role;
