# AXIONA Systems · Dirección «Sala blanca»

Sustituye a la dirección B «El libro mayor» (tinta y oro) desde el 27 de octubre de 2026.
Los archivos en oro se guardan en `archivo-oro/` solo como referencia. No se usan.

## Idea
Marco oscuro, tarjetas claras y un solo color, el verde menta. Se usa para lo que
explica cómo se llena un hueco o lo que el cliente recupera. El resto es negro, blanco y gris.

## Paleta
| Nombre | Hex | Uso |
|---|---|---|
| Marco | #0B0B0C | Fondo de la web, texto principal sobre claro |
| Tarjeta | #FFFFFF | Superficies de contenido |
| Tarjeta 2 | #F2F3F1 | Superficies secundarias, campos de formulario |
| Línea | #E3E5E2 | Bordes y separadores |
| Texto | #3D413F | Párrafos |
| Texto suave | #6B706D | Notas y etiquetas (contraste 5:1 sobre blanco) |
| Gris de titular | #8E938F | Segunda parte de los titulares a dos tonos |
| Menta | #12715F | Color de marca. Botones, marcas de lista, tarjetas destacadas |
| Menta profundo | #0B2E29 | Final de los degradados |
| Menta brillante | #3FD1A8 | Barra del logo sobre oscuro y brillos de los degradados |
| Menta pálido | #E3F5EE | Texto sobre menta y fondo del plan Silla Llena |

El menta es el único color. No se añade ninguno más.
El texto pequeño nunca va sobre la zona brillante (#3FD1A8) de un degradado.

## Archivos
- `simbolo/`: el símbolo solo (perfiles sociales, sellos, favicon grande)
- `horizontal/`: cabecera de web y firma de email
- `vertical/`: marca completa, uso principal en impresión
- `favicon/`: 64×64 con fondo marco

Sufijos: `menta-sobre-oscuro` · `menta-sobre-claro` · `tinta-plana` (una tinta) · `blanco` (negativo, sobre menta o fotos)

Sobre oscuro: símbolo #ECEDEB y barra #3FD1A8.
Sobre claro: símbolo #0B0B0C y barra #12715F.

`preview.html` enseña todo el set sobre fondo claro, oscuro y menta.

## Construcción
Rejilla 64×64. La barra mide 6 unidades de alto, va de borde a borde y nunca se
recorta por dentro del área de respeto. El travesaño de la A es la intersección de
la barra con el contrapunzón; no se dibuja aparte. En la versión de una tinta la
barra y la A son del mismo color y se funden, es lo previsto.

## Área de respeto
x = grosor de la barra (6/64 del alto del símbolo). Margen mínimo de 2x por los
cuatro lados. La barra tiene que poder llegar siempre al borde del área.

## Tamaño mínimo
Símbolo: 16 px. Marca horizontal: 16 px de alto de símbolo (unos 80 px de ancho).
Por debajo, solo el símbolo.

## Tipografía
- **Geist** (Vercel, licencia SIL OFL) para todo: titulares en 600 con tracking
  de -0,045 em, texto en 400 y cifras con números tabulares.
- **Geist Mono** solo para etiquetas pequeñas en mayúsculas (tracking 0,12 em).
  Nunca para cifras.
- Logotipo: AXIONA en Geist 600, capitales, tracking 0,14 em. SYSTEMS en Geist
  Mono 500, tracking 0,30 em, a un tercio del tamaño.
- En los SVG de esta carpeta el texto ya está convertido a trazos, así que se ven
  bien sin tener la fuente instalada y pueden ir a imprenta tal cual.
- Archivos web: `/assets/fonts/geist-var.woff2` y `/assets/fonts/geistmono-var.woff2`.
  Se sirven desde la propia web, sin Google Fonts.

## Cifras
La cifra va grande en Geist 600 y la unidad (€, %, semanas) pequeña y en gris
a su lado. Separador de miles siempre con punto, también en cuatro cifras (2.550).

## Forma y movimiento
- Tarjetas con esquinas de 28 px (20 px las interiores) sobre el marco oscuro, con
  12 px de separación.
- Botón principal: fondo claro con un cuadrado negro y una flecha a la izquierda.
- Animaciones solo con transform y opacidad, curva `cubic-bezier(0.23, 1, 0.32, 1)`.
  Se reproducen una vez, nunca en bucle, y se reducen a fundidos si el dispositivo
  pide menos movimiento.
