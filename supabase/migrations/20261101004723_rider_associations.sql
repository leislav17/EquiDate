BEGIN;
-- Corrections reference immutable source rows. Reimports require review, never inherit stale corrections.
CREATE TABLE public.rider_associations (
  source text PRIMARY KEY CHECK (source ~ '^(start|result):[0-9a-f-]{36}:[1-9][0-9]*$'),
  identity uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500)
);
ALTER TABLE public.rider_associations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rider_associations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rider_associations TO authenticated;
CREATE POLICY rider_associations_read ON public.rider_associations FOR SELECT TO anon, authenticated USING (
 public.equidate_is_admin() OR
 EXISTS (SELECT 1 FROM public.start_lists h JOIN public.start_list_versions v ON v.id=h.version_id
 JOIN public.competition_classes c ON c.id=h.class_id JOIN public.events e ON e.id=c.event_id,
 LATERAL jsonb_array_elements(v.entries) r
 WHERE e.status='published' AND source='start:'||v.id::text||':'||(r->>'position')) OR
 EXISTS (SELECT 1 FROM public.result_lists h JOIN public.result_list_versions v ON v.id=h.version_id
 JOIN public.competition_classes c ON c.id=h.class_id JOIN public.events e ON e.id=c.event_id,
 LATERAL jsonb_array_elements(v.entries) r
 WHERE e.status='published' AND source='result:'||v.id::text||':'||(r->>'position'))
);
CREATE POLICY rider_associations_insert ON public.rider_associations FOR INSERT TO authenticated WITH CHECK (public.equidate_is_admin());
CREATE POLICY rider_associations_update ON public.rider_associations FOR UPDATE TO authenticated USING (public.equidate_is_admin()) WITH CHECK (public.equidate_is_admin());
CREATE POLICY rider_associations_delete ON public.rider_associations FOR DELETE TO authenticated USING (public.equidate_is_admin());
COMMIT;
