BEGIN;

CREATE OR REPLACE FUNCTION public.equidate_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT COALESCE(auth.jwt() -> 'app_metadata' -> 'equidate_admin' = 'true'::jsonb, false) $$;
REVOKE ALL ON FUNCTION public.equidate_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equidate_is_admin() TO anon, authenticated;

CREATE TABLE public.competition_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  youtube_url text,
  time_zone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  UNIQUE (event_id, event_date),
  UNIQUE (id, event_id, event_date),
  CHECK (youtube_url IS NULL OR youtube_url ~ '^https?://(www\.|m\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)/')
);

CREATE TABLE public.competition_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL,
  event_id uuid NOT NULL,
  event_date date NOT NULL,
  start_time time,
  number text NOT NULL CHECK (length(trim(number)) > 0),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 1 CHECK (sort_order >= 0),
  FOREIGN KEY (day_id, event_id, event_date) REFERENCES public.competition_days(id, event_id, event_date) ON DELETE CASCADE,
  UNIQUE (id, event_id, event_date)
);
CREATE INDEX competition_classes_day_order ON public.competition_classes(day_id, start_time, sort_order);

ALTER TABLE public.documents ADD COLUMN class_id uuid;
ALTER TABLE public.documents ADD CONSTRAINT documents_class_day_fk
  FOREIGN KEY (class_id, event_id, event_date)
  REFERENCES public.competition_classes(id, event_id, event_date) ON DELETE NO ACTION;
ALTER TABLE public.documents ADD CONSTRAINT documents_class_type_check
  CHECK (class_id IS NULL OR (event_date IS NOT NULL AND type IN ('START_LIST', 'RESULT')));
CREATE INDEX documents_class_id_idx ON public.documents(class_id);

CREATE FUNCTION public.equidate_validate_day()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.events WHERE id = NEW.event_id
    AND NEW.event_date BETWEEN start_date AND end_date FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La jornada debe estar dentro de las fechas del concurso.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.time_zone)
    THEN RAISE EXCEPTION 'Zona horaria inválida.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER equidate_validate_day BEFORE INSERT OR UPDATE ON public.competition_days
FOR EACH ROW EXECUTE FUNCTION public.equidate_validate_day();

CREATE FUNCTION public.equidate_validate_event_dates()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NEW.start_date > NEW.end_date THEN RAISE EXCEPTION 'Fechas de concurso inválidas.'; END IF;
  IF EXISTS (SELECT 1 FROM public.competition_days WHERE event_id = NEW.id
    AND event_date NOT BETWEEN NEW.start_date AND NEW.end_date)
    THEN RAISE EXCEPTION 'Las fechas nuevas dejarían jornadas fuera del concurso.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER equidate_validate_event_dates BEFORE INSERT OR UPDATE OF start_date, end_date ON public.events
FOR EACH ROW EXECUTE FUNCTION public.equidate_validate_event_dates();

ALTER TABLE public.competition_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY equidate_days_read ON public.competition_days FOR SELECT TO anon, authenticated
USING (public.equidate_is_admin() OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published'));
CREATE POLICY equidate_days_admin ON public.competition_days FOR ALL TO authenticated
USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());
CREATE POLICY equidate_classes_read ON public.competition_classes FOR SELECT TO anon, authenticated
USING (public.equidate_is_admin() OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published'));
CREATE POLICY equidate_classes_admin ON public.competition_classes FOR ALL TO authenticated
USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());

