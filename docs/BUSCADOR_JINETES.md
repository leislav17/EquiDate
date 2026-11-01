# Buscador de jinetes

Acceso desde el menú hamburguesa izquierdo: **Buscar jinetes** (`/buscar/jinetes`). La portada no incorpora accesos al buscador. La búsqueda comienza vacía y exige seleccionar una coincidencia antes de mostrar participaciones. Cambiar el texto borra la selección. No requiere cuenta.

Se incluyen todos los concursos publicados cargados por el contexto, sin filtro temporal. Se consultan solo los punteros publicados de órdenes y resultados. Mayúsculas, tildes y espacios repetidos son equivalentes. Nombre normalizado + caballo identificado forman una agrupación provisional, independientemente del club. Otro caballo no se incorpora sin revisión; caballo ausente o genérico mantiene filas separadas. No se modifican registros ni PDFs originales.

La actuación se vincula únicamente si coinciden prueba, nombre y caballo, hay un único candidato de cada lado y las categorías informadas son compatibles. Si hay varios resultados del mismo binomio, categorías incompatibles o falta caballo, se muestran participaciones separadas. Una asociación manual de identidad no implica asociar actuaciones. El número de posición de una fila de resultados nunca se presenta como orden de ingreso.

Las actuaciones reutilizan el componente de resultados existente, conservando fases, tiempos de referencia, categoría, clasificación y valores publicados. Los resultados sin orden también se muestran. Los PDFs e imágenes históricos siguen disponibles en cada concurso; un PDF sin datos estructurados no permite buscar personas dentro de él.

## Correcciones administrativas

Desde el menú de una sesión admin, **Asociaciones de jinetes** (`/admin/jinetes`). Buscar y marcar registros (se pueden conservar selecciones entre búsquedas), informar el motivo y guardar. La selección recibe una identidad interna común. Para separar una persona de un grupo, seleccionar solo sus registros y guardar una nueva asociación. “Restaurar agrupación provisional” elimina las correcciones seleccionadas. Incluir los registros de orden y resultado de la persona cuando corresponda.

Las correcciones referencian tipo, versión inmutable y posición de la fila. Una nueva importación requiere revisar las asociaciones; no se trasladan por posición a otro PDF. La migración `20261101004723_rider_associations.sql` agrega solo la tabla de correcciones. RLS permite leer correcciones de versiones actualmente publicadas en concursos publicados y escribir solo con `app_metadata.equidate_admin`. No se utilizan claves privilegiadas en el cliente. Si falla la lectura de correcciones, se bloquea la consulta y se ofrece reintentar para no mostrar asociaciones potencialmente erróneas.

## Entornos y validación

Aplicada únicamente en Supabase TEST (`slophgtrynlfesjonbzf`). No aplicar a PROD sin autorización. Configuración Netlify comprobada el 31/10/2026: Production branch = `production`; Branch deploys = `main`. Se conserva la protección del build de main contra conexión a PROD.

Pruebas de lógica: búsqueda vacía, tildes, nombre/apellido, homónimos, cambios de club, caballos diferentes o ausentes, borradores excluidos, asociación exacta por prueba/binomio, resultados sin orden, duplicados por categoría y correcciones manuales. Prueba PostgreSQL: escritura solo admin, claims de usuario sin privilegios, correcciones privadas ocultas y retirada de publicación. Prueba visual con datos reales TEST: Martina devuelve seis coincidencias; Martina Cilia / LI MUNAR muestra dos pruebas con órdenes 11 y 7; actuación de prueba 1 conserva las dos fases. Menú y tabla verificados a 390 × 844 y escritorio.
