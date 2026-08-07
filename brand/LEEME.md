# AXIONA Systems · Dirección B «El libro mayor»

## Paleta
Tinta #0A0E1A · Papel #F2EDE1 · Oro #D6A84A
Sobre oscuro: símbolo #ECE5D6 + oro #F0C66E · Sobre claro: símbolo #161421 + oro #8A6A26
El oro es el único color. No se añade ninguno más.

## Archivos
- simbolo/ — el símbolo solo (perfiles sociales, sellos, favicon grande)
- horizontal/ — cabecera de web y firma de email
- vertical/ — marca completa, uso principal
- favicon/ — 64×64: versión con fondo tinta y versión transparente

Sufijos: oro-sobre-oscuro · oro-sobre-claro · tinta-plana (una tinta) · blanco (negativo)

## Construcción
Rejilla 64×64. La línea de oro es el rayado del libro: 6 unidades de alto,
sangra de borde a borde y nunca se recorta por dentro del área de respeto.
Travesaño de la A = intersección de esa línea con el contrapunzón; no se dibuja aparte.

## Área de respeto
x = grosor del rayado (6/64 del alto del símbolo). Margen mínimo 2x por los cuatro lados.
La línea de oro debe poder llegar siempre al borde del área.

## Tamaño mínimo
Símbolo: 16 px. Marca horizontal: 16 px de alto de símbolo (≈ 80 px de ancho total).
Por debajo, usar solo el símbolo.

## Tipografía
Spectral Medium en capitales, tracking 0.14 em (AXIONA) y 0.50 em (SYSTEMS).
Google Fonts: https://fonts.google.com/specimen/Spectral
El texto de los SVG NO está trazado a curvas: si el archivo va a una imprenta
o a un sistema sin la fuente instalada, convertir el texto a contornos antes.

## Nota de integración web (2026-08-07)
Solo llegaron 4 archivos de todo este set: horizontal oro-sobre-claro,
horizontal oro-sobre-oscuro, simbolo oro-sobre-oscuro, y favicon.svg.
Para la web bastan esos cuatro (cabecera clara/oscura, footer, favicon y
OG). Faltan por recibir: simbolo oro-sobre-claro, ambas tinta-plana, ambas
blanco, y los 4 de vertical/ — pendientes si se necesitan para impresión,
perfiles sociales sobre fondo claro, o la marca vertical.
