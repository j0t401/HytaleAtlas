# Cambios

## 0.12.0

- Auditoría de 321 reglas de marcador, 5.135 prefabs, 502 roles concretos y 194 configuraciones de aparición natural/balizas.
- Catálogo de 518 roles: 262 localizables y 256 sin una fuente localizada en el perfil V1, identificados y deshabilitados.
- Hábitats de 176 tipos de mob, incluido el oso grizzly, con sombreado e iconos de guía ≈ a partir de los entornos reales del mapa.
- Información de horario, suelo/agua, luz y contexto de balizas; los puntos de hábitat no afirman la posición de un NPC vivo.
- Marcadores con alternativas, grupos, activación manual y ramas condicionales de prefab conservados como posibilidades explícitas.
- Entornos de superficie almacenados con las teselas, máscaras de hábitat reutilizadas y exclusión de escaneo de prefabs/bloques para selecciones que solo requieren hábitats.

## 0.11.1

- Marcador al pulsar el mapa o marcar su centro, con coordenadas, altura editable, copia normal o como comando `/tp`, y eliminación.
- Zoom con dos dedos y desplazamiento continuo al soltar uno; cancelaciones y arrastres no crean marcadores accidentales.
- Cruceta central y lectura de bioma/coordenadas en dispositivos sin cursor; las zonas subterráneas se consultan de las teselas guardadas.
- Movimiento visual separado de consultas diferidas a workers, orden de teselas reutilizado, descarte temprano de minerales fuera de pantalla y retirada del dibujo duplicado de resúmenes.
- Símbolo visible mientras carga un icono PNG y actualización de la guía al completar el manifiesto.

## 0.11.0

- Depósitos nativos de minerales en una consulta ligera, con un núcleo comprimido de geometría de unos 38 KB.
- Verificación dirigida a minerales seleccionados; conteos y posiciones reales por altura en los resultados comprobados.
- Reutilización validada del estado climático entre workers y de regiones padre al añadir filtros.
- Estructuras Kweebec, Outlander y mobs destacados separados; agrupación de piezas de un complejo y de depósitos próximos (opcional).
- Barra superior para semilla, pestañas de elementos/capas/minerales, panel inferior móvil y detalle de punto con coordenadas y capas.
- PNG suministrados integrados con caché y marcos de rareza uniformes, sin modificar sus píxeles.

## 0.10.0

- Categorías y rarezas plegadas de inicio, con creación diferida de controles e iconos.
- Un contenedor ATPF por prefab en lugar del par JSON/binz; bloques y metadatos conservados sin pérdidas.
- Transferencia de buffers de teselas y eliminación de matrices de entornos que la interfaz detallada no utiliza.
- Retirada del código de ríos desactivado y del catálogo intermedio duplicado.
- Formato de código, herramientas de comprobación, referencias nativas compactas, guía de contribución y GitHub Actions.
- MIT para el código original; procedencia de datos separada.

## 0.9.0

- Iconos seleccionados visibles en cualquier zoom y nombres opcionales.
- Catálogo por tipo y rareza, Goldenwood y siete tipos de gólem identificados.
- Anclas superficiales y subterráneas sin esperar a todos los bloques finales.

## 0.8.0

- Franjas de zonas subterráneas calculadas y guardadas junto con cada tesela de superficie.
- Caché persistente y consultas separadas de mapa, estructuras y bloques.
