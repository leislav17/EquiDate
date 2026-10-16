BEGIN;

-- 1. Agregar columna important_info a events para contenido libre opcional de cada concurso
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS important_info text DEFAULT NULL;

COMMIT;
