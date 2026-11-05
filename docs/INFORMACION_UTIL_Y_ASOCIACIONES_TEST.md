# Información útil y asociaciones — revisión en TEST

Implementación sobre `main` 99448f5278518cf05d45855539d9c6780f607088, en la rama `feat/useful-info-rider-history`.

## Entorno y despliegue

- Las dos migraciones de esta rama están aplicadas únicamente en Supabase TEST (`slophgtrynlfesjonbzf`). No aplicar otra vez en TEST ni ejecutar contra PROD.
- No se modificó Supabase PROD ni la rama `production`.
- `netlify.toml` conserva el contexto `main` en TEST y agrega un contexto explícito TEST para esta rama, con la clave pública del cliente. El guard de compilación rechaza otra URL para ambas ramas.
- El commit y el título del PR incluyen `[skip netlify]`: no se genera un despliegue automático. No eliminar esa marca hasta verificar en Netlify la rama publicada y los contextos/variables de la vista previa.
- La configuración interna de Netlify no pudo revisarse porque requiere iniciar sesión. La vista previa publicada queda pendiente de ese acceso; no hay un nuevo enlace TEST desplegado.

## Revisar localmente con Supabase TEST

1. Clonar el repositorio y cambiar a `feat/useful-info-rider-history`.
2. Ejecutar `npm ci`.
3. Crear `.env.local` con `VITE_SUPABASE_URL=https://slophgtrynlfesjonbzf.supabase.co` y `VITE_SUPABASE_ANON_KEY` igual a la clave pública del contexto de esta rama en `netlify.toml`.
4. Ejecutar `npm run dev`. Si el entorno impide enumerar interfaces de red, usar `npx vite --host 127.0.0.1 --port 3000`.
5. Abrir la dirección local y recorrer los casos siguientes.

## Recorrido funcional

- Menú sin sesión: Inicio, Buscar jinetes e Información útil. Sin accesos administrativos en Inicio.
- `/informacion-util`: tres tarjetas, solamente título e ícono. Cada tarjeta abre el enlace en otra pestaña.
- `/admin` sin sesión: login independiente del menú. Una cuenta TEST autorizada por `equidate_admin=true` o `role=superadmin` en **app_metadata** ingresa al panel. La UI verifica el permiso mediante RPC y la base aplica RLS.
- Menú con cuenta administradora: Panel de administración, Asociaciones de jinetes y Cerrar sesión.
- Panel → Información útil (`/admin/informacion-util`): crear, editar título/URL/orden, ocultar/publicar y eliminar con confirmación. Una URL pendiente solamente puede guardarse como tarjeta oculta.
- `/admin/jinetes`: buscar o elegir una sugerencia, seleccionar los grupos, elegir un nombre existente o escribir uno corregido, indicar motivo, revisar vista previa y confirmar. La selección incluye el grupo completo.
- Historial: revisar fecha, responsable, motivo y registros; revertir. Una reversión que pisaría cambios posteriores se rechaza: deshacer primero los cambios posteriores. El historial comienza con esta actualización; no se inventan auditorías previas.
- Buscar por nombres originales, nombre elegido y nombres corregidos anteriores: deben conducir al mismo jinete. Órdenes/resultados se emparejan solamente si hay una coincidencia inequívoca de identidad, prueba y caballo; actuaciones ambiguas se conservan separadas.

## Recursos iniciales verificados el 1/11/2026 (Argentina)

- FEA: https://fedecuarg.com.ar/
- Fomento Equino: https://www.fomentoequino.net/
- Aranceles: https://drive.google.com/file/d/1b5Tscb40dsuS5aVsB4HLYTq-7W_EY_yW/view
- Fuente del PDF: https://fedecuarg.com.ar/administracion/ y su listado de circulares administrativas. Descarga pública verificada: PDF de seis páginas, Circular 45/2026, de fecha 15/8/2026, vigente desde el 17/8/2026. Es el documento que la sección oficial de aranceles enlaza actualmente.

## Verificación

- `npm run lint`, `npm test` (81 pruebas) y `npm run build` pasan.
- Pruebas PostgreSQL locales: lectura pública de publicados, CRUD admin/superadmin, rechazo de usuarios comunes y metadatos de usuario falsificados, validación de URL, historial inmutable para clientes, merge atómico, vista previa desactualizada, reversión y conservación de originales.
- API real TEST: tres tarjetas públicas, permiso admin falso sin sesión, escritura pública rechazada por RLS, historial privado rechazado, merge público rechazado.
- SQL transaccional real TEST: rol autenticado con claim superadmin puede crear un recurso; la transacción se revierte al finalizar y no deja datos de prueba.
- Asesor de seguridad TEST: sin hallazgos nuevos en tablas/funciones de esta implementación. Reporta configuración preexistente de protección de contraseñas filtradas desactivada y una tabla de respaldo con RLS sin políticas.
- Pendiente: recorrido visual completo, login real con una cuenta TEST y publicación de vista previa tras acceder a Netlify. Las pruebas por rol no equivalen a una sesión de usuario real en navegador.
