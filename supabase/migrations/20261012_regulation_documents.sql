BEGIN;

-- 1. Restricción de tipos de documentos para incluir 'REGULATION' (Reglamento)
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('PROGRAM', 'REGULATION', 'START_LIST', 'RESULT'));

-- 2. Función disparadora de asignación:
--    - Anteprograma y Reglamento: generales del concurso (class_id = NULL, event_date = NULL, nombre automático)
--    - Listado y Resultado: obligatoriamente asociados a una prueba del mismo concurso
CREATE OR REPLACE FUNCTION public.equidate_document_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE entry public.competition_classes;
BEGIN
  IF NEW.type = 'PROGRAM' THEN
    NEW.class_id := NULL;
    NEW.event_date := NULL;
    NEW.name := 'Anteprograma';
  ELSIF NEW.type = 'REGULATION' THEN
    NEW.class_id := NULL;
    NEW.event_date := NULL;
    NEW.name := 'Reglamento';
  ELSIF NEW.class_id IS NOT NULL THEN
    SELECT * INTO STRICT entry FROM public.competition_classes WHERE id = NEW.class_id AND event_id = NEW.event_id;
    NEW.event_date := entry.event_date;
    NEW.name := CASE WHEN NEW.type = 'START_LIST' THEN 'Listado' ELSE 'Resultados' END || ' · Prueba ' || entry.number || ' · ' || entry.name;
  ELSE
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Los listados y resultados deben estar asociados a una prueba.';
    ELSIF OLD.class_id IS NOT NULL OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.event_date IS DISTINCT FROM OLD.event_date THEN
      RAISE EXCEPTION 'Seleccioná una prueba para guardar esta asignación.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Configuración del bucket de almacenamiento para PDF e imágenes con límite de 25 MB (sin alterar visibilidad)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    EXECUTE 'UPDATE storage.buckets SET allowed_mime_types = NULL, file_size_limit = 26214400 WHERE id = ''event-documents''';
  END IF;
END $$;

-- 4. Función RPC atómica para eliminar un documento de forma segura
--    - Verifica permisos de administrador
--    - Elimina exclusivamente el documento y sus páginas asociadas (no altera pruebas ni concurso)
--    - Identifica y devuelve las rutas de Storage que no están compartidas con otros documentos
CREATE OR REPLACE FUNCTION public.equidate_delete_document(target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  doc public.documents;
  deleted_paths text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.equidate_is_admin() THEN
    RAISE EXCEPTION 'Permisos de administrador requeridos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO doc FROM public.documents WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento no encontrado.';
  END IF;

  -- Recopilar rutas de almacenamiento que pertenecen a este documento y que NO están compartidas con otros documentos
  SELECT COALESCE(array_agg(candidate.storage_path), ARRAY[]::text[]) INTO deleted_paths
  FROM (
    SELECT p.storage_path
    FROM public.document_pages p
    WHERE p.document_id = target_id AND p.storage_path IS NOT NULL
    UNION
    SELECT d.storage_path
    FROM public.documents d
    WHERE d.id = target_id AND d.storage_path IS NOT NULL
  ) candidate
  WHERE NOT EXISTS (
    SELECT 1 FROM public.document_pages other_p
    WHERE other_p.document_id <> target_id AND other_p.storage_path = candidate.storage_path
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.documents other_d
    WHERE other_d.id <> target_id AND other_d.storage_path = candidate.storage_path
  );

  -- Eliminar páginas asociadas y el documento
  DELETE FROM public.document_pages WHERE document_id = target_id;
  DELETE FROM public.documents WHERE id = target_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', target_id,
    'deleted_storage_paths', to_jsonb(deleted_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.equidate_delete_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equidate_delete_document(uuid) TO authenticated;

COMMIT;
