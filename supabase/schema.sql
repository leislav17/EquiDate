-- ==============================================================================
-- SCHEMA SUPABASE: SALTO ECUESTRE (PostgreSQL, Storage, Auth y RLS)
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: EVENTS (Concursos)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para búsqueda rápida por fechas y estado
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events (start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events (status);

-- 3. TABLA: DOCUMENTS (Documentos de concursos)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PROGRAM', 'START_LIST', 'RESULT')),
  event_date DATE,
  storage_path TEXT,
  mime_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para documentos por concurso y fecha
CREATE INDEX IF NOT EXISTS idx_documents_event_id ON public.documents (event_id);
CREATE INDEX IF NOT EXISTS idx_documents_event_date ON public.documents (event_date);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents (type);

-- 3.1. TABLA: DOCUMENT_PAGES (Páginas de documentos multipágina)
CREATE TABLE IF NOT EXISTS public.document_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON public.document_pages (document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_sort_order ON public.document_pages (sort_order);

-- 4. TRIGGER PARA UPDATED_AT AUTOMÁTICO
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_events_updated_at ON public.events;
CREATE TRIGGER tr_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_documents_updated_at ON public.documents;
CREATE TRIGGER tr_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: EVENTS
-- Lectura pública: cualquiera puede leer concursos publicados
CREATE POLICY "Public Read Published Events"
  ON public.events
  FOR SELECT
  USING (status = 'published');

-- Los administradores autenticados pueden ver TODOS los concursos (publicados y borradores)
CREATE POLICY "Admin Full Select Events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

-- Administradores pueden insertar, actualizar y eliminar concursos
CREATE POLICY "Admin Insert Events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin Update Events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin Delete Events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (true);

-- POLÍTICAS: DOCUMENTS
-- Lectura pública: cualquiera puede leer documentos de concursos que estén publicados
CREATE POLICY "Public Read Published Documents"
  ON public.documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE public.events.id = public.documents.event_id
      AND public.events.status = 'published'
    )
  );

-- Los administradores autenticados pueden ver todos los documentos
CREATE POLICY "Admin Full Select Documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (true);

-- Administradores pueden insertar, actualizar y eliminar documentos
CREATE POLICY "Admin Insert Documents"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin Update Documents"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin Delete Documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (true);

-- POLÍTICAS: DOCUMENT_PAGES
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

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

-- 6. CONFIGURACIÓN DEL BUCKET DE STORAGE: 'event-documents'
-- Inserta el bucket en caso de que no exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- POLÍTICAS DE STORAGE: 'event-documents'
-- Lectura pública de archivos en el bucket
CREATE POLICY "Public Access Storage"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'event-documents');

-- Subida y modificación de archivos solo para administradores autenticados
CREATE POLICY "Admin Upload Storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-documents');

CREATE POLICY "Admin Update Storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-documents');

CREATE POLICY "Admin Delete Storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-documents');
