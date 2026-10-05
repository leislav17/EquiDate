# EquiDate: actualización de jornadas, pruebas y permisos

## Estado y orden de despliegue

Esta entrega no ejecuta SQL contra Supabase ni modifica sus datos reales.
La migración nueva se probó contra PostgreSQL embebido (PGlite) con tablas y políticas del repositorio.
No se verificó el esquema ni las políticas del proyecto remoto; antes de aplicar, compararlos con el preflight.

1. Revisar y respaldar el proyecto de Supabase.
2. Ejecutar solamente `supabase/preflight.sql` para inspeccionar tablas, políticas, funciones expuestas y Storage. Es de solo lectura.
3. Confirmar que existen `events`, `documents` y `document_pages`. Si falta alguna, detenerse: no volver a ejecutar `schema.sql` sobre una base existente. Revisar la migración anterior de páginas con su estado real.
4. Otorgar el permiso de administrador a la cuenta correcta usando el SQL siguiente. Es una modificación de permisos que debe realizar la propietaria en SQL Editor; no se ejecuta automáticamente.
5. Ejecutar una sola vez `supabase/migrations/20261005_competition_schedule.sql`, completa. Usa una transacción: cualquier error revierte esa aplicación. Si informa objetos ya existentes, detenerse y revisar; no borrar tablas ni políticas para forzarla.
6. Volver a iniciar sesión y verificar acceso administrativo. Después desplegar esta versión de la aplicación con Node 24, `npm ci` y `npm run build`.
7. Comprobar con una sesión sin autenticar que solo aparecen concursos publicados; con una cuenta normal que no puede editar; con la administradora que puede guardar jornadas y pruebas.

### Habilitar una administradora

Reemplazar el correo por el de la cuenta existente. Verificar primero que el SELECT devuelve exactamente la usuaria deseada. No usar `user_metadata`: una usuaria puede modificarlo.

```sql
select id, email, raw_app_meta_data
from auth.users
where email = 'REEMPLAZAR_POR_CORREO_ADMINISTRADORA';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"equidate_admin":true}'::jsonb
where email = 'REEMPLAZAR_POR_CORREO_ADMINISTRADORA'
returning id, email;
```

Cerrar sesión y volver a entrar para emitir un JWT con el permiso nuevo.
Para revocarlo, quitar esa clave del metadata y revocar las sesiones de esa cuenta.
Nunca poner una clave service_role en variables VITE ni en GitHub.

## Qué cambia en la base

- Agrega `competition_days`: concurso, fecha, URL YouTube opcional y zona horaria. Una jornada por concurso/fecha. La URL se puede repetir.
- Agrega `competition_classes`: jornada, horario opcional, número, nombre, descripción y orden. El horario ordena primero; los horarios pendientes aparecen al final.
- Agrega `documents.class_id`, nullable. No asigna pruebas automáticamente ni modifica documentos o páginas existentes.
- Una clave compuesta evita asociar documentos a pruebas de otro concurso o fecha. Los anteprogramas no se asocian a pruebas.
- No elimina pruebas con documentos vinculados. Primero desvincularlos; sus archivos y registros se conservan.
- Impide que una edición de fechas del concurso deje jornadas guardadas fuera del intervalo.
- Agrega políticas restrictivas sobre las tablas actuales y Storage. Mantiene las políticas existentes, pero sus permisos amplios quedan limitados por el requisito `app_metadata.equidate_admin = true`.
- Agrega funciones de guardado y reordenamiento transaccional de documentos. Al editar solo metadata se conservan las páginas. Una sustitución explícita de páginas se realiza en una transacción; un error conserva las páginas previas.
- Los archivos se cargan con rutas nuevas y sin sobrescritura. No se borran automáticamente archivos de Storage al editar o eliminar registros. Una carga interrumpida puede dejar un archivo huérfano; su limpieza requiere una revisión independiente.
- No contiene un reinicio ni carga de datos de muestra. El único DELETE de páginas pertenece a la función de sustitución explícita y no se ejecuta al aplicar la migración.

## Revisión de RLS y límites

El esquema anterior llamaba “Admin” a políticas que permitían escribir a cualquier cuenta autenticada.
La nueva UI y RLS exigen el permiso explícito de administrador. Las lecturas públicas exigen un concurso publicado.
Las políticas restrictivas se aplican también aunque existan políticas permisivas adicionales. Revisar funciones SECURITY DEFINER y vistas del proyecto remoto: no se puede garantizar su seguridad mirando solo este repositorio.
Las funciones nuevas usan SECURITY INVOKER, un search_path vacío y permisos de ejecución limitados.

El bucket `event-documents` existente es público. Se conserva esa configuración: quien tenga la URL de un archivo puede descargarlo, incluso si su concurso pasa a borrador. RLS protege los registros, no las URLs públicas. Convertirlo en privado y cambiar a URLs firmadas requiere otro cambio coordinado; no se ejecutó.

## Uso en Administración

- “Pruebas y transmisión” → seleccionar día → guardar URL opcional y zona horaria → agregar/editar pruebas.
- Se puede pegar el mismo enlace en varios días; todas las pruebas de una jornada comparten ese reproductor.
- Asignar cada listado/resultado a su prueba desde ese panel o al cargarlo. Los documentos anteriores sin prueba permanecen como “Documentos de la jornada”; los generales o fuera del rango se mantienen visibles por separado.
- VER EN VIVO aparece en la fecha de la jornada según su zona horaria, VER TRANSMISIÓN después y VER PRÓXIMA TRANSMISIÓN antes. Es una etiqueta por fecha, no una verificación de que YouTube esté emitiendo.
- La página `#transmission/<id>` es compartible y recargable, conserva header/footer y muestra el reproductor 16:9 con el cronograma debajo.
- YouTube puede restringir la reproducción embebida; se ofrece un enlace alternativo sin abandonar automáticamente EquiDate.

## Verificación local

```sh
npm ci
npm test
npm run lint
npm run build
```

Node 24 requerido para los tests TypeScript nativos.
Pruebas de base: preservación de registros, lectura pública, denegación a cuentas normales, permisos de administrador, consistencia concurso/fecha/prueba y rollback de sustituciones fallidas.
Pruebas de funciones: formatos de URL y rechazo de dominios falsos, cambio de fecha por zona horaria y orden de pruebas.
La inspección visual local usa respuestas ficticias de la API, sin tocar Supabase.
