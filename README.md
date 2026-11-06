# Hytale Atlas 0.8.0 experimental

Para actualizar GitHub/Vercel reemplaza site/, package.json y vercel.json con los de este paquete. El directorio de salida sigue siendo site; no requiere compilación. Para uso local abre Iniciar Atlas.cmd. No se ha hecho push ni despliegue.

## Subsuelo sin acercarse

Cada tesela calcula conjuntamente la superficie y las franjas de entornos subterráneos entre Y=0 y Y=319, a cualquier zoom. Selecciona Capa del mundo → Zonas subterráneas y ajusta la altura. Mostrar u ocultar la capa y cambiar Y solo vuelve a dibujar los datos guardados: no genera cuevas ni bloques completos. Los colores y la leyenda representan las zonas del subsuelo definidas por las capas del generador, no la geometría de túneles ni los entornos añadidos por decoración de cuevas.

El mapa se calcula por teselas conforme se explora, también en coordenadas lejanas. No se precalcula todo el dominio finito en una sola operación. La caché en memoria y en IndexedDB conserva superficie y subsuelo conjuntamente. El navegador puede borrar o desalojar su almacenamiento; la persistencia es de mejor esfuerzo.

## Iconos, nombres y rendimiento

Selector de iconos individuales con búsqueda. Los nombres de recursos y mobs se obtienen de sus nombres visibles del juego; las categorías de estructuras están en español. Al alejarse desaparecen etiquetas y después iconos secundarios, hasta dejar templos. Acercarse reutiliza los puntos conservados. La consulta regional ligera de estructuras ordinarias está separada del cálculo de bloques finales y no tiene un requisito de zoom. Las estructuras generadas por cuevas requieren todavía el motor detallado: no se garantiza que todos los templos estén disponibles mediante la consulta ligera.

Activa Calcular bloques finales y anclas de mobs para recursos y colocaciones detalladas. Ese cálculo es progresivo y más costoso. Los iconos de minerales y maderas agrupan bloques por chunk; los contenedores se reconocen por nombres de bloque. Solo se consideran marcadores elegibles de un único mob sin desplazamiento horizontal aleatorio; el estado y las condiciones del juego pueden impedir su aparición. Un ancla no garantiza un mob vivo.

La versión separa las consultas de terreno, estructuras regionales y bloques completos, y guarda resultados en caché. Los ríos permanecen desactivados. Hay suavizado visual, previsualizaciones y un límite de alejamiento de 0,08 píxeles por bloque. El suavizado no añade precisión a las muestras. La arquitectura pública de OrbisSeeds inspiró la separación de consultas: véase ANALISIS-Orbis.md.

## Comprobaciones

Subsuelo: 64 columnas nativas, 20.480 valores de entorno, cero diferencias; todas las alturas guardadas. Se probó restaurar una tesela sin recalcularla y cambiar capa/altura sin enviar generación al motor de cuevas. Estas pruebas usan Node y un doble de IndexedDB; no son un benchmark de navegador.

Motor detallado: seis chunks, cuatro fases, 31.457.280 campos comparados, cero diferencias; incluye la referencia que antes tenía nueve diferencias. Consulta ligera: seis referencias de anclas sin diferencias. Los informes VERIFICACION-*.json contienen el alcance. Esto no certifica todas las semillas y coordenadas. No hubo inspección visual del despliegue en esta entrega.

Perfil incluido: Hytale 0.8.0-pre.4, WorldGen V1; no se actualiza automáticamente con nuevas pre-releases. El navegador usa los datos incluidos en el sitio y no necesita archivos del juego en el PC del visitante.
