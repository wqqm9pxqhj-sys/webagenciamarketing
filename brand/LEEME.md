# AXIONA Systems · Dirección «Sala blanca»

Sustituye a la dirección B «El libro mayor» (tinta y oro) desde el 27 de octubre de 2026.
Los archivos en oro se guardan en `archivo-oro/` solo como referencia. No se usan.

Revisión del 13 de noviembre de 2026: la web deja el marco negro con tarjetas y pasa a
fondos de color a sangre, con la agenda en 3D como imagen de marca.

## Idea
Fondos claros de la familia del menta, pocas tarjetas y mucho aire. El verde menta marca
lo que el sistema llena o recupera. El hueco no se pinta de rojo: se ve porque falta.

## Paleta
| Nombre | Hex | Uso |
|---|---|---|
| Tinta | #0B0B0C | Texto principal, botones, cierre de la página (contacto y pie) |
| Blanco | #FFFFFF | Fondo de lectura: las tres fugas, precios, preguntas |
| Gris claro | #F2F3F1 | Fondo de «Cómo funciona» |
| Línea | #DFE3E0 | Filetes y separadores |
| Texto | #3D413F | Párrafos |
| Texto suave | #5F6562 | Notas y etiquetas |
| Gris de titular | #666E6A | Segunda parte de los titulares a dos tonos (4,5:1 sobre cualquier fondo claro) |
| Menta | #12715F | Color de marca. Fondo de la demo y de la calculadora, enlaces, marcas |
| Menta profundo | #0B2E29 | Burbuja del paciente, campos sobre menta |
| Menta brillante | #3FD1A8 | Bloques que llena el sistema, icono de los botones, franja de la garantía |
| Menta pálido | #E3F5EE | Fondo del hero y de «Quién está detrás», texto secundario sobre menta |

El menta es el único color. No se añade ninguno más.

Orden de fondos en la home: menta pálido (hero), menta (demo), blanco (las tres fugas),
gris claro (cómo funciona), menta (calculadora), blanco (precios), menta brillante (garantía),
menta pálido (quién está detrás), blanco (preguntas) y tinta (contacto y pie).

## La agenda
La imagen de marca es una semana de agenda hecha de bloques: 5 días por 10 horas.
- Un bloque blanco es una cita. Un hueco es un bloque que falta, con el contorno punteado.
- Un bloque menta brillante (#35CFA3 en el 3D) es una cita que ha llenado el sistema.
- Base de la agenda: #C2E3D6 sobre fondos claros y #0E5C4D sobre menta.
- Nada más lleva ese verde: si algo es menta brillante, es porque el sistema lo ha llenado.

Las imágenes fijas de cada momento están en `/assets/img/hilo-*.webp`. La imagen para
compartir en redes es `/assets/icons/og-image.png`.

## Archivos
- `simbolo/`: el símbolo solo (perfiles sociales, sellos, favicon grande)
- `horizontal/`: cabecera de web y firma de email
- `vertical/`: marca completa, uso principal en impresión
- `favicon/`: 64×64 con fondo tinta

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
- Botón principal: fondo tinta con un cuadrado menta brillante y una flecha a la izquierda.
- Lo secundario va plegado (condiciones, qué incluye cada plan, cómo se calcula) y se
  abre al tocar.
- El movimiento explica el producto: la agenda cambia con el scroll y con los números
  de la calculadora. No hay animaciones de entrada repetidas en cada sección.
- Si el dispositivo pide menos movimiento, es lento o no tiene aceleración gráfica,
  se enseñan las imágenes fijas y la página funciona igual.
