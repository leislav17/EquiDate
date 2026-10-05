# EquiDate

Calendario mobile-first de concursos hípicos con Supabase como fuente de verdad.
Incluye anteprogramas, pruebas por jornada, listados, resultados y transmisiones de YouTube.

## Desarrollo

Requiere Node 24.

```sh
npm ci
npm run dev
```

Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` o Netlify.
Sin configuración o ante errores se muestra un estado explícito; no se cargan datos de muestra ni se habilita administración local.
No se leen ni escriben concursos/documentos en localStorage. Supabase Auth conserva su almacenamiento de sesión habitual.

## Base de datos y actualización

Para una base existente, seguir [la guía de actualización](docs/ACTUALIZACION_SUPABASE.md).
No volver a ejecutar `schema.sql` sobre una base existente.

Para una instalación vacía: ejecutar `supabase/schema.sql` y después `supabase/migrations/20261005_competition_schedule.sql`.
El esquema base ya incluye `document_pages`; no repetir la migración antigua de páginas.
Crear una cuenta en Supabase Auth y habilitar `equidate_admin` en app_metadata según la guía antes de iniciar sesión.

## Validación

```sh
npm test
npm run lint
npm run build
```

La instalación reproducible usa `package-lock.json`.
Los tests SQL se ejecutan en PostgreSQL embebido y no necesitan credenciales ni acceden al proyecto real.

## Netlify

Build: `npm run build`. Carpeta publicada: `dist`. Node: 24.
Definir las dos variables públicas de Supabase antes de compilar; nunca usar service_role en el frontend.
Aplicar primero la migración y configurar el permiso de la administradora.
La aplicación usa rutas hash para documentos y transmisiones y conserva el branding EquiDate.
