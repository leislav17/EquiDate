SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('events', 'documents', 'document_pages', 'competition_days', 'competition_classes')
ORDER BY table_name, ordinal_position;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('events', 'documents', 'document_pages', 'competition_days', 'competition_classes'))
OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT namespace.nspname AS schema_name, routine.proname, routine.prosecdef AS security_definer,
  pg_get_function_identity_arguments(routine.oid) AS arguments
FROM pg_proc routine JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
WHERE namespace.nspname = 'public'
ORDER BY routine.proname;

SELECT id, name, public FROM storage.buckets WHERE id = 'event-documents';
SELECT count(*) AS events_count FROM public.events;
SELECT count(*) AS documents_count FROM public.documents;
SELECT count(*) AS document_pages_count FROM public.document_pages;
