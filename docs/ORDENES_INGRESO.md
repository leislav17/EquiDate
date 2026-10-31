# Órdenes de ingreso estructurados

## Entornos y publicación

Confirmado por la propietaria el 31/10/2026: `main` es TEST; `production` publica producción. Trabajar directamente en main, sin PR. No fusionar ni subir cambios a production sin autorización explícita. Supabase TEST: `slophgtrynlfesjonbzf`; PROD: `jfeyddnaiwlcmwykkwwe`.

Antes de cada push comprobar que el destino sigue siendo main y que Netlify mantiene production como rama de producción. El build de main falla si `VITE_SUPABASE_URL` no apunta exactamente a TEST; la clave pública debe pertenecer al mismo proyecto. El archivo netlify.toml no configura la rama de producción: esa elección vive en Netlify. No cambiarla para esta funcionalidad. El build local no publica nada.

La migración incremental de órdenes de ingreso agrega tablas y funciones; no ejecutar schema.sql sobre una base existente. Aplicarla primero en TEST. Producción requiere aprobación y aplicación independiente antes de desplegar la interfaz. Sin la migración, los documentos anteriores continúan disponibles y el importador muestra un error explícito.

## Modelo y permisos

Los caballos y clubes ausentes en el PDF se muestran en blanco, sin nombres de reemplazo. La migración `20261031170402_optional_start_list_horse.sql` permite `horse: ""`; el jinete sigue siendo obligatorio. La detección de binomios repetidos se aplica cuando el caballo está identificado; dos filas sin caballo no se consideran automáticamente el mismo binomio. Los números de orden siempre deben ser únicos.

`start_list_versions` conserva versiones completas inmutables con filas JSON, fuente y fecha. Cada fila contiene `position` (entero positivo único, admite saltos), `horse`, `rider` y `club` opcional. El orden visible depende del número, nunca del nombre ni del orden de extracción. Se rechaza el mismo binomio duplicado tras normalizar espacios y mayúsculas; un jinete con distintos caballos sí es válido. Si un binomio realmente participa dos veces, revisar el documento y adaptar explícitamente la regla antes de importar; no inventar nombres distintos.

`start_lists` apunta a la versión publicada de cada prueba; `version_id = null` significa retirada. Una versión con `entries = []` sigue siendo una publicación válida con cero participantes. Las versiones históricas solo las lee un administrador; el público solo lee las versiones actualmente publicadas de concursos publicados. RLS usa exclusivamente `app_metadata.equidate_admin`; los usuarios normales y anónimos no escriben. Las funciones son SECURITY INVOKER, tienen search_path vacío y permisos EXECUTE explícitos.

`equidate_import_start_lists(batch)` valida el lote y lo publica como una transacción. Cada prueba debe coincidir por UUID, concurso, fecha, pista y número. `expectedRevision` evita reemplazar una corrección ajena. El UUID `id` identifica una importación y hace seguros los reintentos inmediatos del mismo lote; una versión histórica no se puede republicar mediante un reintento viejo. Restaurar requiere un nuevo UUID y la revisión actual. No se actualizan ni eliminan PDFs, documentos ni versiones previas. El borrado de pruebas/concursos con versiones queda bloqueado por claves foráneas para preservar el historial.

## Flujo PDF → ChatGPT → revisión → TEST

1. En Administración → concurso → Órdenes de ingreso, descargar la plantilla de pruebas (incluye UUID, jornada, pista, número y revisión actual). Pasar a ChatGPT esa plantilla junto con los PDFs originales.
2. Usar `python scripts/extract-start-list.py origen.pdf extraido.json` para extraer texto por página y hash del archivo. Requiere `pypdf`. Es una lectura local, sin credenciales ni escrituras a Supabase. Una imagen de ejemplo nunca se trata como PDF ni como participantes reales.
3. ChatGPT revisa también las páginas renderizadas del PDF. Separa todas las pruebas del documento, excluye encabezados y repeticiones de página, conserva números de orden y transcribe jinete, caballo y club. No deduce club ni completa palabras ilegibles. Si no hay texto seleccionable se necesita OCR/transcripción visual y revisión; el script lo marca, no inventa filas.
4. Asociar por concurso, fecha, pista y número usando la plantilla. Si hay más de una coincidencia, pedir aclaración antes de escribir. Mostrar resumen por prueba, cantidad anterior/nueva, reemplazos, números omitidos y dudas con página de origen. Si hay dudas, mantener `reviewed: false` y `uncertainties` con la descripción; el importador rechaza esas pruebas.
5. Tras revisión y confirmación de la propietaria, producir un array JSON con solo las pruebas elegidas, `reviewed: true`, `uncertainties: []`, un UUID nuevo por versión, `sourceName` real y `expectedRevision` de la plantilla. Nunca resolver dudas borrándolas sin comprobar el PDF.
6. Pegar/cargar ese JSON en el importador. Revisar todas las filas de la vista previa, incluidos listados vacíos y reemplazos. Marcar confirmación y publicar el lote. El servidor vuelve a validar y, si cambió cualquier revisión, rechaza todo el lote; descargar una plantilla nueva y revisar de nuevo.
7. Para escribir desde ChatGPT mediante Supabase, usar la misma función con el lote revisado y el proyecto TEST explícito. No hacer INSERT por fila ni DELETE de listados. La herramienta SQL administrativa debe establecer transaccionalmente los claims de administración solo después de la confirmación y usar la misma función; no confundir su acceso privilegiado con autorización de producción. El frontend usa una sesión admin normal y nunca una service_role.

Ejemplo de una fila (datos ilustrativos, no un documento real):

```json
{"position": 1, "horse": "Relámpago", "rider": "Ana Pérez", "club": null}
```

Para correcciones, repetir el flujo con un UUID nuevo. Las versiones recientes se consultan desde Administración; “Preparar restauración” crea un lote nuevo que vuelve a pasar por revisión. “Retirar publicación” conserva todas las versiones y vuelve al documento anterior, si existe.

## Compatibilidad y contador

Listado estructurado publicado → vista EquiDate; si hay PDF START_LIST de esa prueba, aparece descarga. Sin listado estructurado → se mantienen los botones y el visor anteriores de documentos, incluyendo PDF e imágenes históricas. Sin listado ni documento → no hay botón Listado. Documentos sin prueba asignada siguen apareciendo en Documentos de la jornada; no se reasignan automáticamente.

El contador público usa `entries.length` del listado publicado (también cero). `competition_classes.participant_count` sigue siendo el valor manual, no se modifica al importar, corregir, retirar o restaurar. Al retirar el listado se vuelve a mostrar ese valor manual. Administración muestra ambos para evitar sobrescrituras inadvertidas.

## Verificación

`npm ci`, `npm test`, `npm run lint`, `npm run build`. Los tests nuevos ejercitan RLS real en PostgreSQL embebido, publicación vacía, asociación, duplicados, reintentos, reemplazos obsoletos, rollback de lotes, conservación histórica y el comportamiento del botón/contador. Validar además la vista pública en 320/375/768 px y escritorio, búsqueda, descarga y navegación atrás.
