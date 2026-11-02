# Persistencia temporal de navegación — TEST

## Diagnóstico

El cliente Supabase puede emitir SIGNED_IN al recuperar el foco y TOKEN_REFRESHED al renovar la sesión (confirmado en la documentación incluida en auth-js). El listener anterior vaciaba todos los datos ante cualquier evento; además, el efecto de carga dependía del objeto session. Esto provocaba consultas y pantallas de carga que desmontaban el concurso, perdiendo los acordeones. No se encontró un listener propio de focus que consultara concursos directamente.

Los días y la información importante estaban solamente en useState y se reiniciaban al remontar. Una recarga completa de iOS tiene el mismo efecto. No se intenta impedirla, ni se atribuye cada caso observado a una recarga sin instrumentación de un iPhone real.

## Comportamiento

- La URL sigue identificando el concurso, resultado, listado, documento o transmisión. No se sustituye un enlace directo por la última página guardada ni se redirige Inicio a un concurso anterior.
- sessionStorage `equidate:navigation:v1`: IDs de concurso/días, información importante abierta, listado seleccionado dentro de una transmisión y scroll aproximado por vista. No guarda consultas de búsqueda, nombres, resultados ni credenciales.
- Caduca a las 4 horas desde la última actualización de cada registro; máximo 30 registros por pestaña. Al cerrar la sesión de navegación, el navegador elimina sessionStorage. El borrado/bloqueo del almacenamiento no impide usar la aplicación.
- Los días se identifican por ID de Supabase. Para jornadas antiguas sin registro propio se usa la combinación estable ID de concurso + fecha, nunca un índice de array.
- IDs de días/pruebas/documentos inexistentes se ignoran y no abren una sección distinta. Cada concurso/vista tiene su propia clave.
- El scroll se guarda antes de la navegación interna, al ocultar la página, en pagehide y al desplazarse. Se restaura después de cargar/renderizar, esperando hasta 2 segundos si falta altura. Se limita a la altura disponible y se cancela si el usuario empieza a interactuar.
- Volver al concurso conserva sus días y su posición. Una actualización normal no reinicializa el contenido ni aplica otra restauración del scroll.
- Solo los cambios de identidad/permisos vacían los datos. Una renovación de token de la misma cuenta actualiza la sesión sin desmontar el contenido. Los errores en segundo plano se muestran con Reintentar y mantienen lo ya cargado.

## Verificación

TypeScript, pruebas existentes y nuevas pruebas de almacenamiento/controlador de scroll, y compilación de Vite. Los tests cubren expiración, datos corruptos, storage bloqueado, aislamiento, IDs estables, regeneración de sesión, guardado por visibilitychange/pagehide, espera de layout, cancelación por gesto, navegación y actualizaciones sin restauración repetida.

La configuración de Netlify mantiene `main` en Supabase TEST, y el guard de build rechaza otra URL para main. No se modifican tablas, políticas ni datos de Supabase. No integrar esta rama a production sin autorización.

## Prueba manual en TEST

1. Abrir un concurso, desplegar domingo e Información importante. Bajar, pasar a WhatsApp y volver: conservar secciones y posición.
2. Abrir Resultados de una prueba y recargar: conservar esa URL y restaurar el scroll cuando termine la carga inicial. Probar también Listado y documento.
3. Volver al concurso: recuperar el domingo y la posición anterior.
4. Abrir otro concurso: no heredar los días del anterior. Abrir un enlace directo: respetarlo.
5. Dejar renovar la sesión o reintentar una actualización: mantener los acordeones sin pantalla completa de carga.
6. Abrir un listado dentro de una transmisión y recargar: restaurar ese listado si sigue perteneciendo a esa jornada/pista.
7. Repetir en Safari iPhone, Chrome móvil y escritorio. La prueba física de suspensión/recarga de iOS y la verificación visual del sitio protegido requieren acceso al TEST; no se presentan como comprobaciones ejecutadas automáticamente.
