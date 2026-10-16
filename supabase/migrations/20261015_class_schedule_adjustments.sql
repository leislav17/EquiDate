BEGIN;

-- 1. Campos para horarios aproximados y pruebas continuadas
ALTER TABLE public.competition_classes
  ADD COLUMN IF NOT EXISTS is_approximate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_continuous boolean NOT NULL DEFAULT false;

-- 2. Asegurar que start_time permita valores nulos para borrar horarios previamente cargados
ALTER TABLE public.competition_classes
  ALTER COLUMN start_time DROP NOT NULL;

COMMIT;
