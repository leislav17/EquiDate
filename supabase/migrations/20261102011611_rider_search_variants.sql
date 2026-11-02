BEGIN;
ALTER TABLE public.rider_associations ADD COLUMN name_variants text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.merge_rider_associations(sources text[], chosen_name text, change_reason text, expected_rows jsonb)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE identity_id uuid := gen_random_uuid(); current_rows jsonb; variants text[];
BEGIN
 IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Administrador requerido' USING ERRCODE='42501'; END IF;
 IF cardinality(sources) IS NULL OR cardinality(sources)=0 OR cardinality(sources)>10000
 OR length(btrim(chosen_name)) NOT BETWEEN 1 AND 150 OR chosen_name IS NULL
 OR length(btrim(change_reason)) NOT BETWEEN 3 AND 500 OR change_reason IS NULL THEN RAISE EXCEPTION 'Selección, nombre o motivo inválidos'; END IF;
 LOCK TABLE public.rider_associations IN SHARE ROW EXCLUSIVE MODE;
 SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.source),'[]'::jsonb) INTO current_rows
 FROM public.rider_associations a WHERE a.source=ANY(sources);
 IF current_rows IS DISTINCT FROM expected_rows THEN RAISE EXCEPTION 'Las asociaciones cambiaron. Recargá y revisá la vista previa.'; END IF;
 -- Every requested source must refer to an immutable source row; never create phantom aliases.
 IF EXISTS (SELECT 1 FROM unnest(sources) s WHERE NOT (
 EXISTS (SELECT 1 FROM public.start_list_versions v, LATERAL jsonb_array_elements(v.entries) r
 WHERE s='start:'||v.id::text||':'||(r->>'position')) OR
 EXISTS (SELECT 1 FROM public.result_list_versions v, LATERAL jsonb_array_elements(v.entries) r
 WHERE s='result:'||v.id::text||':'||(r->>'position')))) THEN RAISE EXCEPTION 'Registro original inexistente'; END IF;
 SELECT COALESCE(array_agg(DISTINCT name ORDER BY name) FILTER (WHERE name IS NOT NULL),'{}'::text[]) INTO variants
 FROM (SELECT a.canonical_name name FROM public.rider_associations a WHERE a.source=ANY(sources)
 UNION SELECT unnest(a.name_variants) FROM public.rider_associations a WHERE a.source=ANY(sources)) names;
 INSERT INTO public.rider_associations(source,identity,reason,canonical_name,name_variants)
 SELECT DISTINCT s,identity_id,btrim(change_reason),btrim(chosen_name),variants FROM unnest(sources) s
 ON CONFLICT(source) DO UPDATE SET identity=EXCLUDED.identity,reason=EXCLUDED.reason,canonical_name=EXCLUDED.canonical_name,name_variants=EXCLUDED.name_variants;
 RETURN pg_catalog.txid_current()::text;
END $$;
CREATE OR REPLACE FUNCTION public.revert_rider_association(target_operation text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE h record; current_row jsonb;
BEGIN
 IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Administrador requerido' USING ERRCODE='42501'; END IF;
 LOCK TABLE public.rider_associations IN SHARE ROW EXCLUSIVE MODE;
 IF NOT EXISTS (SELECT 1 FROM public.rider_association_history WHERE operation=target_operation)
 OR EXISTS (SELECT 1 FROM public.rider_association_history WHERE reverses_operation=target_operation OR (operation=target_operation AND reverses_operation IS NOT NULL)) THEN RAISE EXCEPTION 'Operación inexistente o ya revertida'; END IF;
 FOR h IN SELECT * FROM public.rider_association_history WHERE operation=target_operation ORDER BY id DESC LOOP
  SELECT to_jsonb(a) INTO current_row FROM public.rider_associations a WHERE a.source=h.source;
  IF current_row IS DISTINCT FROM h.after_row THEN RAISE EXCEPTION 'Hay cambios posteriores. Revertí primero las asociaciones posteriores.'; END IF;
  PERFORM set_config('equidate.reverses_operation',target_operation,true);
  IF h.before_row IS NULL THEN DELETE FROM public.rider_associations WHERE source=h.source;
  ELSE INSERT INTO public.rider_associations(source,identity,reason,canonical_name,name_variants)
   VALUES(h.before_row->>'source',(h.before_row->>'identity')::uuid,h.before_row->>'reason',h.before_row->>'canonical_name',ARRAY(SELECT jsonb_array_elements_text(COALESCE(h.before_row->'name_variants','[]'::jsonb))))
   ON CONFLICT(source) DO UPDATE SET identity=EXCLUDED.identity,reason=EXCLUDED.reason,canonical_name=EXCLUDED.canonical_name,name_variants=EXCLUDED.name_variants;
  END IF;
 END LOOP;
 PERFORM set_config('equidate.reverses_operation','',true);
END $$;
CREATE OR REPLACE FUNCTION public.equidate_valid_event_slug(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT value IS NOT NULL AND length(value) BETWEEN 1 AND 120
    AND value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND value <> ALL (ARRAY['admin','assets','api','auth','event','events','concurso','concursos',
      'informacion-util','buscar','document','documents','start-list','results','transmission','login','logout','index','404','robots','sitemap']);
$$;

COMMIT;
