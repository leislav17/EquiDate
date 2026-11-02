BEGIN;
-- Reuse the trusted app metadata authorization contract; also recognize superadmin.
CREATE OR REPLACE FUNCTION public.equidate_is_admin() RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT COALESCE(auth.jwt()->'app_metadata'->'equidate_admin' = 'true'::jsonb, false)
 OR COALESCE(auth.jwt()->'app_metadata'->>'role' = 'superadmin', false)
$$;
CREATE TABLE public.useful_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 150),
 url text CHECK (url IS NULL OR (url ~ '^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$' AND url !~ '^https?://[^/]*@')),
 sort_order integer NOT NULL DEFAULT 0,
 published boolean NOT NULL DEFAULT false,
 CHECK (NOT published OR url IS NOT NULL)
);
ALTER TABLE public.useful_resources ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.useful_resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.useful_resources TO authenticated;
CREATE POLICY resources_read ON public.useful_resources FOR SELECT TO anon, authenticated USING (published OR public.equidate_is_admin());
CREATE POLICY resources_write ON public.useful_resources FOR ALL TO authenticated USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());
CREATE INDEX useful_resources_order ON public.useful_resources(sort_order, id);
INSERT INTO public.useful_resources(title,url,sort_order,published) VALUES
 ('Federación Ecuestre Argentina','https://fedecuarg.com.ar/',10,true),
 ('Aranceles FEA','https://drive.google.com/file/d/1b5Tscb40dsuS5aVsB4HLYTq-7W_EY_yW/view',20,true),
 ('Asociación Argentina de Fomento Equino','https://www.fomentoequino.net/',30,true);

ALTER TABLE public.rider_associations ADD COLUMN canonical_name text CHECK (canonical_name IS NULL OR length(btrim(canonical_name)) BETWEEN 1 AND 150);
CREATE TABLE public.rider_association_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 operation text NOT NULL,
 source text NOT NULL,
 before_row jsonb,
 after_row jsonb,
 actor uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 reverses_operation text
);
CREATE INDEX rider_history_operation ON public.rider_association_history(operation);
CREATE INDEX rider_history_source ON public.rider_association_history(source,id DESC);
ALTER TABLE public.rider_association_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rider_association_history FROM anon, authenticated;
GRANT SELECT ON public.rider_association_history TO authenticated;
CREATE POLICY rider_history_read ON public.rider_association_history FOR SELECT TO authenticated USING (public.equidate_is_admin());
-- Only this internal trigger may append audit records. No API role can edit the history.
CREATE SCHEMA IF NOT EXISTS equidate_private;
REVOKE ALL ON SCHEMA equidate_private FROM PUBLIC;
CREATE FUNCTION equidate_private.audit_rider_association() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Administrador requerido' USING ERRCODE='42501'; END IF;
 INSERT INTO public.rider_association_history(operation,source,before_row,after_row,actor,reverses_operation)
 VALUES (pg_catalog.txid_current()::text, COALESCE(NEW.source,OLD.source),
 CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
 CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END,
 (auth.jwt()->>'sub')::uuid, NULLIF(current_setting('equidate.reverses_operation',true),''));
 RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION equidate_private.audit_rider_association() FROM PUBLIC;
CREATE TRIGGER rider_association_audit AFTER INSERT OR UPDATE OR DELETE ON public.rider_associations
 FOR EACH ROW EXECUTE FUNCTION equidate_private.audit_rider_association();

CREATE FUNCTION public.merge_rider_associations(sources text[], chosen_name text, change_reason text, expected_rows jsonb)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE identity_id uuid := gen_random_uuid(); current_rows jsonb;
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
 INSERT INTO public.rider_associations(source,identity,reason,canonical_name)
 SELECT DISTINCT s,identity_id,btrim(change_reason),btrim(chosen_name) FROM unnest(sources) s
 ON CONFLICT(source) DO UPDATE SET identity=EXCLUDED.identity,reason=EXCLUDED.reason,canonical_name=EXCLUDED.canonical_name;
 RETURN pg_catalog.txid_current()::text;
END $$;
REVOKE ALL ON FUNCTION public.merge_rider_associations(text[],text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_rider_associations(text[],text,text,jsonb) TO authenticated;

CREATE FUNCTION public.revert_rider_association(target_operation text)
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
  ELSE INSERT INTO public.rider_associations(source,identity,reason,canonical_name)
   VALUES(h.before_row->>'source',(h.before_row->>'identity')::uuid,h.before_row->>'reason',h.before_row->>'canonical_name')
   ON CONFLICT(source) DO UPDATE SET identity=EXCLUDED.identity,reason=EXCLUDED.reason,canonical_name=EXCLUDED.canonical_name;
  END IF;
 END LOOP;
 PERFORM set_config('equidate.reverses_operation','',true);
END $$;
REVOKE ALL ON FUNCTION public.revert_rider_association(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_rider_association(text) TO authenticated;
COMMIT;
