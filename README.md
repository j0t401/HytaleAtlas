# Hytale Atlas 0.7.0 experimental

Reemplaza site/, vercel.json y package.json del repositorio con los de este paquete. Vercel conserva outputDirectory: site. No se ha hecho push ni deploy. Para uso local abre Iniciar Atlas.cmd.

El motor detallado ahora está conectado: estructuras repetidas, agrupaciones de minerales y maderas, cofres reconocidos por su tipo de bloque y anclas de marcadores con un único mob elegible y sin desplazamiento horizontal aleatorio. Los iconos agrupan recursos por chunk; no representan cada bloque individual. Las condiciones del juego pueden impedir la aparición de un mob: un ancla no garantiza un mob vivo.

Selecciona Subsuelo y una altura Y entre0y319 para dibujar los entornos finales calculados por el motor. Cambiar altura o filtros reutiliza los datos cargados. Acerca a4x para activar la generación detallada; está disponible en cualquier coordenada y no está limitada a una región central. El cálculo es progresivo por chunks visibles, no está todo el dominio precalculado. Los chunks fuera de caché deberán calcularse de nuevo.

Rendimiento: los ríos ya no se calculan ni se dibujan en el mapa de superficie. Se mantiene el agua interna necesaria para reproducir los bloques del mundo detallado. El alejamiento mínimo es0.08px/bloque; siguen permitidos saltos a coordenadas lejanas. Se activa interpolación visual de alta calidad y el detalle equilibrado por defecto. El suavizado mejora la presentación, pero no añade información ni precisión a las muestras. Hay previews, cachés acotadas y cancelación al cambiar la vista.

Precisión pendiente: cinco de seis chunks completos de referencia coinciden tras terreno, cuevas, estructuras y agua. En el sexto quedan nueve diferencias entre bloques/prioridades; aún no se ha resuelto su causa. Esta versión permite probar la integración, NO es una reproducción completa certificada de todas las estructuras, condiciones de mobs ni versiones de Hytale. Perfil Default V1 0.8.0-pre.4. Los iconos se dibujan con símbolos propios, no con texturas oficiales.

Prueba de integración: un chunk devolvió327680valores de entorno,4grupos de recursos y27colocaciones de prefab. Sin errores del worker en esa prueba. Se comprobó la sintaxis JavaScript. No hubo inspección visual con control del PC. El motor de detalle descarga datos adicionales cuando se activa, y el primer cálculo puede tardar.
