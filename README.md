# Hytale Atlas 0.6.0

Web estática compatible con la estructura de `j0t401/HytaleAtlas` y Vercel. Perfil comprobado: Default WorldGen V1 de Hytale 0.8.0-pre.4.

## Subir a tu repositorio

Reemplaza `site/`, `vercel.json` y `package.json` en la raíz del repositorio por los de este paquete. Conserva tus otros archivos y ajustes. La carpeta de salida de Vercel sigue siendo `site`; no hace falta instalar dependencias, ejecutar un build ni crear funciones de servidor. El paquete está preparado localmente: no se ha hecho push ni se ha publicado en tu cuenta.

Para probarlo en Windows, abre `Iniciar Atlas.cmd`. No abras `site/index.html` directamente. El visor funciona sin Java, sin ejecutar Hytale y sin leer su instalación.

## Cambios

- Vista previa de las teselas antes de completar sus muestras. Las teselas de biomas de toda la vista se calculan antes del trabajo de agua.
- Agua de los ríos calculada a partir del bioma, su máscara de agua, sus niveles y la altura interpolada del terreno base. Se dibuja en azul y se puede ocultar al instante.
- Los biomas llamados River conservan el color terrestre original cuando no hay agua sobre el terreno. No se colorea todo el valle como cauce.
- Tres niveles de detalle. Rápido usa menos muestras en pantalla; Detallado y Máximo detalle permiten inspeccionar cauces pequeños. Al alejarse se muestrea el mundo: un cauce más estrecho que la distancia entre muestras puede no verse. Acerca el mapa para inspeccionarlo.
- Se agrupan los movimientos del cursor por fotograma y se cancela el cálculo que queda fuera de la vista.
- Caché acotada de puntos y teselas. Los datos de altura y estructuras se cargan después del motor inicial de biomas.
- Tablas climáticas binarias sin pérdida, con archivos comprimidos y nombres derivados de su contenido. Los datos iniciales estimados con gzip bajan de 371.165 a 145.834 bytes; el transporte real depende de la compresión de Vercel. El JSON inicial baja de 7.053.259 a 763.948 bytes y el resto se carga después.
- Configuración de caché para los binarios inmutables; HTML, scripts y configuración se revalidan para recibir actualizaciones. Véase la [documentación de Vercel](https://vercel.com/docs/caching/cache-control-headers).

## Precisión y trabajo pendiente

Los ríos representan agua respecto al terreno base. Las modificaciones por cuevas, cubiertas, puentes u otros prefabs no están incluidas todavía en esa capa. El agua se afina después del dibujo de biomas y puede tardar más, especialmente con Máximo detalle. La mejora de la vista previa no implica que todo el cálculo final sea doce veces más rápido.

Se conservan Spawn, Temple y el ancla fija X/Z del gólem del templo. El resto de estructuras repetidas, templos, minerales, maderas, cofres, otros mobs fijos y capas subterráneas sigue pendiente de integración y validación. El catálogo numérico de prefabs y el motor de colocación en desarrollo no se presentan como puntos finales en esta versión. No se han añadido posiciones aproximadas o aleatorias para rellenar el mapa.

No hay un cuadrado central de escaneo: se solicitan cálculos para la región navegada, incluso a grandes distancias. Esto no significa que todos los bloques de todo el dominio estén precalculados. Los filtros disponibles son de presentación y no reinician la semilla.

## Verificación

`VERIFICACION-rios-motor.json`: 524.288 valores de tablas idénticos, 900 muestras de bioma y 360 puntos de río contra el generador original (129 con agua y 231 secos).

`VERIFICACION-rendimiento.json`: comparación local con Node VM; primera vista previa alrededor de 90 ms, frente a unos 1.094 ms para una tesela anterior. La tesela completa de biomas conservó las mismas 4.096 muestras. No es una medición del navegador ni una garantía de tiempos de Vercel. La capa de agua se mide por separado.

Pruebas de interfaz simulada: filtros sin peticiones de regeneración, agua azul, movimientos agrupados, semilla de 64 bits, navegación lejana y errores de apertura visibles. Todos los archivos estáticos se sirvieron correctamente por HTTP local. No se realizó inspección visual con control del PC.

No afiliado con Hypixel Studios. Los archivos del extractor de desarrollo no forman parte de este paquete.
