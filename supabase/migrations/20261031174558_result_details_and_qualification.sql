BEGIN;
ALTER TABLE public.result_list_versions ADD COLUMN details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details)='object');
CREATE OR REPLACE FUNCTION public.equidate_validate_result_entries() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; positions integer[] := '{}'; pairs text[] := '{}'; pos integer; pair text; col jsonb; col_keys text[] := '{}'; val record; detail record; ref jsonb; k text;
BEGIN
  IF jsonb_typeof(NEW.details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos de prueba inválidos'; END IF;
  FOR detail IN SELECT * FROM jsonb_each(NEW.details) LOOP
    IF detail.key NOT IN ('definition','height','allowedTime','optimalTime','rounds') THEN RAISE EXCEPTION 'Dato de prueba desconocido'; END IF;
    IF detail.key <> 'rounds' AND (jsonb_typeof(detail.value) IS DISTINCT FROM 'string' OR length(detail.value #>> '{}') > 300) THEN RAISE EXCEPTION 'Dato de prueba inválido'; END IF;
  END LOOP;
  IF NEW.details ? 'rounds' THEN
    IF jsonb_typeof(NEW.details->'rounds') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.details->'rounds') > 4 THEN RAISE EXCEPTION 'Recorridos inválidos'; END IF;
    FOR ref IN SELECT value FROM jsonb_array_elements(NEW.details->'rounds') LOOP
      IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR jsonb_typeof(ref->'label') IS DISTINCT FROM 'string' OR length(trim(ref->>'label')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Recorrido inválido'; END IF;
      FOR k IN SELECT jsonb_object_keys(ref) LOOP
        IF k NOT IN ('label','allowedTime','optimalTime') OR jsonb_typeof(ref->k) IS DISTINCT FROM 'string' OR length(ref->>k) > 300 THEN RAISE EXCEPTION 'Tiempo de referencia inválido'; END IF;
      END LOOP;
    END LOOP;
  END IF;
  FOR col IN SELECT value FROM jsonb_array_elements(NEW.columns) LOOP
    IF jsonb_typeof(col->'key') IS DISTINCT FROM 'string' OR (col->>'key') !~ '^[a-z][a-z0-9_]{0,39}$'
      OR col->>'key' = ANY(col_keys) OR jsonb_typeof(col->'label') IS DISTINCT FROM 'string'
      OR length(trim(col->>'label')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Columna de resultados inválida'; END IF;
    IF col ? 'group' AND (jsonb_typeof(col->'group') IS DISTINCT FROM 'string' OR length(trim(col->>'group')) > 80) THEN RAISE EXCEPTION 'Grupo inválido'; END IF;
    IF col ? 'scope' AND col->'scope' IS DISTINCT FROM '"class"'::jsonb THEN RAISE EXCEPTION 'Las columnas del campeonato quedan excluidas'; END IF;
    col_keys := array_append(col_keys,col->>'key');
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.entries) LOOP
    IF item ? 'category' AND (jsonb_typeof(item->'category') IS DISTINCT FROM 'string' OR length(item->>'category') > 100) THEN RAISE EXCEPTION 'Categoría inválida'; END IF;
    IF item ? 'qualified' AND jsonb_typeof(item->'qualified') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Clasificación inválida'; END IF;
    IF item ? 'rank' AND (jsonb_typeof(item->'rank') IS DISTINCT FROM 'string' OR length(item->>'rank') > 60)
      THEN RAISE EXCEPTION 'Puesto inválido'; END IF;
    IF item ? 'values' AND jsonb_typeof(item->'values') IS DISTINCT FROM 'object'
      THEN RAISE EXCEPTION 'Valores de resultados inválidos'; END IF;
    FOR val IN SELECT * FROM jsonb_each(coalesce(item->'values','{}'::jsonb)) LOOP
      IF NOT val.key = ANY(col_keys) OR jsonb_typeof(val.value) IS DISTINCT FROM 'string'
        OR length(val.value #>> '{}') > 300 THEN RAISE EXCEPTION 'Valor o columna de resultados inválidos'; END IF;
    END LOOP;
    IF jsonb_typeof(item) <> 'object' OR jsonb_typeof(item->'position') IS DISTINCT FROM 'number'
       OR (item->>'position') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Orden inválido';
    END IF;
    pos := (item->>'position')::integer;
    IF pos < 1 OR pos = ANY(positions) THEN RAISE EXCEPTION 'Orden repetido o inválido'; END IF;
    IF jsonb_typeof(item->'rider') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'horse') IS DISTINCT FROM 'string'
       OR length(trim(item->>'rider')) NOT BETWEEN 1 AND 300
       OR length(trim(item->>'horse')) > 300
       OR (item ? 'club' AND jsonb_typeof(item->'club') NOT IN ('string', 'null'))
       OR length(coalesce(item->>'club','')) > 300 THEN
      RAISE EXCEPTION 'Jinete, caballo o club inválido';
    END IF;
    pair := lower(regexp_replace(trim(item->>'rider'), '\s+', ' ', 'g')) || chr(31)
      || lower(regexp_replace(trim(item->>'horse'), '\s+', ' ', 'g')) || chr(31) || lower(regexp_replace(trim(coalesce(item->>'category','')), '\s+', ' ', 'g'));
    IF length(trim(item->>'horse')) > 0 AND pair = ANY(pairs) THEN RAISE EXCEPTION 'Binomio duplicado'; END IF;
    positions := array_append(positions, pos); pairs := array_append(pairs, pair);
  END LOOP;
  -- Canonical order is independent of PDF extraction order.
  SELECT coalesce(jsonb_agg(value ORDER BY (value->>'position')::integer), '[]'::jsonb)
    INTO NEW.entries FROM jsonb_array_elements(NEW.entries);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.equidate_validate_result_entries() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.equidate_import_result_lists(batch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; target uuid; current_head public.result_lists; new_id uuid;
  saved public.result_list_versions; result jsonb := '[]'; count_items integer;
BEGIN
  IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(batch) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lote inválido'; END IF;
  count_items := jsonb_array_length(batch);
  IF count_items NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Se permiten de 1 a 100 pruebas'; END IF;
  IF (SELECT count(DISTINCT value->>'classId') FROM jsonb_array_elements(batch)) <> count_items THEN
    RAISE EXCEPTION 'Prueba repetida';
  END IF;
  -- Lock in a deterministic order to serialize imports of the same classes.
  PERFORM c.id FROM public.competition_classes c
    WHERE c.id IN (SELECT (value->>'classId')::uuid FROM jsonb_array_elements(batch)) ORDER BY c.id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(batch) LOOP
    target := (item->>'classId')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.competition_classes c WHERE c.id=target AND c.event_id=(item->>'eventId')::uuid
      AND c.event_date=(item->>'date')::date AND c.arena_id=(item->>'arenaId')::uuid AND c.number=item->>'number') THEN
      RAISE EXCEPTION 'La prueba no coincide con concurso, jornada, pista y número';
    END IF;
    IF item->'reviewed' IS DISTINCT FROM 'true'::jsonb OR item->'uncertainties' IS DISTINCT FROM '[]'::jsonb
      OR NOT (item ? 'expectedRevision') THEN RAISE EXCEPTION 'Falta revisión o hay datos inciertos'; END IF;
    SELECT * INTO current_head FROM public.result_lists WHERE class_id=target FOR UPDATE;
    new_id := (item->>'id')::uuid;
    IF new_id IS NULL THEN RAISE EXCEPTION 'Falta identificador de importación'; END IF;
    SELECT * INTO saved FROM public.result_list_versions WHERE id=new_id;
    IF FOUND THEN
      IF saved.class_id IS DISTINCT FROM target OR saved.entries IS DISTINCT FROM (
          SELECT coalesce(jsonb_agg(value ORDER BY (value->>'position')::integer), '[]'::jsonb)
          FROM jsonb_array_elements(item->'entries')) OR saved.source_name IS DISTINCT FROM item->>'sourceName' OR saved.columns IS DISTINCT FROM item->'columns' OR saved.details IS DISTINCT FROM coalesce(item->'details','{}'::jsonb)
        OR current_head.version_id IS DISTINCT FROM new_id THEN RAISE EXCEPTION 'Identificador ya utilizado'; END IF;
      result := result || jsonb_build_array(jsonb_build_object('classId',target,'versionId',new_id,'revision',current_head.revision));
      CONTINUE;
    END IF;
    IF current_head.revision IS DISTINCT FROM (item->>'expectedRevision')::uuid THEN
      RAISE EXCEPTION 'El listado cambió. Actualizá y revisá el reemplazo antes de continuar.' USING ERRCODE='40001';
    END IF;
    INSERT INTO public.result_list_versions(id,class_id,entries,source_name,columns,details)
      VALUES(new_id,target,item->'entries',item->>'sourceName',item->'columns',coalesce(item->'details','{}'::jsonb));
    INSERT INTO public.result_lists(class_id,version_id) VALUES(target,new_id)
      ON CONFLICT(class_id) DO UPDATE SET version_id=new_id, revision=gen_random_uuid(), updated_at=now()
      RETURNING * INTO current_head;
    result := result || jsonb_build_array(jsonb_build_object('classId',target,'versionId',new_id,'revision',current_head.revision));
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.equidate_import_result_lists(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equidate_import_result_lists(jsonb) TO authenticated;

COMMIT;
