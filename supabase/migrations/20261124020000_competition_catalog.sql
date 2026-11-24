create table public.competition_catalog (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rider', 'horse', 'definition')),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  active boolean not null default true,
  behavior text,
  aliases text[] not null default '{}',
  check ((kind = 'definition' and behavior is not null and behavior in ('TD','2F','2FE','1D','DC','DR','TOD'))
    or (kind <> 'definition' and behavior is null)),
  unique (kind, code)
);

alter table public.competition_catalog enable row level security;
revoke all on public.competition_catalog from public, anon, authenticated;
grant select, insert, update on public.competition_catalog to authenticated;
grant all on public.competition_catalog to service_role;
create policy competition_catalog_admin_read on public.competition_catalog for select to authenticated
  using (public.equidate_is_admin());
create policy competition_catalog_admin_insert on public.competition_catalog for insert to authenticated
  with check (public.equidate_is_admin());
create policy competition_catalog_admin_update on public.competition_catalog for update to authenticated
  using (public.equidate_is_admin()) with check (public.equidate_is_admin());

insert into public.competition_catalog(kind, code, name, behavior, aliases) values
  ('definition','TD','Tiempo directo','TD','{}'),
  ('definition','2F','Doble faz común','2F','{}'),
  ('definition','2FE','Doble faz especial','2FE','{}'),
  ('definition','1D','Un desempate','1D','{}'),
  ('definition','DC','Desempate continuado','DC','{}'),
  ('definition','DR','Doble recorrido','DR','{}'),
  ('definition','TOD','Tiempo óptimo directo','TOD','{}'),
  ('rider','INI-MAY','Iniciados Mayor',null,array['Iniciados Mayores']),
  ('rider','INI-MEN','Iniciados Menor',null,array['Iniciados Menores']),
  ('rider','ESC-MAY','Escuela Mayor',null,array['Escuela Mayores','Esc Mayor','EMAY']),
  ('rider','ESC-MEN','Escuela Menor',null,array['Escuela Menores','Esc Menor','EMEN']),
  ('rider','TER-MAY','Tercera Mayor',null,array['Tercera Mayores','3ra Mayor','3era Mayor']),
  ('rider','TER-MEN','Tercera Menor',null,array['Tercera Menores','3ra Menor','3era Menor']),
  ('rider','SEGUNDA','Segunda',null,array['2da','2nda']),
  ('rider','PRIMERA','Primera',null,array['1ra','1era']),
  ('rider','AMATEUR','Amateur',null,'{}'),
  ('rider','CHILDREN','Children',null,'{}'),
  ('rider','PREJUNIOR','Prejunior',null,array['Pre Junior','Pre-Junior']),
  ('rider','JUNIOR','Junior',null,'{}'),
  ('rider','U25','U25',null,array['U 25','Sub 25']),
  ('rider','LIBRE','Libre',null,'{}'),
  ('horse','CN','Caballos Nuevos',null,array['Caballo Nuevo','Caballos Nuevo','C.N.']),
  ('horse','PONY','Pony',null,array['Ponis','Ponies']);

alter table public.competition_classes add column catalog jsonb;

create function public.equidate_set_class_catalog()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  definition jsonb;
  categories jsonb;
  category_count integer;
  height integer;
  second_height integer;
  special_name text;
  fee numeric;
