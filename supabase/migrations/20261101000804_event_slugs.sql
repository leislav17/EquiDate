BEGIN;

-- Additive: identifiers, associations, RLS, documents and results are unchanged.
LOCK TABLE public.events IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.events ADD COLUMN slug text;

CREATE FUNCTION public.equidate_valid_event_slug(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT value IS NOT NULL AND length(value) BETWEEN 1 AND 120
    AND value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND value <> ALL (ARRAY['admin','assets','api','auth','event','events','concurso','concursos',
      'document','documents','start-list','results','transmission','login','logout','index','404','robots','sitemap']);
$$;

CREATE FUNCTION public.equidate_assign_event_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  base text;
  candidate text;
  suffix integer := 1;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'El enlace del concurso es permanente y no se puede cambiar.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base := trim(both '-' from regexp_replace(
      translate(lower(NEW.name), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g'));
    IF base LIKE '%san-diego%' THEN base := 'san-diego';
    ELSIF base LIKE '%san-jorge-village%' THEN
      base := CASE WHEN base LIKE '%pasadas%preliminar%' THEN 'sjv-pasadas-preliminar'
        WHEN base LIKE '%preliminar%' THEN 'sjv-preliminar' ELSE 'sjv' END;
    END IF;
    base := rtrim(left(base, 100), '-');
    IF NOT public.equidate_valid_event_slug(base) THEN base := 'concurso-' || NEW.id::text; END IF;
    -- Serialize automatic allocation across concurrent admin inserts.
    PERFORM pg_catalog.pg_advisory_xact_lock(1784608127);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = candidate AND id <> NEW.id) LOOP
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    END LOOP;
    NEW.slug := candidate;
  ELSE
    NEW.slug := lower(btrim(NEW.slug));
  END IF;
  IF NOT public.equidate_valid_event_slug(NEW.slug) THEN
    RAISE EXCEPTION 'Enlace inválido o reservado. Usá letras minúsculas, números y guiones (hasta 120 caracteres).'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_events_slug BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.equidate_assign_event_slug();

-- Stable allocation for existing events; preserve their original modification dates.
ALTER TABLE public.events DISABLE TRIGGER tr_events_updated_at;
DO $$
DECLARE entry record;
BEGIN
  FOR entry IN SELECT id FROM public.events ORDER BY start_date, created_at, id LOOP
    UPDATE public.events SET slug = NULL WHERE id = entry.id;
  END LOOP;
END;
$$;
ALTER TABLE public.events ENABLE TRIGGER tr_events_updated_at;

ALTER TABLE public.events ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.events ADD CONSTRAINT events_slug_valid CHECK (public.equidate_valid_event_slug(slug));
ALTER TABLE public.events ADD CONSTRAINT events_slug_key UNIQUE (slug);
COMMENT ON COLUMN public.events.slug IS 'Permanent unique public URL. Auto-generated on insert; immutable after allocation.';
COMMIT;
