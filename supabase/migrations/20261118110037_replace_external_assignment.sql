create function public.equidate_replace_external_assignment(target_event uuid, old_user uuid, new_user uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if target_event is null or old_user is null or new_user is null or old_user = new_user then
    raise exception 'Datos de reemplazo inválidos';
  end if;
  perform 1 from public.events where id = target_event for update;
  if not found then raise exception 'Concurso inexistente'; end if;
  delete from public.external_event_assignments where event_id = target_event and user_id = old_user;
  if not found then raise exception 'La asignación ya no existe'; end if;
  insert into public.external_event_assignments (user_id, event_id) values (new_user, target_event)
    on conflict (user_id, event_id) do nothing;
end $$;
revoke all on function public.equidate_replace_external_assignment(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.equidate_replace_external_assignment(uuid, uuid, uuid) to service_role;
