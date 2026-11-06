# Hytale Atlas 0.9.0 experimental

Reemplaza site/, package.json y vercel.json en tu repositorio para actualizar GitHub/Vercel. La salida sigue siendo site y no requiere compilación. Para uso local abre Iniciar Atlas.cmd. No se hizo push ni despliegue.

## Selección y categorías

Los iconos seleccionados se muestran a cualquier zoom: se eliminaron los umbrales que ocultaban recursos, mobs y estructuras. Mostrar nombres es una opción independiente, también disponible a cualquier zoom. La superposición espacial de iconos sigue siendo posible cuando se seleccionan muchos elementos; los controles permiten reducir la selección. Los puntos visibles no se eliminan por superar el límite habitual de la caché.

El catálogo se organiza en estructuras, gólems, otros mobs fijos, maderas, minerales y cofres/contenedores. Cada categoría se subdivide por rareza, permite mostrar u ocultar el grupo, y se puede filtrar mediante búsqueda, tipo y rareza. Los biomas de superficie se agrupan por zona en el selector.

Las rarezas del Atlas son una clasificación editorial orientativa para organizar los filtros; no son probabilidades medidas de aparición ni una afirmación de rareza oficial del juego. Cada tipo permite cambiar su rareza y el navegador guarda esos cambios localmente. Cuando existen calidades explícitas del juego compatibles con el catálogo, tienen precedencia como valor inicial.

Todos los templos de portal utilizan structure:portal y el mismo icono, incluido el templo único. Otros templos y entradas conservan su propia categoría.

## Goldenwood y gólems

Se añadió Goldenwood Log, que se encuentra buscando también Golden Log o tronco dorado. En los datos instalados es una categoría de recurso: incluye Amber Log, Palm Tree Log, Sallow Log y Wild Wisteria Log. El filtro muestra anclas de los prefabs que contienen esos troncos; no se inventó una especie o un bioma exclusivo para Goldenwood.

Se muestran siete tipos de gólem del catálogo instalado. Earth, Flame, Frost, Sand y Firesteel tienen reglas elegibles de marcador fijo. Thunder y Void Guardian están identificados como sin ancla fija en este perfil y sus opciones de localización están deshabilitadas. No se les asignaron coordenadas ficticias. Incluso un marcador fijo requiere las condiciones de aparición y el estado del juego para que exista un NPC vivo.

## Anclas rápidas y comprobación final

Antes se esperaba al cálculo completo del chunk para publicar cofres y mobs. Ahora se consulta un índice compacto de entradas garantizadas de prefabs y sus marcadores fijos. Las anclas superficiales se publican primero; después se consultan los nodos y decoraciones de estructuras subterráneas, sin descargar los buffers completos de bloques. Las consultas densas de maderas/minerales se dividen en regiones menores, independientemente del zoom.

Estas posiciones se identifican como Ancla de prefab. La verificación de bloques finales sigue disponible y es más lenta: comprueba el resultado del mundo incluyendo máscaras y reemplazos. Los minerales del terreno la activan porque no dependen solo de estructuras. La lectura ligera expande hijos deterministas con una sola elección y sin condiciones heredadas de altura; otras ramas requieren el cálculo detallado. Los contenedores se reconocen por nombres de bloques Chest/Container: sigue siendo una heurística. No se garantiza cobertura completa de todas las colocaciones posibles mediante la consulta ligera.

La memoria y IndexedDB conservan consultas y chunks entre cambios de selección y zoom. La primera consulta de un lugar o tipo nuevo necesita cálculo. No se precalcula todo el dominio del mundo de una sola vez. El almacenamiento persistente es de mejor esfuerzo y el navegador puede eliminarlo. Al activar la verificación desde lejos se programan lotes de hasta 64 chunks sin construir primero una lista enorme de toda la vista.

## Subsuelo

Cada tesela conserva conjuntamente superficie y franjas de entornos subterráneos para Y=0..319. Mostrar la capa o cambiar de altura reutiliza lo guardado a cualquier zoom. Representa las zonas geográficas de las capas nativas, no la geometría de túneles o los entornos añadidos por decorar cuevas. El cálculo de la capa geográfica no activa el motor completo de bloques. Los ríos continúan desactivados.

## Validación y alcance

Los informes VERIFICACION-*.json registran las pruebas. La interfaz comprobó iconos en todos los zooms, nombres controlados por el usuario, filtros y reutilización de puntos. La consulta rápida publicó dos cofres y el gólem nativo del templo antes de terminar la fase subterránea, sin descargar buffers de bloques; las cifras de tiempo son locales en Node, no un benchmark de Vercel. Activar todo el catálogo puede seguir siendo costoso.

Coincidieron cinco anclas nativas del gólem del templo; 36 referencias de geometría con 1.224 nodos; 16 grafos de cuevas con 98 colocaciones de decoración; seis referencias de anclas superficiales; y 20.480 valores de entorno subterráneo. La base del motor detallado conserva la validación anterior de seis chunks y 31.457.280 campos sin diferencias (informe heredado, sin cambios numéricos de esa ruta en esta versión). Estas muestras no certifican todas las semillas y coordenadas. Se comprobaron sintaxis y servicio HTTP; no se inspeccionó visualmente un despliegue en navegador.

Perfil de datos incluido: Hytale 0.8.0-pre.4 / WorldGen V1. El número 0.9.0 corresponde al Atlas. El perfil no se actualiza automáticamente con nuevas pre-releases. El visitante no necesita archivos del juego en su PC. Véase ANALISIS-Orbis.md para el análisis previo de consultas separadas.
