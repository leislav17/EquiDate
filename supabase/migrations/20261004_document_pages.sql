-- ==============================================================================
-- MIGRACIÓN: TABLA DOCUMENT_PAGES PARA DOCUMENTOS MULTIPÁGINA
-- ==============================================================================

-- 1. Permitir que storage_path en documents sea opcional (cuando las páginas están en document_pages)
ALTER TABLE public.documents ALTER COLUMN storage_path DROP NOT NULL;

-- 2. Crear tabla document_pages
CREATE TABLE IF NOT EXISTS public.document_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON public.document_pages (document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_sort_order ON public.document_pages (sort_order);

-- 4. Row Level Security (RLS)
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

-- Lectura pública: permite leer páginas si el concurso está publicado
CREATE POLICY "Public Read Published Document Pages"
  ON public.document_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      JOIN public.events ON public.events.id = public.documents.event_id
      WHERE public.documents.id = public.document_pages.document_id
      AND public.events.status = 'published'
    )
  );

-- Administradores autenticados: acceso total
CREATE POLICY "Admin Full Select Document Pages"
  ON public.document_pages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin Insert Document Pages"
  ON public.document_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin Update Document Pages"
  ON public.document_pages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin Delete Document Pages"
  ON public.document_pages
  FOR DELETE
  TO authenticated
  USING (true);
