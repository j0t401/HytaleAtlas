# Hytale Atlas

Explorador de semillas de Hytale con mapa oscuro en 2D, biomas de superficie y subsuelo, estructuras, recursos y marcadores fijos de mobs. Se publica como una web estática: los cálculos se ejecutan en el navegador, sin servidor de Hytale ni archivos del juego en el PC del visitante.

**Atlas 0.11.0 · perfil incluido: Hytale 0.8.0-pre.4, WorldGen V1 · experimental.** El número del Atlas es independiente de la versión del juego. Las pre-releases nuevas necesitan otro perfil de datos y validación; el proyecto no lo actualiza automáticamente.

## Empezar

```sh
git clone https://github.com/j0t401/HytaleAtlas.git
cd HytaleAtlas
python serve.py
```

En Windows también puedes abrir `Iniciar Atlas.cmd`. Usa la dirección HTTP que imprime el lanzador y mantén su ventana abierta. No abras `site/index.html` directamente por `file://`. Python 3.10 o posterior basta para servir la web; Node.js 24 se utiliza para desarrollar y ejecutar pruebas.

Para trabajar en el código:

```sh
npm ci
npm start
```

Prettier es una dependencia de desarrollo. El formato de Python usa Black, fijado en `requirements-dev.txt`; para colaborar en esos scripts instala `python -m pip install -r requirements-dev.txt` y ejecuta `python -m black .`. La web publicada no necesita instalar paquetes npm ni ejecutar una compilación.

## Usar el mapa

1. Introduce la semilla y pulsa **Explorar**. Arrastra el mapa, usa la rueda o salta a coordenadas.
2. Abre una categoría del catálogo y selecciona sus iconos. Las categorías y rarezas empiezan plegadas; buscar o aplicar filtros abre los resultados correspondientes.
3. Los tipos elegidos permanecen visibles a cualquier zoom. La agrupación opcional de depósitos próximos conserva sus miembros y se puede desactivar para verlos individualmente. **Nombres en el mapa**, dentro de Capas, controla las etiquetas por separado.
4. Selecciona **Zonas subterráneas** y una altura Y para ver los entornos del subsuelo. Las franjas de Y=0..319 se guardan con cada tesela de superficie; cambiar la capa o altura no genera cuevas completas.
5. Las anclas de cofres, maderas y mobs aparecen primero mediante sus prefabs. **Verificar con bloques finales** ejecuta el cálculo detallado, que cuesta más. La pestaña Minerales muestra zonas de origen, franjas Y y resultados de la vista. Los resultados comprobados almacenan conteos y posiciones por nivel; filtrar Y no vuelve a generar el mundo. Los minerales del terreno activan ese cálculo porque no dependen solo de estructuras.

Las rarezas son categorías orientativas y editables del Atlas, no probabilidades de aparición medidas. Goldenwood Log es una categoría de recurso que agrupa los troncos compatibles del juego. El catálogo identifica siete gólems: cinco con reglas de marcador fijo y dos sin ancla fija localizable en este perfil. Un ancla no garantiza que exista un NPC vivo si no se cumplen las condiciones del juego.

## Cómo funciona

El servidor estático entrega código y datos numéricos. Tres Web Workers separan los costes:

| Worker            | Trabajo                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `worker.js`       | Biomas, teselas de superficie y franjas de entornos subterráneos.                                                                   |
| `poi-worker.js`   | Consultas regionales de estructuras y anclas de prefabs, incluidos nodos y decoraciones subterráneas.                               |
| `world-worker.js` | Terreno, cuevas, colocación de prefabs y agua interna para comprobar bloques finales. Solo devuelve resúmenes útiles para el visor. |

La interfaz dibuja con Canvas 2D y sprites reutilizados. La semilla permanece en la barra superior; las pestañas Elementos, Capas y Minerales separan los controles. En móvil, el panel se abre como una hoja inferior y deja el mapa visible al cerrarlo. Kweebec, Outlanders y mobs destacados tienen categorías propias. Los filtros actúan sobre puntos calculados; la caché en memoria e IndexedDB permite reutilizarlos al cambiar zoom o selección. Las nuevas vistas se calculan progresivamente: no se precalcula todo el dominio del mundo de una sola vez. El navegador puede desalojar el almacenamiento persistente.

Los depósitos de torio se consultan desde la geometría nativa de la zona 2; antes esperaban a la fase completa porque no estaban en el índice rápido de prefabs. El cobalto también tiene fuentes de prefab en la zona 4. El núcleo mínimo de minerales evita cargar primero salas y decoraciones, y la verificación prioriza los chunks que contienen los minerales seleccionados. Las piezas de un complejo subterráneo se presentan bajo un marcador de estructura, conservando las anclas individuales de recursos y mobs.

El cálculo conserva la aritmética, las conversiones y el orden del generador de referencia. Las semillas se conservan como texto de 64 bits; este perfil V1 usa sus 32 bits inferiores. El subsuelo muestra zonas geográficas por altura, no la geometría de cada túnel.

Lee [arquitectura](docs/ARCHITECTURE.md) para seguir el flujo completo y [datos y formatos](docs/DATA.md) para entender los recursos generados.

