BEGIN;

-- 1. Actualizar restricción de tipos de documentos para incluir 'OTHER' (Otro documento)
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('PROGRAM', 'REGULATION', 'OTHER', 'START_LIST', 'RESULT'));

-- 2. Función disparadora de asignación:
--    - Anteprograma: general del concurso (class_id = NULL, event_date = NULL, nombre automático 'Anteprograma')
--    - Reglamento: general del concurso (class_id = NULL, event_date = NULL, nombre automático 'Reglamento')
--    - Otro documento: general del concurso (class_id = NULL, event_date = NULL, nombre personalizado obligatorio y no vacío)
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
  ELSIF NEW.type = 'OTHER' THEN
    NEW.class_id := NULL;
    NEW.event_date := NULL;
    IF trim(COALESCE(NEW.name, '')) = '' THEN
      RAISE EXCEPTION 'El nombre del documento es obligatorio.';
    END IF;
    NEW.name := trim(NEW.name);
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

COMMIT;
