BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hide_global_sponsors boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  subtitle text CHECK (subtitle IS NULL OR length(btrim(subtitle)) <= 120),
  image_url text NOT NULL CHECK (
    image_url ~ '^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$'
    AND image_url !~ '^https?://[^/]*@'
  ),
  mobile_image_url text CHECK (
    mobile_image_url IS NULL OR (
      mobile_image_url ~ '^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$'
      AND mobile_image_url !~ '^https?://[^/]*@'
    )
  ),
  target_url text CHECK (
    target_url IS NULL OR (
      target_url ~ '^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$'
      AND target_url !~ '^https?://[^/]*@'
    )
  ),
  scope text NOT NULL CHECK (scope IN ('global', 'event')),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  placement text NOT NULL CHECK (placement IN ('home', 'listings_footer', 'all', 'event_detail')),
  variant text NOT NULL DEFAULT 'logo_card' CHECK (variant IN ('logo_card', 'banner')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at date,
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsors_scope_placement_check CHECK (
    (scope = 'global' AND event_id IS NULL AND placement IN ('home', 'listings_footer', 'all'))
    OR (scope = 'event' AND event_id IS NOT NULL AND placement = 'event_detail')
  ),
  CONSTRAINT sponsors_date_range_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

CREATE INDEX IF NOT EXISTS sponsors_scope_order_idx
  ON public.sponsors (scope, event_id, sort_order, id);

CREATE SCHEMA IF NOT EXISTS equidate_private;
REVOKE ALL ON SCHEMA equidate_private FROM PUBLIC;

CREATE OR REPLACE FUNCTION equidate_private.touch_sponsor_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION equidate_private.touch_sponsor_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS equidate_touch_sponsor_updated_at ON public.sponsors;
CREATE TRIGGER equidate_touch_sponsor_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW
  EXECUTE FUNCTION equidate_private.touch_sponsor_updated_at();

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sponsors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;

DROP POLICY IF EXISTS sponsors_read ON public.sponsors;
CREATE POLICY sponsors_read
  ON public.sponsors
  FOR SELECT
  TO anon, authenticated
  USING (
    public.equidate_is_admin()
    OR (
      active = true
      AND (
        scope = 'global'
        OR EXISTS (
          SELECT 1
          FROM public.events e
          WHERE e.id = sponsors.event_id
            AND e.status = 'published'
        )
      )
    )
  );

DROP POLICY IF EXISTS sponsors_write ON public.sponsors;
CREATE POLICY sponsors_write
  ON public.sponsors
  FOR ALL
  TO authenticated
  USING (public.equidate_is_admin())
  WITH CHECK (public.equidate_is_admin());

COMMIT;
