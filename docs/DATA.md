# Datos, formatos y regeneración

## Qué está generado

Los JSON de grafos, tablas binarias y buffers de prefabs no son código minificado para editar a mano. Son una representación numérica del perfil indicado en `CONJUNTO-DATOS.json`. Se mantienen compactos y se excluyen de Prettier; el código de los módulos, herramientas, estilos y documentación sí se formatea.

| Recurso                                                          | Uso                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `engine/map-kernel.json`, `engine/kernel.json`, `engine/assets/` | Grafos de clima/terreno y tablas binarias de precisión completa.                                                    |
| `engine/worldgen.json.gz`, `engine/caves.json.gz`                | Reglas completas para las fases detalladas.                                                                         |
| `engine/strata.json[.gz]`                                        | Proyección de entornos geográficos por capas, sin geometría de túneles.                                             |
| `engine/poi-kernel.json.gz`, `engine/poi-caves.json.gz`          | Proyecciones ligeras para consultar anclas.                                                                         |
| `data/poi-contents.json.gz`                                      | Entradas de prefab, hijos deterministas y metadatos del catálogo.                                                   |
| `data/poi-columns.json.gz`                                       | Extremos verticales de columnas para colocar decoraciones sin cargar bloques.                                       |
| `data/world-rules.json`                                          | Propiedades resueltas de bloques, recursos, entornos y reglas de marcadores.                                        |
| `data/native-prefabs/manifest.json` y `.apf`                     | Inventario y buffers completos de los prefabs.                                                                      |
| `data/native-prefabs/geometry.json`, `data/cave-bounds.json`     | Límites usados por rutas distintas del generador. No son equivalentes y no deben fusionarse sin referencias nuevas. |
| `tests/fixtures/`                                                | Referencias compactas para detectar regresiones; su procedencia no equivale a licencia MIT sobre datos del juego.   |

## Contenedor ATPF, versión 3

Cada prefab necesita una petición HTTP. El archivo `.apf` contiene:

1. Cuatro bytes ASCII `ATPF`.
2. Un entero sin signo de 32 bits little-endian con la longitud del segmento de metadatos comprimidos.
3. Metadatos JSON UTF-8 comprimidos con zlib.
4. Los registros numéricos de bloques, comprimidos con zlib. Al convertir desde el formato 2 se conservan sus bytes comprimidos originales.

Cada registro de bloque ocupa 44 bytes, con posiciones, ID de bloque, máscara, probabilidad float32, soporte, rotación, relleno y fluido. `V1PrefabData` valida cabecera, número de registros y orden de columnas; comparte solicitudes pendientes y limita el buffer en memoria. El nombre del archivo es un prefijo SHA-256 de su contenido, lo que permite caché inmutable.

Para inspeccionar o editar metadatos fuera del sitio publicado:

```sh
python tools/prefab-assets.py site/data/native-prefabs scratch/prefabs --unpack
```

Para volver a crear los contenedores desde ese directorio numérico:

```sh
python tools/prefab-assets.py scratch/prefabs scratch/packed
```

La salida debe estar vacía y fuera de la carpeta de entrada. La herramienta verifica cada resultado mediante una lectura inversa y compara todos sus bloques y metadatos. Reemplaza el inventario y sus archivos juntos; no mezcles contenedores con un manifest de otro formato.

## Regenerar el índice ligero

```sh
python tools/rebuild-poi.py
python tools/rebuild-poi.py --export-catalog scratch/catalog.json
python tools/rebuild-poi.py --catalog scratch/catalog.json
```

El comando usa los prefabs numéricos y las reglas ya incluidas en `site/`, no una instalación de Hytale. El catálogo exportado permite cambiar nombres, descripciones, disponibilidad y alias de recursos. Esto no añade reglas de generación nuevas a un perfil que no las contenga. Los cambios producen una revisión de índice nueva para evitar reutilizar resultados antiguos.

Si modificas un prefab o reglas de marcadores/recursos, regenera el índice y ejecuta `npm run test:world`. Las referencias actuales pueden dejar de corresponder a un perfil modificado intencionalmente: documenta esa diferencia y obtén referencias nativas nuevas, sin reemplazar los hashes solo para hacer pasar una prueba.

## Cambiar de versión de Hytale

El repositorio contiene el perfil numérico utilizable y herramientas para transformar sus datos. No incluye un extractor completo de nuevas instalaciones ni una actualización automática de versiones. Una actualización requiere una captura coherente de configuración, IDs resueltos, límites, buffers y referencias nativas; después hay que generar las proyecciones ligeras y validar las fases. No basta con cambiar el texto de la versión en la interfaz.

Mantén un mismo `datasetId` dentro de una extracción. Consulta [THIRD_PARTY](../THIRD_PARTY.md) para distinguir el código original de los datos derivados.

## Perfil de minerales e iconos

```sh
npm run build:ore-profile
python tools/import-icons.py /ruta/a/la/carpeta/de/iconos
```

El perfil de minerales se deriva de los datos numéricos incluidos: identifica depósitos de relleno y fuentes de prefab, y genera una proyección mínima de geometría. Los intervalos Y se obtienen de cada depósito calculado, no de tablas de Minecraft. Los resultados finales conservan `heightCounts` y `levelPositions` para filtrar capas sin volver a calcular bloques.

Los PNG se deduplican con SHA-256 y se publican con nombres derivados de su contenido. `assets/icons/manifest.json` relaciona esos archivos con tipos y familias; la interfaz añade tamaños y bordes uniformes. Solo se cargan los recursos que necesita la vista. Consulta `THIRD_PARTY.md` para su procedencia y exclusión de la licencia MIT del código.

## Perfil y auditoría de mobs

```sh
python tools/build-mob-profile.py --assets /ruta/Assets.zip --server /ruta/HytaleServer.jar
python tools/rebuild-poi.py
```

La herramienta de desarrollo comprueba la versión del manifiesto del servidor y el dataset de los datos numéricos. Lee nombres traducidos, configuraciones de aparición natural/balizas y referencias de marcadores de los contenedores ya incluidos. Exporta únicamente los datos de localización y condiciones a `data/mob-spawns.json.gz`; el índice `poi-contents.json.gz` incorpora el catálogo para el navegador. No distribuye el servidor, Assets.zip ni código descompilado. La semántica de IDs exactos de entorno se contrastó con NPCSpawn y WorldSpawnManager de 0.8.0-pre.4.

`docs/validation/mob-coverage-0.12.0.json` enumera los roles sin ubicación identificada y detalla el caso grizzly. La disponibilidad no equivale a presencia garantizada: los hábitats dependen de condiciones dinámicas y los marcadores condicionales pueden ser alternativas o activaciones de evento. Los pesos de selección no se presentan como porcentajes de aparición.

Las herramientas de reconstrucción y las pruebas normales usan el perfil incluido; solo la actualización de estas reglas requiere los archivos locales indicados. Si se cambia de versión o de extracción, deben regenerarse y validarse conjuntamente, nunca combinar IDs de distintas capturas.