## Dónde modificar cada cosa

| Quieres cambiar…                                         | Archivo o función                                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Colores, diseño y tamaños                                | [`site/style.css`](site/style.css).                                                                                         |
| Formularios, textos y paneles                            | [`site/index.html`](site/index.html).                                                                                       |
| Pestañas, panel móvil, detalle de puntos y alturas       | [`site/ui.js`](site/ui.js).                                                                                                 |
| Importar PNG y normalizar sus marcos                     | [`tools/import-icons.py`](tools/import-icons.py), [`site/icon-art.js`](site/icon-art.js).                                   |
| Fuentes de mineral y geometría ligera                    | [`tools/build-ore-profile.cjs`](tools/build-ore-profile.cjs), [`site/engine/ore-deposits.js`](site/engine/ore-deposits.js). |
| Cámara, zoom, resolución de las teselas, exportación PNG | [`site/app.js`](site/app.js): `plan`, `zoomAt`, `draw`.                                                                     |
| Iconos y categorías plegadas                             | [`site/points-ui.js`](site/points-ui.js): `poiSprite`, `poiGroup`, `renderPoiPicker`.                                       |
| Categorías de estructuras y rarezas iniciales            | [`site/poi-labels.js`](site/poi-labels.js): `structureType`, `atlasRarity`.                                                 |
| Tamaño de las consultas y caché de anclas                | [`site/poi-worker.js`](site/poi-worker.js), [`site/points-ui.js`](site/points-ui.js): `queryPOIs`.                          |
| Programación del cálculo detallado                       | [`site/integration.js`](site/integration.js): `requestIntegration`.                                                         |
| Lectura de un prefab numérico                            | [`site/engine/prefab-data.js`](site/engine/prefab-data.js), [`tools/prefab-assets.py`](tools/prefab-assets.py).             |
| Regenerar índices ligeros o editar su catálogo           | [`tools/rebuild-poi.py`](tools/rebuild-poi.py); consulta [DATA](docs/DATA.md).                                              |
| Reglas de generación                                     | [`site/engine/`](site/engine/); conserva las referencias nativas al modificar la aritmética.                                |
| Alojamiento y caché HTTP                                 | [`vercel.json`](vercel.json).                                                                                               |

Los nombres y ubicaciones de recursos nuevos deben proceder del perfil y de sus reglas. Añadir una opción a la interfaz no crea por sí solo un cálculo válido para ese recurso.

## Comprobar cambios

```sh
npm run format
npm run format:check
npm run check
npm test
npm run test:world
```

`check` revisa sintaxis, entradas estáticas y referencias de los contenedores. `test` comprueba filtros, categorías plegadas, cachés, capas, geometría y anclas. `test:world` compara las cuatro fases de seis chunks con huellas capturadas del generador nativo. Se incluyen fixtures compactos: no necesitas instalar Hytale para ejecutar estas pruebas. `npm run test:all` ejecuta ambas suites.

GitHub Actions ejecuta formato, comprobaciones y pruebas en cada push o pull request. Los resultados históricos están separados en [`docs/validation/`](docs/validation/); no sustituyen las pruebas de los cambios nuevos. Las muestras no certifican todas las semillas y coordenadas.

## Publicar

Conecta el repositorio a Vercel y conserva `vercel.json`: **Output Directory = `site`**, sin comando de build ni instalación para producción. La misma carpeta puede servirse desde otro alojamiento estático que admita Web Workers, WebAssembly y archivos binarios. Comprueba rutas y tipos MIME si cambias de proveedor. La parte completa de prefabs requiere un navegador con `DecompressionStream`.

Los contenedores `.apf` y las tablas de clima usan nombres ligados al contenido para permitir caché prolongada. Los scripts y configuraciones se revalidan. Si cambias el formato o la semántica de una caché, incrementa su prefijo; no mezcles perfiles con diferentes `datasetId`.

## Rendimiento y límites

La versión 0.11 conserva las muestras, alturas, franjas e iconos. Reduce trabajo innecesario: controles diferidos, estado climático compartido entre workers con validación de semilla y perfil, agrupación opcional de depósitos, buffers transferidos, resúmenes de chunks sin matrices duplicadas y un único archivo por prefab. Los contenedores conservan todos los bloques y metadatos sin pérdidas. [CHANGELOG](CHANGELOG.md) resume los cambios.

La primera consulta de muchos tipos puede tardar; los tiempos de los informes son pruebas locales en Node, no un benchmark de Vercel. Los ríos de superficie siguen desactivados. El suavizado visual no añade precisión a las muestras. Las anclas ligeras no garantizan el bloque final tras máscaras o reemplazos; algunas ramas de prefabs requieren verificación detallada. Los contenedores se reconocen por nombres de bloque, por lo que su clasificación sigue siendo heurística.

## Contribuir y licencia

Consulta [CONTRIBUTING](CONTRIBUTING.md) para proponer mejoras. El código original usa [MIT](LICENSE). Los datos derivados del juego y otros materiales se identifican por separado en [THIRD_PARTY](THIRD_PARTY.md); no se presentan como recursos originales MIT. Proyecto independiente, sin afiliación con Hypixel Studios.
