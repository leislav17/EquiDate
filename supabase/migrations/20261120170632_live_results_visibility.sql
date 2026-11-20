alter table public.live_result_starts add column public_visible boolean not null default true;

-- These restrictive policies complement the existing public-read policies.
-- Service-role operations used by the external operator continue to retain access.
create policy live_marks_shared_only on public.provisional_live_results as restrictive for select to anon,authenticated using
  (exists(select 1 from public.live_result_starts s where s.class_id=provisional_live_results.class_id and s.public_visible));
create policy live_manual_shared_only on public.manual_live_entries as restrictive for select to anon,authenticated using
  (exists(select 1 from public.live_result_starts s where s.class_id=manual_live_entries.class_id and s.public_visible));
create policy live_tracking_shared_only on public.live_tracking as restrictive for select to anon,authenticated using
  (exists(select 1 from public.live_result_starts s where s.class_id=live_tracking.class_id and s.public_visible));
create policy manual_tracking_shared_only on public.manual_live_tracking as restrictive for select to anon,authenticated using
  (exists(select 1 from public.live_result_starts s where s.class_id=manual_live_tracking.class_id and s.public_visible));
create policy combined_order_shared_only on public.live_combined_order as restrictive for select to anon,authenticated using
  (exists(select 1 from public.live_result_starts s where s.class_id=live_combined_order.class_id and s.public_visible));
create policy manual_order_shared_only on public.live_manual_only_order as restrictive for select to anon,authenticated using
  (exists(select 1 from public.live_result_starts s where s.class_id=live_manual_only_order.class_id and s.public_visible));

create function public.equidate_set_live_visibility(actor uuid,target_event uuid,target_class uuid,visible boolean)
returns void language plpgsql security definer set search_path='' as $$
declare event_end date;
begin
  if actor is null or target_event is null or target_class is null or visible is null then raise exception 'Datos inválidos'; end if;
  perform 1 from auth.users u where u.id=actor and u.raw_app_meta_data->>'equidate_external'='true' and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode='42501'; end if;
  select e.end_date into event_end from public.events e where e.id=target_event and coalesce(e.discipline,'jumping')='jumping' for share;
  if event_end is null or (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date>event_end+1 then raise exception 'Acceso vencido' using errcode='42501'; end if;
  perform 1 from public.external_event_assignments a where a.user_id=actor and a.event_id=target_event for share;
  if not found then raise exception 'Concurso no autorizado' using errcode='42501'; end if;
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event for share;
  if not found then raise exception 'Prueba inválida' using errcode='42501'; end if;
  update public.live_result_starts set public_visible=visible where class_id=target_class;
  if not found then raise exception 'La carga todavía no comenzó'; end if;
end $$;
revoke all on function public.equidate_set_live_visibility(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.equidate_set_live_visibility(uuid,uuid,uuid,boolean) to service_role;
