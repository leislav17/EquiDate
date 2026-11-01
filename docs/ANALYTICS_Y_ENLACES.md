# Analytics y enlaces por concurso

## Entornos

La rama de trabajo `main` se despliega a TEST en https://main--equidatecal.netlify.app.
Netlify protege ese despliegue con inicio de sesión. Producción usa la rama separada
`production`. No integrar estos cambios en esa rama ni aplicar la migración en PROD
sin autorización. El contexto `main` fija la URL de Supabase TEST y el script de
compilación rechaza una URL distinta. La clave pública debe pertenecer también a TEST.

## Slugs

Aplicar `supabase/migrations/20261101000204_event_slugs.sql` antes del despliegue del
frontend en el entorno elegido. Agrega `events.slug`, una restricción única y una
validación de formato y palabras reservadas. No cambia RLS ni asociaciones. Conserva
las fechas de modificación originales de los concursos existentes.

El enlace se genera al crear un concurso, o se puede elegir en Información general
antes de guardarlo por primera vez. Es permanente: renombrar el concurso no lo cambia.
Los nombres repetidos reciben un sufijo (`san-diego-2`, etc.); la unicidad también se
aplica en la base de datos. Los borradores no se abren por sus enlaces públicos.

En TEST: `/san-diego`, `/sjv`, `/sjv-preliminar` y `/sjv-pasadas-preliminar` son concursos
distintos. El último corresponde a las pasadas preliminares del 11/11, y
`/sjv-preliminar` al concurso preliminar del 14/11.

Se conservan `#document-ID`, `#start-list/ID`, `#results/ID` y
`#transmission/JORNADA/PISTA`, incluso en la raíz, y el acceso a `/admin`.
Las pantallas internas usan `/SLUG/document/ID`, `/SLUG/start-list/ID`,
`/SLUG/results/ID` y `/SLUG/transmission/JORNADA/PISTA`. Los fragmentos antiguos se
normalizan a estas rutas después de cargar sus asociaciones. Esto permite que GA4
cuente el cambio de pantalla: la medición automática no contó los cambios de fragmento
solos en la verificación con el tag de esta propiedad.
`?event=UUID`, `/event/UUID`, `/events/UUID`, `/UUID` y `#event/UUID` se resuelven y
normalizan al slug mediante reemplazo del historial. En bases anteriores a la
migración, la lectura y navegación siguen usando `/event/UUID`.
Los enlaces que no existen muestran “Concurso no encontrado”.

Netlify ya tenía el fallback `/* → /index.html` con estado 200, que se conserva.
Esto permite abrir y actualizar rutas directamente sin errores del servidor.

## Google Analytics 4

Tag: `G-1XF2L5PCZH`. Se carga una sola vez por documento, después de resolver la
pantalla inicial. Se actualiza el título de cada pantalla y se incluye el parámetro
`environment=test` en TEST (producción queda preparada para una publicación futura).

La propiedad tiene activada la medición mejorada de cambios del historial, verificada
en el tag servido por Google. **Esa es la única fuente de pageviews**: el código no
envía eventos `page_view` manuales ni repite `config` al navegar. Mantener activada en
GA4 la opción “Cambios de página basados en eventos del historial del navegador”.
Si se cambia a medición manual en el futuro, desactivar primero esa opción para
evitar duplicados. Referencias oficiales:

- https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications
- https://developers.google.com/analytics/devguides/collection/ga4/views

La navegación de concursos y recursos usa History API, incluidos los enlaces `#`
internos. Se conservan abrir en otra pestaña, atrás y adelante. No se cuentan como
pantallas nuevas los acordeones, filtros del calendario, recargas de datos ni las
selecciones de listados incrustados dentro de una transmisión.

Los accesos a TEST aparecerán en la misma propiedad GA4; se distinguen por el hostname
`main--equidatecal.netlify.app`. Para ver `environment` como dimensión en los informes
se puede registrar una dimensión personalizada. No se agregó otro tag en `index.html`
ni Google Tag Manager para evitar dos instalaciones simultáneas.

## Verificación

`npm test`, `npm run lint` y compilación con variables de TEST. Las pruebas de la
migración comprueban datos preservados, colisiones, slugs reservados e inmutabilidad.
Para comprobar GA4 usar Tiempo real/DebugView y comparar una sola visita inicial y
una por transición entre concurso, listado, resultados y transmisión. Las pruebas de
navegador pueden interceptar `collect` para verificar los envíos sin contaminar GA4.
