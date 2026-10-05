# Pistas, pruebas y transmisiones separadas

Esta actualización requiere que la migración de jornadas `20261005_competition_schedule.sql` ya esté aplicada.
No volver a ejecutar esa migración ni `schema.sql` en la base existente.

## Aplicación por la propietaria

1. Antes de ejecutar la migración nueva, registrar los conteos actuales:

```sql
select
  (select count(*) from public.events) as concursos,
  (select count(*) from public.documents) as documentos,
  (select count(*) from public.document_pages) as paginas,
  (select count(*) from public.competition_classes) as pruebas,
  (select count(*) from public.competition_days where nullif(trim(youtube_url), '') is not null) as transmisiones_anteriores;
```

2. Revisar y ejecutar **una sola vez**, completa, `supabase/migrations/20261006_arenas_streams.sql` en SQL Editor.
   No se ejecutó contra Supabase remoto desde esta tarea. La propietaria debe aplicar el archivo.
   La migración es transaccional: si aparece un error, detenerse y compartirlo; no borrar objetos para repetirla.
3. Verificar los mismos conteos de concursos, documentos, páginas y pruebas, y las asignaciones:

```sql
select
  (select count(*) from public.events) as concursos,
  (select count(*) from public.documents) as documentos,
  (select count(*) from public.document_pages) as paginas,
  (select count(*) from public.competition_classes) as pruebas,
  (select count(*) from public.competition_arenas where is_primary) as pistas_principales,
  (select count(*) from public.competition_classes where arena_id is null) as pruebas_sin_pista,
  (select count(*) from public.competition_streams) as transmisiones,
  (select count(*) from public.documents where type <> 'PROGRAM' and class_id is null) as documentos_pendientes_de_asignar;
```

Debe existir una pista principal por concurso, cero pruebas sin pista y una transmisión por cada URL de jornada anterior.
Los documentos antiguos sin prueba pueden aparecer como pendientes: se conservan y se asignan manualmente, sin adivinar a qué prueba pertenecen.
4. Integrar la propuesta de GitHub y esperar el despliegue de Netlify. No desplegar esta UI antes de aplicar la migración.
5. Entrar en Administración y comprobar los botones independientes **Pruebas**, **Transmisión** y **Documentos**.

## Cambios de datos y compatibilidad

- Crea `competition_arenas` y una “Pista principal” por concurso. Las pruebas actuales se asignan a esa pista.
- Crea `competition_streams`, con una URL por combinación de jornada y pista. Una URL puede repetirse entre días o pistas.
- Copia las URLs actuales a las transmisiones de la pista principal y conserva `competition_days.youtube_url` para compatibilidad.
- Mantiene los enlaces anteriores `#transmission/<jornada>`: abren la pista principal. Los nuevos incluyen también la pista.
- No elimina concursos, documentos, páginas, pruebas, archivos ni URLs anteriores al aplicar la migración.
- No renombra los documentos existentes en masa. La UI deriva sus títulos del tipo y de la prueba; los guardados posteriores generan el nombre internamente.
- Los nuevos listados y resultados requieren una prueba. La fecha se obtiene automáticamente de ella; los anteprogramas son generales del concurso.
- Las pistas con pruebas o transmisiones no se pueden eliminar; la pista principal se conserva. Se puede cambiar el nombre de cualquier pista.
- Cambiar la pista de una prueba conserva sus documentos. La jornada de una prueba con documentos se mantiene para no romper sus asociaciones.
- Los datos anteriores sin prueba siguen visibles y se pueden asignar desde Documentos → Editar datos.

## Uso

**Pruebas:** muestra todas las jornadas del concurso. Desde “Pistas del concurso” se pueden nombrar pistas y agregar otras. Al cargar una prueba se eligen jornada y horario; si hay varias pistas aparece también el selector de pista. No hace falta guardar una transmisión antes de crear pruebas.

**Transmisión:** seleccionar jornada y, si hay varias, pista. Guardar la URL de YouTube. El cronograma inferior se arma automáticamente con las pruebas de esa jornada y pista, sin asignaciones duplicadas. La zona horaria es compartida por todas las pistas de una misma jornada. Guardar el enlace vacío quita solo la transmisión seleccionada; no elimina pruebas ni documentos.

**Documentos:** elegir Anteprograma, Listado o Resultados y cargar PDF o imágenes. Para Listado/Resultados es obligatorio seleccionar una prueba. No se pide nombre ni fecha manual. Anteprograma se guarda a nivel del concurso.

## Seguridad y comprobaciones

Las dos tablas nuevas tienen RLS: lectura pública solo para concursos publicados y escritura solo con `app_metadata.equidate_admin = true`.
Las claves compuestas impiden relacionar pruebas o transmisiones con pistas de otros concursos.
Las funciones nuevas usan SECURITY INVOKER, sin elevar permisos. El guardado de URL y zona horaria es transaccional.
Las políticas y el bucket público existentes no se modifican en esta migración.

Validación: `npm test`, `npm run lint` y `npm run build`.
Incluye pruebas de conservación de datos, copia de transmisiones, asignaciones de pistas, RLS, títulos automáticos y documentos obligatoriamente vinculados.
La revisión en navegador usa una API simulada y no modifica el proyecto real.