CREATE POLICY equidate_events_read_guard ON public.events AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (status = 'published' OR public.equidate_is_admin());
CREATE POLICY equidate_documents_read_guard ON public.documents AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (public.equidate_is_admin() OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published'));
CREATE POLICY equidate_pages_read_guard ON public.document_pages AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (public.equidate_is_admin() OR EXISTS (
  SELECT 1 FROM public.documents JOIN public.events ON events.id = documents.event_id
  WHERE documents.id = document_id AND events.status = 'published'
));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['events', 'documents', 'document_pages'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY equidate_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (public.equidate_is_admin())', table_name);
    EXECUTE format('CREATE POLICY equidate_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin())', table_name);
    EXECUTE format('CREATE POLICY equidate_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING (public.equidate_is_admin())', table_name);
  END LOOP;
END;
$$;

CREATE POLICY equidate_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
WITH CHECK (bucket_id <> 'event-documents' OR public.equidate_is_admin());
CREATE POLICY equidate_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
USING (bucket_id <> 'event-documents' OR public.equidate_is_admin())
WITH CHECK (bucket_id <> 'event-documents' OR public.equidate_is_admin());
CREATE POLICY equidate_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
USING (bucket_id <> 'event-documents' OR public.equidate_is_admin());

REVOKE ALL ON public.events, public.documents, public.document_pages, public.competition_days, public.competition_classes FROM anon, authenticated;
GRANT SELECT ON public.events, public.documents, public.document_pages, public.competition_days, public.competition_classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events, public.documents, public.document_pages, public.competition_days, public.competition_classes TO authenticated;

CREATE FUNCTION public.equidate_save_document(payload jsonb, page_payload jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE document_id_value uuid := (payload->>'id')::uuid;
BEGIN
  IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Permisos de administrador requeridos.' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.documents(id, event_id, name, type, event_date, class_id, storage_path, mime_type, sort_order)
  VALUES (document_id_value, (payload->>'event_id')::uuid, payload->>'name', payload->>'type',
    (payload->>'event_date')::date, (payload->>'class_id')::uuid, payload->>'storage_path', payload->>'mime_type',
    (payload->>'sort_order')::integer)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, event_date = EXCLUDED.event_date,
    class_id = EXCLUDED.class_id, storage_path = EXCLUDED.storage_path, mime_type = EXCLUDED.mime_type,
    sort_order = EXCLUDED.sort_order
  WHERE documents.event_id = EXCLUDED.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se puede cambiar el concurso de un documento.'; END IF;
  IF page_payload IS NOT NULL AND page_payload <> 'null'::jsonb THEN
    IF jsonb_typeof(page_payload) <> 'array' THEN RAISE EXCEPTION 'Páginas inválidas.'; END IF;
    DELETE FROM public.document_pages WHERE document_id = document_id_value;
    INSERT INTO public.document_pages(document_id, storage_path, mime_type, sort_order)
    SELECT document_id_value, page->>'storage_path', page->>'mime_type', (page->>'sort_order')::integer
    FROM jsonb_array_elements(page_payload) AS page;
  END IF;
  RETURN document_id_value;
END;
$$;
REVOKE ALL ON FUNCTION public.equidate_save_document(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equidate_save_document(jsonb, jsonb) TO authenticated;

CREATE FUNCTION public.equidate_swap_documents(first_id uuid, second_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE first_doc public.documents; second_doc public.documents;
BEGIN
  IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Permisos de administrador requeridos.' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.documents WHERE id IN (first_id, second_id) ORDER BY id FOR UPDATE;
  SELECT * INTO STRICT first_doc FROM public.documents WHERE id = first_id;
  SELECT * INTO STRICT second_doc FROM public.documents WHERE id = second_id;
  IF first_doc.event_id <> second_doc.event_id OR first_doc.type <> second_doc.type OR first_doc.event_date IS DISTINCT FROM second_doc.event_date
    THEN RAISE EXCEPTION 'Los documentos deben pertenecer al mismo grupo.'; END IF;
  UPDATE public.documents SET sort_order = CASE WHEN id = first_id THEN second_doc.sort_order ELSE first_doc.sort_order END
    WHERE id IN (first_id, second_id);
END;
$$;
REVOKE ALL ON FUNCTION public.equidate_swap_documents(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equidate_swap_documents(uuid, uuid) TO authenticated;

COMMIT;
