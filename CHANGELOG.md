# Cambios

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
