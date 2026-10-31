# Resultados estructurados

La sección Administración → Resultados permite importar lotes revisados desde ChatGPT, agregar o reemplazar un PDF por prueba, consultar versiones, preparar restauraciones y retirar una publicación. Se conserva el visor de los PDFs históricos. No se modifican documentos ni órdenes de ingreso al publicar resultados.

La migración `20261031171539_structured_results.sql` agrega `result_lists`, `result_list_versions` y funciones independientes de los órdenes de ingreso. Aplicar primero en Supabase TEST. Producción requiere autorización explícita. Las tablas tienen RLS, escritura solo para administradores, versiones inmutables y control de revisión para reemplazos. Un lote con una prueba inválida se rechaza por completo.

La regla pública es la misma: resultado estructurado publicado → tabla EquiDate con descarga opcional del PDF de resultados; solo documento → visor anterior; ninguno → botón oculto. Una publicación vacía sigue siendo una publicación. El encabezado de EquiDate se conserva. Los resultados no se ofrecen en la página de transmisión, ni como tabla ni como documento.

## Importación

Usar el mismo flujo de extracción visual, asociación y confirmación que en `ORDENES_INGRESO.md`. No convertir un orden de ingreso en resultados, no calcular puestos ni inventar marcas. Extraer solo lo que figure en el documento original. Descargar la plantilla del concurso desde la sección Resultados.

Cada elemento del lote usa los identificadores y la revisión actual de su prueba, `sourceName`, `reviewed`, `uncertainties`, `entries` y `columns`. La confirmación debe resolver primero los datos inciertos. Los campos ausentes se dejan en blanco.

- `position`: índice de la fila en el documento, entero positivo único. Preserva el orden original.
- `rank`: puesto tal como figura en el documento (texto). Admite empates, estados y campos vacíos, sin renumerar.
- `horse`, `rider`, `club`: identidad del binomio; caballo y club admiten blanco.
- `columns`: array ordenado de `{key,label}` para las columnas adicionales que efectivamente incluya el documento. Máximo 12; las claves usan letras minúsculas, números y guiones bajos, comenzando con letra.
- `values`: objeto de textos, indexados por esas claves. Preservar comas, decimales y estados tal como fueron publicados; no convertirlos automáticamente.

La tabla presenta primero Puesto, Caballo, Jinete y Club, seguidos de las columnas del documento. Los encabezados son azules con texto blanco; en pantallas pequeñas se permite desplazamiento horizontal dentro de la tabla. El formato específico se ajustará al ejemplo que proporcione la propietaria.

`equidate_import_result_lists(batch)` publica de forma atómica e idempotente; `equidate_unpublish_result_list(target,expected_revision)` retira sin borrar versiones. Los resultados nunca sobrescriben el contador manual ni el contador derivado del orden de ingreso.
