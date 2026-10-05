BEGIN;

CREATE TABLE public.competition_arenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  is_primary boolean NOT NULL DEFAULT false,
  UNIQUE (id, event_id)
);
CREATE UNIQUE INDEX competition_arenas_primary ON public.competition_arenas(event_id) WHERE is_primary;
CREATE UNIQUE INDEX competition_arenas_name ON public.competition_arenas(event_id, lower(trim(name)));

INSERT INTO public.competition_arenas(event_id, name, is_primary)
SELECT id, 'Pista principal', true FROM public.events;

ALTER TABLE public.competition_classes ADD COLUMN arena_id uuid;
UPDATE public.competition_classes AS entry SET arena_id = arena.id
FROM public.competition_arenas AS arena WHERE arena.event_id = entry.event_id AND arena.is_primary;
ALTER TABLE public.competition_classes ALTER COLUMN arena_id SET NOT NULL;
ALTER TABLE public.competition_classes ADD CONSTRAINT competition_classes_arena_fk
  FOREIGN KEY (arena_id, event_id) REFERENCES public.competition_arenas(id, event_id) ON DELETE NO ACTION;
CREATE INDEX competition_classes_arena_idx ON public.competition_classes(arena_id, event_date, start_time);

ALTER TABLE public.competition_days ADD CONSTRAINT competition_days_id_event_unique UNIQUE(id, event_id);

CREATE TABLE public.competition_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  day_id uuid NOT NULL,
  arena_id uuid NOT NULL,
  youtube_url text,
  FOREIGN KEY (day_id, event_id) REFERENCES public.competition_days(id, event_id) ON DELETE CASCADE,
  FOREIGN KEY (arena_id, event_id) REFERENCES public.competition_arenas(id, event_id) ON DELETE NO ACTION,
  UNIQUE(day_id, arena_id),
  CHECK (youtube_url IS NULL OR youtube_url ~ '^https?://(www\.|m\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)/')
);
CREATE INDEX competition_streams_arena_idx ON public.competition_streams(arena_id);
CREATE INDEX competition_streams_event_idx ON public.competition_streams(event_id);

INSERT INTO public.competition_streams(event_id, day_id, arena_id, youtube_url)
SELECT day.event_id, day.id, arena.id, day.youtube_url
FROM public.competition_days day JOIN public.competition_arenas arena ON arena.event_id = day.event_id AND arena.is_primary
WHERE nullif(trim(day.youtube_url), '') IS NOT NULL;

ALTER TABLE public.competition_arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_streams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_arenas, public.competition_streams FROM anon, authenticated;
GRANT SELECT ON public.competition_arenas, public.competition_streams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_arenas, public.competition_streams TO authenticated;

CREATE POLICY equidate_arenas_read ON public.competition_arenas FOR SELECT TO anon, authenticated
USING (public.equidate_is_admin() OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published'));
CREATE POLICY equidate_arenas_admin ON public.competition_arenas FOR ALL TO authenticated
USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());
CREATE POLICY equidate_streams_read ON public.competition_streams FOR SELECT TO anon, authenticated
USING (public.equidate_is_admin() OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published'));
CREATE POLICY equidate_streams_admin ON public.competition_streams FOR ALL TO authenticated
USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());

CREATE FUNCTION public.equidate_create_primary_arena()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.competition_arenas(event_id, name, is_primary) VALUES (NEW.id, 'Pista principal', true);
  RETURN NEW;
END;
$$;
CREATE TRIGGER equidate_create_primary_arena AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.equidate_create_primary_arena();

CREATE FUNCTION public.equidate_guard_primary_arena()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF OLD.is_primary AND EXISTS (SELECT 1 FROM public.events WHERE id = OLD.event_id) THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'La pista principal no se puede eliminar.'; END IF;
    IF NOT NEW.is_primary OR NEW.event_id <> OLD.event_id THEN
      RAISE EXCEPTION 'La pista principal debe permanecer en su concurso.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER equidate_guard_primary_arena BEFORE UPDATE OR DELETE ON public.competition_arenas
FOR EACH ROW EXECUTE FUNCTION public.equidate_guard_primary_arena();

CREATE FUNCTION public.equidate_default_class_arena()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NEW.arena_id IS NULL THEN
    SELECT id INTO NEW.arena_id FROM public.competition_arenas WHERE event_id = NEW.event_id AND is_primary;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER equidate_default_class_arena BEFORE INSERT ON public.competition_classes
FOR EACH ROW EXECUTE FUNCTION public.equidate_default_class_arena();

CREATE FUNCTION public.equidate_sync_legacy_stream()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE primary_arena uuid;
BEGIN
  SELECT id INTO primary_arena FROM public.competition_arenas WHERE event_id = NEW.event_id AND is_primary;
  IF primary_arena IS NOT NULL THEN
    IF nullif(trim(NEW.youtube_url), '') IS NOT NULL OR TG_OP = 'UPDATE' THEN
      INSERT INTO public.competition_streams(event_id, day_id, arena_id, youtube_url)
      VALUES (NEW.event_id, NEW.id, primary_arena, nullif(trim(NEW.youtube_url), ''))
      ON CONFLICT (day_id, arena_id) DO UPDATE SET youtube_url = EXCLUDED.youtube_url;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER equidate_sync_legacy_stream AFTER INSERT OR UPDATE OF youtube_url ON public.competition_days
FOR EACH ROW EXECUTE FUNCTION public.equidate_sync_legacy_stream();

CREATE FUNCTION public.equidate_save_stream(target_day uuid, target_arena uuid, video_url text, zone text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE target_event uuid;
BEGIN
  IF NOT public.equidate_is_admin() THEN RAISE EXCEPTION 'Permisos de administrador requeridos.' USING ERRCODE = '42501'; END IF;
  SELECT event_id INTO STRICT target_event FROM public.competition_days WHERE id = target_day FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.competition_arenas WHERE id = target_arena AND event_id = target_event) THEN
    RAISE EXCEPTION 'La pista no pertenece al concurso.';
  END IF;
  UPDATE public.competition_days SET time_zone = zone WHERE id = target_day;
  IF EXISTS (SELECT 1 FROM public.competition_arenas WHERE id = target_arena AND is_primary) THEN
    UPDATE public.competition_days SET youtube_url = nullif(trim(video_url), '') WHERE id = target_day;
  END IF;
  IF nullif(trim(video_url), '') IS NULL THEN
    DELETE FROM public.competition_streams WHERE day_id = target_day AND arena_id = target_arena;
    RETURN;
  END IF;
  INSERT INTO public.competition_streams(event_id, day_id, arena_id, youtube_url)
  VALUES (target_event, target_day, target_arena, nullif(trim(video_url), ''))
  ON CONFLICT (day_id, arena_id) DO UPDATE SET youtube_url = EXCLUDED.youtube_url;
END;
$$;
REVOKE ALL ON FUNCTION public.equidate_save_stream(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equidate_save_stream(uuid, uuid, text, text) TO authenticated;

CREATE FUNCTION public.equidate_document_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE entry public.competition_classes;
BEGIN
  IF NEW.type = 'PROGRAM' THEN
    NEW.class_id := NULL;
    NEW.event_date := NULL;
    NEW.name := 'Anteprograma';
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
CREATE TRIGGER equidate_document_assignment BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.equidate_document_assignment();

COMMIT;
