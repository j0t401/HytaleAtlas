# Hytale Atlas · prototipo independiente

Corrección 0.4.1: el archivo `site/index.html` abierto directamente por `file://` muestra ahora instrucciones de arranque. Abre **Iniciar Atlas.cmd**, mantén su ventana abierta y utiliza la dirección **http://127.0.0.1:8766/**. Se verificó visualmente en Zen Browser que la semilla 42 dibuja la vista completa y que la cuadrícula se activa sobre el mapa existente. Los fallos de descarga y arranque del motor se muestran en pantalla; las descargas tienen un tiempo límite. Se redujo el número inicial de teselas y el servidor evita conservar scripts antiguos en caché.

Abre `Iniciar Atlas.cmd`. Necesita Python 3 solamente para servir los archivos de la web en localhost:8766. El cálculo ocurre en un Web Worker del navegador con JavaScript y WebAssembly. No lee archivos del juego, no inicia Java, no inicia el servidor de Hytale. Para alojarlo en una web, publica el contenido de `site/` en un servidor estático que admita Web Workers y WebAssembly; los visitantes no necesitan Python ni Hytale.

Introduce una semilla y arrastra el mapa. La rueda cambia el zoom alrededor del cursor. También puedes escribir coordenadas, resaltar un bioma y mostrar una cuadrícula instantáneamente, exportar la vista PNG y compartir la URL. Solo cambiar la semilla reinicia sus datos; los controles de presentación reutilizan las teselas ya calculadas. La caché conserva 180 teselas o las necesarias para la vista actual si es mayor; se prioriza la vista actual al desplazarse. El alejamiento utiliza muestreo de menor resolución, no un escaneo exhaustivo.

## Estado real

Implementado: cálculo independiente de zonas y biomas de superficie del perfil Default V1 de 0.8.0-pre.4, usando una instantánea numérica preparada durante el desarrollo. No hay carga de archivos de Hytale durante el uso. La instantánea de versión se descarga desde el mismo servidor web. No se incluyen el servidor del juego ni sus modelos/texturas.

Comparación con el generador instalado: coincidencia de zona y bioma en 65.536 puntos distintos de 12345 y 4.096 de 42. Operaciones de ruido y hash: 180 casos contra Java con error cero. Estas comprobaciones no prueban todo el espacio de semillas ni las coordenadas extremas.

Rango de navegación técnico: -2.147.483.648 a 2.147.483.647 en X/Z, por el dominio entero de la implementación V1. **No está verificado que ese sea el límite jugable de Hytale ni que el port coincida en sus extremos.** No se ha copiado el borde de Minecraft. La web calcula cualquier vista solicitada dentro del rango habilitado; no precalcula cada bloque del mundo. La vista lejana es una muestra y puede omitir biomas pequeños hasta acercarse.

Pendiente: estructuras, madera, minerales, generación de cuevas, biomas subterráneos y mobs de aparición fija dentro del motor independiente. No aparecen marcadores ficticios ni se sustituyen los datos por distribuciones inventadas. El extractor anterior conserva las capas detalladas de sus exportaciones concretas, pero depende del juego y no es este motor.

Alcance solicitado para mobs: mostrar únicamente los que la generación coloca de forma garantizada en un punto fijo. Quedan excluidos los hábitats de aparición aleatoria. Un SpawnMarker con coordenadas fijas no basta por sí solo: hay que resolver su configuración, posibles elecciones ponderadas, condiciones y desplazamientos de posición antes de afirmar que un mob concreto aparece siempre en ese punto. El icono representará su punto de aparición inicial, no su posición después de moverse ni su presencia tras una muerte en una partida guardada. Esta selección aún no está implementada en el motor independiente.

Solo se incluye 0.8.0-pre.4. Las próximas pre-release requieren una instantánea y verificación nuevas; no se selecciona automáticamente una versión desconocida.

## Referencia

Se analizó https://www.chunkbase.com/apps/seed-map como referencia funcional: semilla, versión, coordenadas, navegación, capas y enlaces compartidos. No se encontró un repositorio oficial de Seed Map. No se copió su código ni sus recursos gráficos.

El prototipo todavía no cumple todas las capas solicitadas; no debe presentarse como buscador completo de recursos o mobs.

## Despliegue en Vercel

El proyecto está preparado para desplegarse en Vercel de dos formas:

1. **Desde la consola o archivo ejecutable:**
   - Haz doble clic en `Desplegar a Vercel.cmd` (o ejecuta `npx vercel --prod` en la terminal).
   - Inicia sesión si te lo solicita en el navegador y confirma la configuración predeterminada.

2. **Desde GitHub / Dashboard de Vercel:**
   - Sube este proyecto a tu repositorio de GitHub.
   - En [Vercel](https://vercel.com/new), importa el repositorio.
   - El archivo `vercel.json` ya se encarga automáticamente de indicar que la carpeta a publicar es `site/` y configurar los tipos MIME para WebAssembly. No necesitas configurar comandos de build ni instalar dependencias.

