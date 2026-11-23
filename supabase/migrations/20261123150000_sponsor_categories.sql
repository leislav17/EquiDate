BEGIN;

CREATE TABLE IF NOT EXISTS public.sponsor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sponsor_categories_name_unique_idx
  ON public.sponsor_categories (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS sponsor_categories_sort_idx
  ON public.sponsor_categories (sort_order, name, id);

DROP TRIGGER IF EXISTS equidate_touch_sponsor_category_updated_at ON public.sponsor_categories;
CREATE TRIGGER equidate_touch_sponsor_category_updated_at
  BEFORE UPDATE ON public.sponsor_categories
  FOR EACH ROW
  EXECUTE FUNCTION equidate_private.touch_sponsor_updated_at();

ALTER TABLE public.sponsor_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sponsor_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sponsor_categories TO authenticated;

DROP POLICY IF EXISTS sponsor_categories_read ON public.sponsor_categories;
CREATE POLICY sponsor_categories_read
  ON public.sponsor_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS sponsor_categories_write ON public.sponsor_categories;
CREATE POLICY sponsor_categories_write
  ON public.sponsor_categories
  FOR ALL
  TO authenticated
  USING (public.equidate_is_admin())
  WITH CHECK (public.equidate_is_admin());

INSERT INTO public.sponsor_categories (name, sort_order)
VALUES
  ('Fotos & videos', 10),
  ('Talabartería', 20),
  ('Haras', 30),
  ('Club', 40)
ON CONFLICT ((lower(btrim(name)))) DO NOTHING;

ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.sponsor_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sponsors_category_order_idx
  ON public.sponsors (category_id, sort_order, id);

COMMIT;
