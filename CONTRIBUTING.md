# Contribuir

1. Crea un fork y una rama para tu cambio.
2. Instala Node.js 24 y Python 3.10 o posterior; ejecuta `npm ci`.
3. Ejecuta `npm start` y abre la dirección local que imprime el lanzador.
4. Cambia los archivos fuente; consulta la tabla de [README](README.md) y [arquitectura](docs/ARCHITECTURE.md).
5. Ejecuta `npm run format`, `npm run check` y `npm test`. Si modificas el motor, sus datos o los contenedores de prefabs, ejecuta también `npm run test:world`.
6. Abre un pull request explicando el problema, el resultado, cómo lo comprobaste y los límites conocidos. Incluye semilla, versión, coordenadas y altura si corriges una posición del mapa.

JavaScript, HTML, CSS, Markdown y configuraciones de desarrollo se formatean con Prettier. Python usa cuatro espacios y funciones legibles. Las tablas, grafos, fixtures y buffers generados se mantienen compactos para conservar el tamaño de descarga; `.prettierignore` los identifica.

Mantén las operaciones numéricas, conversiones de enteros y orden del RNG cuando cambies el motor. Las mejoras de rendimiento deben conservar las referencias nativas, no sustituirlas por ubicaciones aproximadas. Añade pruebas sobre el fallo real o la referencia que resuelve el cambio.

Las categorías de rareza del Atlas son orientativas. No presentes como aparición fija un spawn aleatorio, un tipo sin marcador o una criatura que requiere condiciones adicionales del juego.

El código original usa MIT; consulta [THIRD_PARTY](THIRD_PARTY.md) antes de incorporar datos o recursos externos. No se necesita Hytale para ejecutar las pruebas incluidas.