begin
  if new.catalog is null then return new; end if;
  if tg_op = 'UPDATE' and (new.catalog - 'definition' - 'categories') = (old.catalog - 'definition' - 'categories') then
    new.catalog := old.catalog;
    new.name := old.name;
    new.live_format := old.live_format;
    return new;
  end if;

  select to_jsonb(d) - 'active' into definition
  from public.competition_catalog d
  where d.id = (new.catalog->>'definitionId')::uuid and d.kind = 'definition'
    and (d.active or (tg_op = 'UPDATE' and old.catalog->>'definitionId' = d.id::text));

  select jsonb_agg(to_jsonb(c) - 'active' order by item.ordinal), count(*)
    into categories, category_count
  from jsonb_array_elements_text(new.catalog->'categoryIds') with ordinality item(id, ordinal)
  join public.competition_catalog c on c.id = item.id::uuid
  where c.kind in ('rider','horse')
    and (c.active or (tg_op = 'UPDATE' and (old.catalog->'categoryIds') ? item.id));
  if definition is null or category_count < 1 or category_count <> jsonb_array_length(new.catalog->'categoryIds')
    or category_count <> (select count(distinct value) from jsonb_array_elements_text(new.catalog->'categoryIds')) then
    raise exception 'Seleccioná una definición y categorías válidas' using errcode = '22023';
  end if;

  height := (new.catalog->>'heightCm')::integer;
  second_height := (new.catalog->>'secondHeightCm')::integer;
  special_name := nullif(btrim(new.catalog->>'specialName'), '');
  fee := (new.catalog->>'entryFee')::numeric;
  if height is null or height not between 1 and 300
    or (second_height is not null and (second_height not between 1 and 300 or definition->>'behavior' in ('TD','TOD')))
    or length(special_name) > 120 or fee < 0 or fee > 999999999 or fee <> round(fee, 2) then
    raise exception 'Revisá las alturas, el nombre especial y el costo' using errcode = '22023';
  end if;

  new.catalog := jsonb_build_object(
    'definitionId', definition->'id', 'definition', definition,
    'categoryIds', new.catalog->'categoryIds', 'categories', categories,
    'heightCm', height, 'secondHeightCm', second_height,
    'specialName', special_name, 'entryFee', fee
  );
  new.name := replace(to_char(height / 100.0, 'FM0.00'), '.', ',')
    || case when second_height is null then '' else '/' || replace(to_char(second_height / 100.0, 'FM0.00'), '.', ',') end
    || ' m · ' || (definition->>'code') || coalesce(' · ' || special_name, '');
  new.live_format := case when definition->>'behavior' = 'DR' then 'double_round' else null end;
  return new;
end $$;

create trigger set_class_catalog before insert or update of catalog, name, live_format
  on public.competition_classes for each row execute function public.equidate_set_class_catalog();

create function public.equidate_category_key(value text)
returns text language sql immutable strict set search_path = '' as $$
  select regexp_replace(translate(lower(value), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g')
$$;

create function public.equidate_start_catalog_live(
  actor uuid, target_event uuid, target_class uuid, confirmed_differences text[]
)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  category_catalog jsonb;
  current_entries jsonb;
  differences text[];
begin
  perform 1 from auth.users u where u.id = actor and u.raw_app_meta_data->>'equidate_external' = 'true'
    and (u.banned_until is null or u.banned_until <= clock_timestamp()) for share;
  if not found then raise exception 'Cuenta no autorizada' using errcode = '42501'; end if;
  select c.catalog->'categories' into category_catalog
  from public.competition_classes c
  join public.events e on e.id = c.event_id
  join public.external_event_assignments a on a.event_id = e.id and a.user_id = actor
  where c.id = target_class and e.id = target_event and coalesce(e.discipline,'jumping') = 'jumping'
    and (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date <= e.end_date + 1
  for share of c, a, e;
  if not found then raise exception 'Prueba no autorizada' using errcode = '42501'; end if;

  select v.entries into current_entries from public.start_lists h
  join public.start_list_versions v on v.class_id = h.class_id and v.id = h.version_id
  where h.class_id = target_class for share of h;
  if category_catalog is not null then
    select array_agg(distinct label order by label) into differences
    from (
      select coalesce(nullif(btrim(entry->>'category'), ''), 'Sin categoría') as label
      from jsonb_array_elements(coalesce(current_entries, '[]')) entry
      where not exists (
        select 1 from jsonb_array_elements(category_catalog) c
        cross join lateral jsonb_array_elements_text((c->'aliases') || jsonb_build_array(c->>'name', c->>'code')) alias
        where public.equidate_category_key(alias) = public.equidate_category_key(entry->>'category')
      )
    ) missing;
    if differences is not null and differences is distinct from confirmed_differences then
      return differences;
    end if;
  end if;

  perform public.equidate_start_live_results(actor, target_event, target_class);
  return '{}';
end $$;

revoke all on function public.equidate_start_catalog_live(uuid,uuid,uuid,text[]) from public, anon, authenticated;
grant execute on function public.equidate_start_catalog_live(uuid,uuid,uuid,text[]) to service_role;


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
  perform 1 from public.competition_classes c where c.id=target_class and c.event_id=target_event and (case when c.catalog is not null then c.catalog->'definition'->>'behavior' in ('1D','DR') else (c.live_format='double_round' or (c.live_format is null and (coalesce(c.name,'') || ' ' || coalesce(c.description,'')) ~* '(^|[^[:alnum:]_])(dr|doble[[:space:]]+recorrido|1[[:space:]]*(d|desempate)|un[[:space:]]+desempate)($|[^[:alnum:]_])')) end) for share;
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
