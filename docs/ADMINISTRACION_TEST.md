# Reorganización del administrador — TEST

## Rutas y reutilización

- `/admin`: conserva el control de sesión y rol del `App` y muestra un dashboard compacto.
- `/admin/concursos`: lista administrativa, búsqueda, filtros y paginación existentes. Los filtros y scroll siguen en sessionStorage (`equidate_admin_filters_v2`).
- `/admin/concursos?event=<id>`: editor. `/admin?event=<id>` y enlaces antiguos de pestañas siguen siendo compatibles; `start-lists` y `results` abren Documentos.
- `/admin/concursos?event=new`: solo Información general. Se crea como borrador y, tras guardar, se abre el editor del ID real con las cinco secciones.
- `/admin/jinetes` y `/admin/informacion-util`: mantienen sus componentes y autorización.

El menú hamburguesa existente separa público y administración. El editor usa navegación vertical desde 1024px y un selector por debajo. Información importante conserva el editor enriquecido; Jornadas y pruebas y Transmisión conservan sus componentes y operaciones por jornada/pista.

## Documentos

`DocumentWorkspace` reúne filtros y paginación (12 registros por página). Muestra archivos existentes y cabeceras de datos estructurados, incluso retiradas de publicación con historial recuperable. No genera filas para pruebas vacías.

- `DocumentManagerModal` se reutiliza tanto para la lista de archivos como para la carga puntual: PDF, imágenes/páginas, orden, edición de asignación, visor y eliminación con confirmación.
- Se puede filtrar por tipo, jornada, prueba y texto. Cargar archivo permite elegir jornada y prueba. Los documentos históricos sin asignar siguen visibles sin filtros y se pueden reasignar con Editar datos.
- Reemplazar PDF usa `updateDocument`; no importa ni elimina los datos estructurados.
- Importar JSON abre `StartListManager` o `ResultsManager` en modo importación. Mantiene plantillas, validación de lote y revisiones, vista previa, confirmación y publicación existentes.
- Administrar un registro estructurado abre solo su prueba: datos publicados, PDF, versiones, restauración revisada y retiro de publicación. La restauración sigue creando una versión nueva.
- La validación de JSON sigue recibiendo todas las pruebas del concurso, independientemente de los filtros de la lista.
- PDF solamente / datos solamente / ambos / ninguno conservan la resolución pública existente. No se modificaron los componentes públicos, asociaciones, cálculos ni importadores de validación.

## Datos y permisos

No hay migraciones, cambios de políticas RLS ni modificaciones de datos Supabase incluidas. Se reutilizan los métodos del contexto que exigen administrador y las políticas vigentes. La creación ahora guarda explícitamente `draft`; la edición general no cambia la publicación. Publicar/despublicar se concentra en el encabezado y mantiene `toggleEventStatus`.

## Entorno y verificación

`netlify.toml` mantiene main apuntando al proyecto TEST `slophgtrynlfesjonbzf`. `scripts/check-build-environment.mjs` impide compilar main contra otro proyecto. La rama `production` no forma parte de este cambio.

Verificaciones locales ejecutadas:

- `npm run lint`.
- `npm test`: 91 pruebas, incluidas validaciones JSON, documentos, permisos RLS con Postgres local y nuevos casos del filtro de documentos.
- `BRANCH=main VITE_SUPABASE_URL=https://slophgtrynlfesjonbzf.supabase.co npm run build`.
- Renderizado React del App con datos de prueba locales: dashboard, listado, alta (sin navegación deshabilitada), cinco secciones, enlaces antiguos, archivos/historial, importación no permanente y concurso inexistente.

La inspección del sitio TEST devuelve protección de equipo de Netlify que requiere una cuenta invitada. No se consideran verificadas la interacción visual en móvil/escritorio ni las escrituras de extremo a extremo contra TEST. Tampoco se deben confundir las pruebas locales de permisos con una auditoría en vivo de Supabase.

## Revisión en TEST

URL: https://main--equidatecal.netlify.app/admin

Con una cuenta invitada a Netlify y un administrador autorizado de EquiDate:

1. Abrir `/admin` sin sesión de EquiDate y comprobar el login; ingresar y recorrer los tres accesos y el menú lateral.
2. En Gestionar concursos, aplicar filtros, editar un concurso y volver: deben conservarse búsqueda, filtros y página.
3. Crear un concurso temporal: antes de guardar solo debe aparecer Información general; después debe quedar en borrador con las cinco secciones. Editar, publicar y despublicar desde el encabezado.
4. En Documentos, probar filtros combinados y restablecer; comprobar archivos históricos sin asignar y pruebas sin archivos. Cargar, visualizar, reasignar, ordenar, reemplazar PDF y eliminar con confirmación usando archivos de prueba.
5. Importar lotes JSON revisados de órdenes y resultados, verificar errores, vista previa y reemplazos; revisar versiones y preparar restauración. Confirmar que los PDFs y asociaciones se conservan.
6. Revisar en móvil y escritorio el menú, selector/secciones, editor enriquecido, formularios, filtros, carga y JSON, sin desbordamiento horizontal de navegación.
7. Revisar el concurso público: orden y resultados estructurados, PDF solamente y datos con PDF; jornadas, pistas y transmisión.

No usar concursos históricos reales para pruebas destructivas. Este cambio no autoriza integración en `production`.
