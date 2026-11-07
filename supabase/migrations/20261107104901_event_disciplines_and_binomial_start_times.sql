BEGIN;

-- Legacy events keep NULL, interpreted as jumping by the public listings.
ALTER TABLE public.events ADD COLUMN discipline text
  CHECK (discipline IN ('jumping', 'dressage', 'training'));

-- Keep the new navigation routes available without changing existing slugs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.events WHERE slug IN ('jumping', 'dressage', 'training')) THEN
    RAISE EXCEPTION 'Un concurso ya utiliza una ruta reservada.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.equidate_valid_event_slug(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT value IS NOT NULL AND length(value) BETWEEN 1 AND 120
    AND value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND value <> ALL (ARRAY['admin','assets','api','auth','event','events','concurso','concursos',
      'jumping','dressage','training','informacion-util','buscar','document','documents','start-list','results','transmission','login','logout','index','404','robots','sitemap']);
$$;

CREATE OR REPLACE FUNCTION public.equidate_validate_start_entries() RETURNS trigger
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
       OR length(trim(item->>'horse')) > 300
       OR (item ? 'club' AND jsonb_typeof(item->'club') NOT IN ('string', 'null'))
       OR length(coalesce(item->>'club','')) > 300 THEN
      RAISE EXCEPTION 'Jinete, caballo o club inválido';
    END IF;
    IF item ? 'scheduledTime' AND (
      jsonb_typeof(item->'scheduledTime') IS DISTINCT FROM 'string'
      OR (item->>'scheduledTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ) THEN
      RAISE EXCEPTION 'Horario de binomio inválido. Usá HH:mm.';
    END IF;
    pair := lower(regexp_replace(trim(item->>'rider'), '\s+', ' ', 'g')) || chr(31)
      || lower(regexp_replace(trim(item->>'horse'), '\s+', ' ', 'g'));
    IF length(trim(item->>'horse')) > 0 AND pair = ANY(pairs) THEN RAISE EXCEPTION 'Binomio duplicado'; END IF;
    positions := array_append(positions, pos); pairs := array_append(pairs, pair);
  END LOOP;
  -- Canonical order is independent of PDF extraction order.
  SELECT coalesce(jsonb_agg(value ORDER BY (value->>'position')::integer), '[]'::jsonb)
    INTO NEW.entries FROM jsonb_array_elements(NEW.entries);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.equidate_validate_start_entries() FROM PUBLIC, anon, authenticated;

COMMIT;
