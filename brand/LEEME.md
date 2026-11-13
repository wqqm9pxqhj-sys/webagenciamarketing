# AXIONA Systems · Dirección «Sala blanca», en azul

Sustituye a la dirección B «El libro mayor» (tinta y oro) desde el 27 de octubre de 2026.
Los archivos en oro se guardan en `archivo-oro/` solo como referencia. No se usan.

Revisión del 13 de noviembre de 2026: la web pasa del verde menta al azul y la imagen de
marca deja de ser una agenda de bloques para ser una tablet y un móvil de aspecto real.
Los logotipos en menta se guardan en `archivo-menta/` solo como referencia. No se usan.

## Idea
Fondos claros y fríos, pocas tarjetas y mucho aire, y objetos que parecen de verdad. El azul
es el color de la marca. El verde queda para una sola cosa: lo que el sistema llena o recupera.

## Paleta
| Nombre | Hex | Uso |
|---|---|---|
| Tinta | #0D1B33 | Texto principal y botones |
| Blanco | #FFFFFF | Fondo de lectura: la demo, cómo funciona, precios, preguntas |
| Gris azulado | #F1F5FB | Fondo de «Las tres fugas» |
| Azul pálido | #E9F0FA | Fondo del hero y de «Quién está detrás», texto secundario sobre marino |
| Línea | #DBE3EE | Filetes y separadores |
| Texto | #33425C | Párrafos |
| Texto suave | #56637A | Notas y etiquetas |
| Gris de titular | #5F6B82 | Segunda parte de los titulares a dos tonos (4,5:1 sobre cualquier fondo claro) |
| Azul | #1D57C9 | Color de marca. Enlaces, marcas, barra del logotipo sobre claro |
| Azul claro | #8DB8FF | Icono de los botones, foco y barra del logotipo sobre oscuro |
| Marino | #143A7A | Fondo de la calculadora: la única sección de color |
| Marino profundo | #0C1B36 | Cierre de la página (contacto y pie) |
| Azul de garantía | #D9E6FB | Franja de la garantía |
| Verde «recuperado» | #18A574 (#5FE0AD sobre marino) | Solo lo que el sistema llena o recupera |
| Rojo «no vino» | #E0563F | Solo dentro de las pantallas: citas que no se presentan |

Orden de fondos en la home: azul pálido (hero), blanco (demo), gris azulado (las tres fugas),
blanco (cómo funciona), marino (calculadora), blanco (precios), azul de garantía,
azul pálido (quién está detrás), blanco (preguntas) y marino profundo (contacto y pie).

## La tablet y el móvil
La imagen de marca es lo que una clínica tiene sobre el mostrador: una tablet con la agenda
de la semana (5 días por 10 horas) y un móvil con la conversación de WhatsApp.
- Una cita normal es una ficha gris azulada con el tratamiento. No lleva nombres de pacientes.
- Un hueco es una ficha punteada en rojo: «No se presentó» o «Cita cancelada».
- Lo que llena el sistema es una ficha verde: «Lista de espera».
- En la calculadora la tablet enseña el mes: un cuadro por cita, rojo si no vino, verde si se recupera.
- Las conversaciones y la agenda son de ejemplo. El informe del lunes no lleva cifras: son las de cada clínica.
- Luz de estudio, sombra blanda y un reflejo suave en el cristal. Sin brillos de color.

Lo que se ve en las pantallas se dibuja en `/assets/3d/pantallas.js`. Las imágenes fijas de cada
momento están en `/assets/img/hilo-*.webp` y la imagen para compartir en redes es
`/assets/icons/og-image.png`; las dos se regeneran con `herramientas/imagenes-fijas.py`.

## Archivos
- `simbolo/`: el símbolo solo (perfiles sociales, sellos, favicon grande)
- `horizontal/`: cabecera de web y firma de email
- `vertical/`: marca completa, uso principal en impresión
- `favicon/`: 64×64 con fondo marino profundo

Sufijos: `azul-sobre-oscuro` · `azul-sobre-claro` · `tinta-plana` (una tinta) · `blanco` (negativo, sobre marino o fotos)

Sobre oscuro: símbolo #E8EDF6 y barra #8DB8FF.
Sobre claro: símbolo #0D1B33 y barra #1D57C9.

`preview.html` enseña todo el set sobre fondo claro, oscuro y marino.

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
- **Geist Mono** solo en el logotipo (SYSTEMS). En la web ya no se usa.
- Logotipo: AXIONA en Geist 600, capitales, tracking 0,14 em. SYSTEMS a un tercio
  del tamaño, tracking 0,30 em.
- En los SVG de esta carpeta el texto ya está convertido a trazos, así que se ven
  bien sin tener la fuente instalada y pueden ir a imprenta tal cual.
- Archivo web: `/assets/fonts/geist-var.woff2`. Se sirve desde la propia web, sin Google Fonts.

## Cifras
La cifra va grande en Geist 600 y la unidad (€, %, semanas) pequeña a su lado.
Separador de miles siempre con punto, también en cuatro cifras (2.550).
Las cifras no suben solas ni ruedan: aparecen ya escritas.

## Forma y movimiento
- Secciones a todo el ancho, sin tarjetas. La jerarquía la dan el tamaño de la letra,
  los filetes y el cambio de fondo.
- Botón principal: fondo tinta con un cuadrado azul claro y una flecha a la izquierda.
- Lo secundario va plegado (condiciones, qué incluye cada plan, cómo se calcula) y se
  abre al tocar.
- El movimiento explica el producto: la agenda cambia con el scroll y con los números
  de la calculadora. No hay animaciones de entrada repetidas en cada sección.
- Si el dispositivo pide menos movimiento, es lento o no tiene aceleración gráfica,
  se enseñan las imágenes fijas y la página funciona igual.
