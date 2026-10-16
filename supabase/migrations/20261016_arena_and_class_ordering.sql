BEGIN;

-- 1. Asegurar columna sort_order en competition_classes para orden de visualización de pruebas
ALTER TABLE public.competition_classes
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Agregar columna sort_order a competition_arenas para orden de pistas
ALTER TABLE public.competition_arenas
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 1 CHECK (sort_order >= 0);

-- 3. Asignar sort_order = 1 a la pista principal existente si aún no lo tiene
UPDATE public.competition_arenas SET sort_order = 1 WHERE is_primary;

COMMIT;
