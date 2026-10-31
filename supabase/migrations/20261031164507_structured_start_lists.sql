BEGIN;

-- Additive only: no historical document, class or participant_count is changed.
CREATE TABLE public.start_list_versions (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.competition_classes(id) ON DELETE RESTRICT,
  entries jsonb NOT NULL CHECK (jsonb_typeof(entries) = 'array' AND jsonb_array_length(entries) <= 10000),
  source_name text NOT NULL CHECK (length(trim(source_name)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, id)
);
CREATE INDEX start_list_versions_class ON public.start_list_versions(class_id, created_at DESC);
CREATE TABLE public.start_lists (
  class_id uuid PRIMARY KEY REFERENCES public.competition_classes(id) ON DELETE RESTRICT,
  version_id uuid,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (class_id, version_id) REFERENCES public.start_list_versions(class_id, id) ON DELETE RESTRICT
);
CREATE INDEX start_lists_version ON public.start_lists(version_id);

CREATE FUNCTION public.equidate_validate_start_entries() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; positions integer[] := '{}'; pairs text[] := '{}'; pos integer; pair text;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.entries) LOOP
    IF jsonb_typeof(item) <> 'object' OR jsonb_typeof(item->'position') IS DISTINCT FROM 'number'
       OR (item->>'position') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Orden inválido';
    END IF;
    pos := (item->>'position')::integer;
    IF pos < 1 OR pos = ANY(positions) THEN RAISE EXCEPTION 'Orden repetido o inválido'; END IF;
    IF jsonb_typeof(item->'rider') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'horse') IS DISTINCT FROM 'string'
       OR length(trim(item->>'rider')) NOT BETWEEN 1 AND 300
       OR length(trim(item->>'horse')) NOT BETWEEN 1 AND 300
       OR (item ? 'club' AND jsonb_typeof(item->'club') NOT IN ('string', 'null'))
       OR length(coalesce(item->>'club','')) > 300 THEN
      RAISE EXCEPTION 'Jinete, caballo o club inválido';
    END IF;
    pair := lower(regexp_replace(trim(item->>'rider'), '\s+', ' ', 'g')) || chr(31)
      || lower(regexp_replace(trim(item->>'horse'), '\s+', ' ', 'g'));
    IF pair = ANY(pairs) THEN RAISE EXCEPTION 'Binomio duplicado'; END IF;
    positions := array_append(positions, pos); pairs := array_append(pairs, pair);
  END LOOP;
  -- Canonical order is independent of PDF extraction order.
  SELECT coalesce(jsonb_agg(value ORDER BY (value->>'position')::integer), '[]'::jsonb)
    INTO NEW.entries FROM jsonb_array_elements(NEW.entries);
  RETURN NEW;
END $$;
CREATE TRIGGER validate_start_entries BEFORE INSERT ON public.start_list_versions
FOR EACH ROW EXECUTE FUNCTION public.equidate_validate_start_entries();
REVOKE ALL ON FUNCTION public.equidate_validate_start_entries() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.start_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.start_list_versions ENABLE ROW LEVEL SECURITY;
-- Supabase may grant broad privileges through default privileges; reset them explicitly.
REVOKE ALL ON public.start_lists, public.start_list_versions FROM anon, authenticated;
GRANT SELECT ON public.start_lists, public.start_list_versions TO anon, authenticated;
GRANT INSERT ON public.start_list_versions TO authenticated;
GRANT INSERT, UPDATE ON public.start_lists TO authenticated;
-- Versions are append-only, even for administrators using the browser API.
REVOKE UPDATE, DELETE ON public.start_list_versions FROM anon, authenticated;
REVOKE DELETE ON public.start_lists FROM anon, authenticated;
CREATE POLICY start_lists_read ON public.start_lists FOR SELECT TO anon, authenticated
USING (public.equidate_is_admin() OR EXISTS (
  SELECT 1 FROM public.competition_classes c JOIN public.events e ON e.id=c.event_id
  WHERE c.id=class_id AND e.status='published'));
CREATE POLICY start_lists_insert ON public.start_lists FOR INSERT TO authenticated
WITH CHECK (public.equidate_is_admin());
CREATE POLICY start_lists_update ON public.start_lists FOR UPDATE TO authenticated
USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());
CREATE POLICY start_versions_read ON public.start_list_versions FOR SELECT TO anon, authenticated
USING (public.equidate_is_admin() OR EXISTS (
  SELECT 1 FROM public.start_lists h JOIN public.competition_classes c ON c.id=h.class_id
  JOIN public.events e ON e.id=c.event_id
  WHERE h.version_id=start_list_versions.id AND e.status='published'));
CREATE POLICY start_versions_insert ON public.start_list_versions FOR INSERT TO authenticated
WITH CHECK (public.equidate_is_admin());

-- A batch is one transaction. Compare-and-swap revisions prevent lost corrections,
-- including publish -> unpublish -> publish races (the ABA problem).
CREATE FUNCTION public.equidate_import_start_lists(batch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; target uuid; current_head public.start_lists; new_id uuid;
  saved public.start_list_versions; result jsonb := '[]'; count_items integer;
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
    SELECT * INTO current_head FROM public.start_lists WHERE class_id=target FOR UPDATE;
    new_id := (item->>'id')::uuid;
    IF new_id IS NULL THEN RAISE EXCEPTION 'Falta identificador de importación'; END IF;
    SELECT * INTO saved FROM public.start_list_versions WHERE id=new_id;
    IF FOUND THEN
      IF saved.class_id IS DISTINCT FROM target OR saved.entries IS DISTINCT FROM (
          SELECT coalesce(jsonb_agg(value ORDER BY (value->>'position')::integer), '[]'::jsonb)
          FROM jsonb_array_elements(item->'entries')) OR saved.source_name IS DISTINCT FROM item->>'sourceName'
        OR current_head.version_id IS DISTINCT FROM new_id THEN RAISE EXCEPTION 'Identificador ya utilizado'; END IF;
      result := result || jsonb_build_array(jsonb_build_object('classId',target,'versionId',new_id,'revision',current_head.revision));
      CONTINUE;
    END IF;
    IF current_head.revision IS DISTINCT FROM (item->>'expectedRevision')::uuid THEN
      RAISE EXCEPTION 'El listado cambió. Actualizá y revisá el reemplazo antes de continuar.' USING ERRCODE='40001';
    END IF;
    INSERT INTO public.start_list_versions(id,class_id,entries,source_name)
      VALUES(new_id,target,item->'entries',item->>'sourceName');
    INSERT INTO public.start_lists(class_id,version_id) VALUES(target,new_id)
      ON CONFLICT(class_id) DO UPDATE SET version_id=new_id, revision=gen_random_uuid(), updated_at=now()
      RETURNING * INTO current_head;
    result := result || jsonb_build_array(jsonb_build_object('classId',target,'versionId',new_id,'revision',current_head.revision));
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.equidate_import_start_lists(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equidate_import_start_lists(jsonb) TO authenticated;

CREATE FUNCTION public.equidate_unpublish_start_list(target uuid, expected_revision uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
  PERFORM id FROM public.competition_classes WHERE id=target FOR UPDATE;
  UPDATE public.start_lists SET version_id=NULL, revision=gen_random_uuid(), updated_at=now()
    WHERE class_id=target AND revision=expected_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'El listado cambió. Actualizá antes de continuar.' USING ERRCODE='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.equidate_unpublish_start_list(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equidate_unpublish_start_list(uuid,uuid) TO authenticated;
COMMIT;
