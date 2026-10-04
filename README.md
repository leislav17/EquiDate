# Salto Ecuestre — Plataforma de Concursos de Salto

Plataforma centralizada y mobile-first para consultar concursos de salto ecuestre, anteprogramas oficiales, órdenes de ingreso y resultados integrados con backend en **Supabase** y preparada para desplegar en **Netlify**.

---

## 1. Configuración de Supabase

### Paso A: Crear Proyecto en Supabase
1. Ingresá a [supabase.com](https://supabase.com) y creá un nuevo proyecto.
2. Anotá la **Project URL** y la **Anon / Public Key** (disponibles en *Project Settings* → *API*).

### Paso B: Ejecutar el Esquema SQL
1. En el panel de Supabase, andá a **SQL Editor**.
2. Si es una instalación nueva, ejecutá el archivo completo `supabase/schema.sql`.
3. Si ya tenías las tablas `events` y `documents` creadas, ejecutá el script de migración `supabase/migrations/20261004_document_pages.sql`.
4. Esto creará:
   - Tabla `public.events` (concursos)
   - Tabla `public.documents` (documentos principales)
   - Tabla `public.document_pages` (páginas de documentos multipágina con `CASCADE DELETE`)
   - Bucket de almacenamiento `event-documents` (público)
   - Reglas de seguridad **Row Level Security (RLS)** para lectura pública de publicados y edición exclusiva por administradores autenticados.

### Paso C: Crear Usuario Administrador
1. En Supabase, andá a **Authentication** → **Users**.
2. Hacé clic en **Add User** → **Create User**.
3. Ingresá el correo electrónico y la contraseña del administrador.
4. Con estas credenciales podrás iniciar sesión en la pantalla de **Administración** de la aplicación.

---

## 2. Variables de Entorno

Creá un archivo `.env` en la raíz de tu proyecto local con:

```bash
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu-anon-public-key"
```

---

## 3. Despliegue en Netlify

1. Creá un nuevo sitio en [Netlify](https://app.netlify.com) conectando tu repositorio de Git.
2. Configuraciones de Build (detectadas automáticamente vía `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. En **Site configuration** → **Environment variables**, agregá:
   - `VITE_SUPABASE_URL`: La URL de tu proyecto en Supabase.
   - `VITE_SUPABASE_ANON_KEY`: La clave anónima pública de tu proyecto en Supabase.
4. Hacé clic en **Deploy Site**.

---

## 4. Carga Inicial de Datos (Seed Demo)

Cuando ingreses al panel de **Administración** con tu usuario administrador autenticado, dispondrás de un botón **"Sincronizar Datos Demo a Supabase"**. Al pulsarlo se cargarán automáticamente los concursos y documentos iniciales de octubre 2026 directamente en tu base de datos y Storage de Supabase.
