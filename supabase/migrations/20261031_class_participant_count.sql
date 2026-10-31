BEGIN;

-- 1. Incorporar campo participant_count a la tabla public.competition_classes
-- Permite enteros mayores o iguales a cero, opcional (NULL por defecto)
ALTER TABLE public.competition_classes
  ADD COLUMN IF NOT EXISTS participant_count integer NULL
  CHECK (participant_count IS NULL OR participant_count >= 0);

COMMENT ON COLUMN public.competition_classes.participant_count IS 'Cantidad manual de participantes inscriptos en la prueba';

COMMIT;
