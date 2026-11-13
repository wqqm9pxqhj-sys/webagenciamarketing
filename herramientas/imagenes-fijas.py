"""Genera las imágenes fijas de la agenda 3D (assets/img/hilo-*.webp).

Son las que se ven mientras carga el 3D y las que se quedan cuando no hay 3D
(móvil lento, sin aceleración gráfica o con «reducir movimiento»). Hay que
regenerarlas cada vez que cambie assets/3d/escena.js.

Uso, desde la raíz del repositorio:
    npx serve -l 4173 .            # en otra terminal
    python3 herramientas/imagenes-fijas.py

Necesita Playwright para Python (pip install playwright && playwright install chromium).
Cada imagen se dibuja con la escena real, con fondo transparente y el objeto ocupando el
72 % central; su proporción es la del encuadre de cada momento, y por eso encajan justo
donde luego aparece el 3D.
"""
import base64, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img')
# nombre, momento (k), avance (t), móvil, ancho y alto finales en píxeles, parámetros extra
JOBS = [
 ('hilo-hero-d', 0, 0, 0, 1400, 950, '&time=0'), ('hilo-hero-m', 0, 0, 1, 920, 804, '&time=0'),
 ('hilo-hero-lleno-d', 0, 0, 0, 1400, 950, '&time=99'), ('hilo-hero-lleno-m', 0, 0, 1, 920, 804, '&time=99'),
 ('hilo-demo-d', 1, 0.36, 0, 1400, 1041, '&time=99'), ('hilo-demo-m', 1, 0.36, 1, 920, 710, '&time=99'),
 ('hilo-fugas-d', 2, 0.26, 0, 1040, 1216, '&time=99'), ('hilo-fugas-m', 2, 0.26, 1, 920, 1076, '&time=99'),
 ('hilo-semanas-d', 3, 0.44, 0, 1800, 698, '&time=99'), ('hilo-semanas-m', 3, 0.44, 1, 920, 678, '&time=99'),
 ('hilo-calc-d', 4, 0, 0, 1400, 988, '&time=99'), ('hilo-calc-m', 4, 0, 1, 920, 1048, '&time=99'),
]

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    enc = b.new_page()
    for name, k, t, m, W, H, extra in JOBS:
        pg = b.new_page(viewport={'width': W // 2, 'height': H // 2}, device_scale_factor=2)
        pg.goto(f'{BASE}/herramientas/escena-prueba.html#k={k}&t={t}&m={m}&dpr=2&sinfondo=1&reg=0.5,0.5,0.72,0.72{extra}', wait_until='networkidle')
        pg.wait_for_function('window.__ready === true', timeout=20000); pg.wait_for_timeout(2500)
        state = pg.evaluate('window.__state')
        assert state and state['k'] == k, f'{name}: la página de prueba no ha recibido los parámetros ({state})'
        png = pg.screenshot(omit_background=True); pg.close()
        data = enc.evaluate("""async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return [c.toDataURL('image/webp', 0.86), c.width, c.height]; }""", base64.b64encode(png).decode())
        webp = base64.b64decode(data[0].split(',')[1])
        open(os.path.join(DEST, name + '.webp'), 'wb').write(webp)
        print(name, data[1], 'x', data[2], round(len(webp) / 1024), 'KB')
    b.close()
