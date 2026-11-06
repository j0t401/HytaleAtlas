# Hytale Atlas 0.5.0 · prototipo V1 independiente

Extrae el ZIP y abre **Iniciar Atlas.cmd**. Necesita Python 3 para servir los archivos de la web; no necesita Java ni Hytale. Mantén abierta la ventana del lanzador. Se abrirá la dirección HTTP local, normalmente http://127.0.0.1:8766/. Si hay otra versión o programa en ese puerto, el lanzador utiliza otro libre. Solo reutiliza una instancia que pertenezca a esta carpeta y esta versión.

No abras `site/index.html` directamente por `file://`: el navegador impide descargar los datos del motor en ese contexto. La página muestra instrucciones si detecta ese caso. Los errores de carga se presentan en pantalla y las descargas tienen un tiempo límite.

## Funciones disponibles

- Semilla numérica de 64 bits, conservada como texto. El generador V1 utiliza sus 32 bits inferiores.
- Mapa de biomas que calcula nuevas vistas al arrastrar y al cambiar el zoom. No hay un cuadrado de escaneo central. El alejamiento usa muestras más espaciadas; no supone calcular cada bloque del mundo.
- Resaltado de biomas, cuadrícula, iconos de estructuras únicas y ancla fija del gólem: filtros de presentación instantáneos sobre datos calculados, sin reiniciar la semilla.
- Estructuras `Spawn` y `Temple`, calculadas para la semilla, con iconos y accesos directos a sus coordenadas. El icono de `Spawn` representa la estructura, no la posición exacta del jugador.
- Gólem de cristal de tierra del templo: ancla fija X/Z con un único rol, sin selección de un mob aleatorio ni desplazamiento horizontal. El punto representa el marcador de aparición. Su altura final se ajusta al suelo y el visor etiqueta Y como altura del ancla; no afirma que una criatura esté viva en una partida modificada.
- Altura del terreno base y entorno de superficie bajo el cursor. Se calculan antes de cuevas y estructuras; no equivalen a la altura final de una construcción.
- Coordenadas, enlace compartido de la vista y exportación PNG.

El motor corre en un Web Worker del navegador con JavaScript y WebAssembly. La web descarga su configuración numérica de versión desde el mismo servidor. No lee archivos instalados del juego ni ejecuta un servidor Hytale durante el uso. Para alojarla, publica el contenido de `site/` en un servidor estático compatible con Web Workers y WebAssembly; los visitantes no necesitan Python.

## Verificación y límites

Perfil incluido: Default WorldGen V1 de **0.8.0-pre.4**. Una versión nueva exige extraer y contrastar datos nuevos; no se simula compatibilidad automática.

Coincidencias con el generador de referencia: 900 alturas, entornos y biomas de cinco semillas; 10 posiciones de estructuras únicas; cinco anclas de aparición del gólem. Las comprobaciones del mapa inicial incluyen además 65.536 puntos distintos de 12345 y 4.096 de 42. El motor de desarrollo también pasó 47.417 posiciones de candidatos a prefabs, 20.480 coordenadas de capas y materiales base, 1.800 casos de ruido 3D y 600 secuencias de aleatoriedad y hash Java. Estos últimos cálculos aún no se exponen como ubicaciones finales de recursos.

Límites del generador instalado, comprobados en su código: X/Z desde −2.147.482.784 hasta 2.147.482.783. No se ha comprobado la coincidencia del port en todos sus extremos ni en todas las semillas.

Los filtros y el Worker pasaron pruebas automatizadas. La última revisión visual del navegador se hizo con el visor 0.4.1. No se volvió a controlar el PC para revisar esta versión, siguiendo la preferencia del usuario.

## Trabajo que sigue pendiente

Minerales, todas las maderas, cofres, otras estructuras, otros mobs de aparición fija y capas subterráneas todavía no se muestran como ubicaciones finales. La conversión de los datos ya incluye 5.146 prefabs y sus dependencias, pero falta completar y verificar su colocación, máscaras, selección de piezas, cuevas y prioridades de bloques. No se sustituye ese trabajo por marcadores inventados ni por probabilidades de hábitats.

El código y los datos de investigación se conservan aparte en `work/atlas-next/` y `work/v1-research/` dentro del proyecto, para continuar sin mezclar funciones incompletas con el visor utilizable.
