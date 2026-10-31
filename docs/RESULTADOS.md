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

El formato aprobado presenta Puesto, Caballo, Jinete y Club como en los órdenes de ingreso, seguido de Faltas y Tiempo. No muestra HNR, banderas, premios ni fondos decorativos. Los encabezados son azules con texto blanco. En móvil se apilan los datos del participante y las marcas debajo, para evitar una tabla demasiado ancha.

En Administración se puede elegir una o dos fases para descargar la plantilla. Cada prueba conserva el número de fases del documento original; no inferirlo a partir de las marcas ni convertir una fase en dos.

- Una fase: `faults` (Faltas), `time` (Tiempo).
- Dos fases: `phase1_faults`, `phase1_time`, `phase2_faults`, `phase2_time`. Cada par usa las etiquetas Faltas y Tiempo y aparece agrupado bajo Fase 1 o Fase 2.

Los valores de cada fase se conservan de forma independiente, incluidos ceros y campos vacíos. No se suman faltas, no se completan tiempos y no se recalculan puestos. Las columnas de documentos existentes con otras claves se siguen mostrando con sus etiquetas originales.

## Tiempo óptimo, recorridos y clasificados

La migración `20261031174558_result_details_and_qualification.sql` agrega `details` a cada versión, sin modificar sus filas históricas. `details` admite `definition`, `height`, `allowedTime`, `optimalTime` y `rounds` (hasta cuatro objetos con `label`, `allowedTime` y `optimalTime`). Todos los tiempos son textos originales: se conservan las comas y los blancos.

La plantilla ofrece un recorrido, tiempo óptimo, dos fases, recorrido y desempate, o doble recorrido. Las columnas detallan Faltas obstáculos, Faltas tiempo, Total faltas y Tiempo por recorrido. En tiempo óptimo se agrega `time_difference` (Diferencia al óptimo). El valor objetivo se muestra en las condiciones de la prueba, no se repite en cada fila. El total de faltas de toda la prueba, cuando figure, es una columna independiente; nunca se confunde con un total del campeonato ni se calcula automáticamente.

Cada columna puede tener `group` para conservar títulos como Recorrido, Desempate, Fase 1 o Recorrido 2. Los resultados anteriores con dos fases simplificadas siguen funcionando. Las columnas marcadas con `scope: "championship"` son rechazadas: no se importan puntos, acumulados, P11/P12/P13/P14, campeón/subcampeón ni tablas finales de campeonato. `scope: "class"` es opcional para las columnas propias de la prueba.

Cada fila admite `category` y `qualified` (booleano opcional). Los puestos se conservan aunque reinicien en otra categoría; el mismo binomio puede tener resultados en categorías distintas. `qualified: true` muestra únicamente el número del puesto en negrita y bordó EquiDate (`#A61E4D`), sin etiqueta ni leyenda visible. La distinción también se comunica a lectores de pantalla. `false` no lo resalta; ausencia significa que no se informó esa distinción. Nunca inferir el dato a partir del puesto, medallas, cantidad de inscriptos ni una regla deportiva supuesta. Corresponde marcarlo solo después de comprobar el número rojo de la fila en el documento, según la indicación de la propietaria.

`python scripts/extract-result-evidence.py origen.pdf evidencia.json` extrae texto por página y candidatos de números rojos junto con coordenadas y texto de la fila. Requiere pypdf y pdfplumber. Es una lectura local: no escribe en Supabase ni decide clasificaciones. Evita interpretar el título vertical rojo “Clasificación” como un participante. Se debe renderizar y revisar el original antes de asociar la evidencia con cada fila.

Referencias revisadas: RESULTADOS SABADO CAE.pdf (10/10/2026) y RESULTADOS DOMINGO.pdf (11/10/2026), del Club Alemán de Equitación. No son resultados de San Diego. En el archivo del sábado, las páginas 4, 7 y 9 corresponden a finales de campeonato y se excluyen de la importación de pruebas; las columnas de puntos de campeonato que comparten página con resultados también quedan fuera. No cargar estos documentos reales sin una revisión separada de sus asociaciones y filas.

`equidate_import_result_lists(batch)` publica de forma atómica e idempotente; `equidate_unpublish_result_list(target,expected_revision)` retira sin borrar versiones. Los resultados nunca sobrescriben el contador manual ni el contador derivado del orden de ingreso.
