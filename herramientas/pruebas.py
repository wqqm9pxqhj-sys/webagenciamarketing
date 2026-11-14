"""Pruebas de extremo a extremo de la web (home y páginas legales).

Uso, desde la raíz del repositorio:
    npx serve -l 4173 .            # en otra terminal
    python3 herramientas/pruebas.py

Comprueba, a 375, 768, 1024 y 1440 px: desbordes, texto pequeño, zonas táctiles,
errores de consola y enlaces rotos. Después recorre la historia con el 3D, la
calculadora con valores raros (vacío, 0, enormes, texto), los dos formularios con
el envío simulado, el menú del móvil, el banner de cookies y los modos sin 3D
(imágenes fijas, movimiento reducido y sin JavaScript).

Necesita Playwright para Python. La redirección de /calculadora solo existe en
Vercel (vercel.json), así que aquí no se prueba.
"""
import json, sys, urllib.parse
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
LOCAL = '127.0.0.1' in B
fails = []; ok = 0
def check(cond, msg):
    global ok
    if cond: ok += 1
    else: fails.append('FAIL ' + msg)
CONSENT = {'name': 'axiona_consent', 'value': urllib.parse.quote(json.dumps({"necesarias": True, "analiticas": False, "marketing": False, "version": "1.0"})), 'url': B}
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PAGES = ['/', '/aviso-legal', '/politica-privacidad', '/politica-cookies']
def page(b, w=1440, h=900, consent=True, **kw):
    ctx = b.new_context(viewport={'width': w, 'height': h}, **kw)
    if consent: ctx.add_cookies([CONSENT])
    # the local server has no functions: the assistant is "not switched on" unless a test says otherwise
    ctx.route('**/api/ayuda', lambda r: r.fulfill(status=200, content_type='application/json', body='{"ok":false}'))
    pg = ctx.new_page(); pg.errs = []
    _goto = pg.goto
    def goto(url, **kw):
        # a load that never goes idle should not sink the whole run: fall back to the load event
        try: return _goto(url, **dict(kw, timeout=15000))
        except Exception: return _goto(url, wait_until='load', timeout=30000)
    pg.goto = goto
    pg.on('pageerror', lambda e: pg.errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'GL Driver' not in m.text else None)
    return ctx, pg
def jump(pg, sel, off=0):
    pg.evaluate('([sel, off]) => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + scrollY + off); }', [sel, off]); pg.wait_for_timeout(500)
fig = lambda pg: pg.inner_text('#out-fuga-anual').replace('\n', '').replace(' ', ' ')
def typ(pg, sel, val, blur=True):
    pg.fill(sel, val)
    if blur: pg.locator(sel).blur()
    pg.wait_for_timeout(60)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)

    # ---- every page at four widths: overflow, small text, tap targets, errors, broken resources and links
    for w in [375, 768, 1024, 1440]:
        ctx, pg = page(b, w, 900, has_touch=w < 900, is_mobile=w < 900)
        bad = []; pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
        for path in PAGES:
            pg.goto(B + path + ('?3d=0' if path == '/' else ''), wait_until='networkidle'); pg.wait_for_timeout(300)
            check(pg.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0, f'{w}px {path} sin scroll horizontal')
            small = pg.evaluate('''() => [...document.querySelectorAll('p,li,span,a,label,dt,button,summary,b,small')].filter(e => e.offsetParent && !e.closest('.logo') && [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.innerText.slice(0, 24) + ':' + getComputedStyle(e).fontSize)''')
            check(not small, f'{w}px {path} sin texto menor de 12 px {small[:4]}')
            if w == 375:
                tiny = pg.evaluate('''() => [...document.querySelectorAll('a.btn,button,summary,input:not([type=hidden]):not([type=checkbox]),select')].filter(e => e.offsetParent && !e.closest('[inert]')).filter(e => e.getBoundingClientRect().height < 40).map(e => (e.innerText || e.id || e.name || e.className).slice(0, 24) + ':' + Math.round(e.getBoundingClientRect().height))''')
                check(not tiny, f'375px {path} zonas táctiles de 40 px o más {tiny[:6]}')
            for href in set(pg.evaluate('''[...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href'))''')):
                r = pg.request.get(B + href.split('#')[0]); check(r.status == 200, f'enlace {href} desde {path} da {r.status}')
        check(not pg.errs, f'{w}px sin errores de consola {pg.errs[:3]}'); check(not bad, f'{w}px sin recursos rotos {sorted(set(bad))[:4]}')
        ctx.close()

    # ---- anchors, mailto, structure
    ctx, pg = page(b); pg.goto(B + '/?3d=0', wait_until='networkidle')
    home_ids = set(pg.evaluate('[...document.querySelectorAll("[id]")].map(e => e.id)'))
    for a in set(pg.evaluate('''[...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1))''')):
        check(a in home_ids, f'ancla #{a} existe en la home')
    for path in PAGES[1:]:
        pg2 = ctx.new_page(); pg2.goto(B + path, wait_until='networkidle')
        for a in set(pg2.evaluate('''[...document.querySelectorAll('a[href^="/#"]')].map(a => a.getAttribute('href').slice(2))''')):
            check(a in home_ids, f'ancla /#{a} (desde {path}) existe en la home')
        check(pg2.locator('h1').count() == 1 and pg2.locator('.legal-content h2').count() >= 4, f'{path} conserva su contenido legal')
        pg2.close()
    calls = pg.evaluate('[...document.querySelectorAll("a[data-call]")].map(a => a.href)')
    q = urllib.parse.urlparse(calls[0]); qs = urllib.parse.parse_qs(q.query)
    check(len(calls) >= 6 and len(set(calls)) == 1 and q.scheme == 'mailto' and q.path == 'ceo@axionasystems.es' and qs['subject'][0] == 'Quiero hablar de mi clínica' and qs['body'][0].startswith('Hola Hugo'), f'«Pide una llamada» abre el email ya escrito ({len(calls)} botones)')
    check(pg.locator('h1').count() == 1, 'un solo h1')
    heads = pg.evaluate('[...document.querySelectorAll("main h1, main h2, main h3")].map(h => +h.tagName[1])')
    check(all(b_ - a_ <= 1 for a_, b_ in zip(heads, heads[1:])), 'jerarquía de titulares sin saltos')
    for m in pg.evaluate('''[...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent)'''): json.loads(m)
    check(True, 'datos estructurados válidos')
    check(pg.get_attribute('link[rel=canonical]', 'href') == 'https://axionasystems.es/', 'canonical de la home')
    ctx.close()

    # ---- story with live 3D on desktop: navigation, leaks, weeks, FAQ, keyboard
    ctx, pg = page(b); pg.goto(B + '/?3d=1', wait_until='networkidle'); pg.wait_for_timeout(2500)
    check('story-on' in pg.evaluate('document.documentElement.className') and 'live3d' in pg.evaluate('document.documentElement.className'), 'historia y 3D activos en escritorio')
    idle = pg.evaluate('''() => new Promise(res => { let n = 0; const mo = new MutationObserver(m => { n += m.length; }); mo.observe(document.documentElement, { attributes: true, subtree: true, childList: true }); setTimeout(() => { mo.disconnect(); res(n); }, 1500); })''')
    check(idle == 0, f'con el 3D en marcha, el hilo principal queda en reposo ({idle} cambios en 1,5 s)')
    pg.click('.nav-links a[href="#precios"]'); pg.wait_for_timeout(1900)
    top = pg.evaluate('document.querySelector("#precios h2").getBoundingClientRect().top'); navb = pg.evaluate('document.getElementById("nav").getBoundingClientRect().bottom')
    check(navb - 2 <= top < 500, f'el menú lleva a Precios sin taparlo (titular a {round(top)} px)')
    pg.click('.nav-links a[href="#calculadora"]'); pg.wait_for_timeout(1900)
    r = pg.evaluate('document.getElementById("calc-title").getBoundingClientRect().top'); check(navb - 2 <= r < 500, f'el menú lleva a la calculadora (titular a {round(r)} px)')
    pg.click('.nav-links a[href="#como-funciona"]'); pg.wait_for_timeout(1900)
    check(pg.evaluate('getComputedStyle(document.querySelector("#como-funciona .act-text")).opacity') == '1' and pg.locator('.step.is-on').count() == 1, 'el menú lleva a Cómo funciona con su texto visible')
    pg.click('.step:nth-child(3) .step-trigger'); pg.wait_for_timeout(1500)
    check(pg.evaluate('document.querySelector(".step:nth-child(3)").classList.contains("is-on")'), 'pulsar «Semana 3» lleva a ese paso')
    jump(pg, '#sistemas', 40); pg.click('#leak-btn-3'); pg.wait_for_timeout(1500)
    check(pg.get_attribute('#leak-btn-3', 'aria-expanded') == 'true' and pg.get_attribute('#leak-btn-1', 'aria-expanded') == 'false' and pg.is_visible('#leak-panel-3 p'), 'pulsar la fuga 3 la abre y cierra las otras')
    jump(pg, '#demo', 40); pg.wait_for_timeout(300); n0 = pg.locator('.chat li.on').count(); pg.mouse.wheel(0, 520); pg.wait_for_timeout(1300); n1 = pg.locator('.chat li.on').count()
    check(n0 <= 1 and n1 >= 4, f'los mensajes de WhatsApp aparecen al bajar ({n0} → {n1})')
    y0 = pg.evaluate('scrollY'); pg.mouse.wheel(0, 3000); pg.wait_for_timeout(1500); y1 = pg.evaluate('scrollY')
    check(y1 - y0 > 2500, f'el scroll no se queda atrapado ({round(y1 - y0)} px de 3000)')
    # a native jump landing right as a wheel animation ends used to leave the smooth scroll out of step
    jump(pg, '#como-funciona', 40); pg.click('.trust a'); pg.wait_for_timeout(1900)
    d = (pg.get_attribute('#faq-btn-4', 'aria-expanded'), round(pg.evaluate('document.getElementById("faq-datos").getBoundingClientRect().top')), round(pg.evaluate('scrollY')))
    check(d[0] == 'true' and 0 <= d[1] < 700, f'«Qué datos usamos» abre esa pregunta {d}')
    btn = pg.locator('#faq-btn-2'); btn.click(); pg.wait_for_timeout(350)
    check(btn.get_attribute('aria-expanded') == 'true' and pg.evaluate('!document.querySelector("#faq-panel-2 .faq-panel-inner").inert'), 'las preguntas se abren')
    btn.press('Enter'); pg.wait_for_timeout(350); check(btn.get_attribute('aria-expanded') == 'false', 'y se cierran con teclado')
    check(not pg.errs, f'historia sin errores {pg.errs[:3]}')
    ctx.close()
    ctx, pg = page(b); pg.goto(B + '/', wait_until='networkidle'); pg.keyboard.press('Tab')
    check(pg.evaluate('document.activeElement.className') == 'skip-link', 'el primer Tab va a «Saltar al contenido»')
    pg.keyboard.press('Tab'); check(pg.evaluate('getComputedStyle(document.activeElement).outlineStyle') != 'none', 'foco visible con teclado')
    ctx.close()

    # ---- calculator, with odd values
    for tag, w, h in [('escritorio', 1440, 900), ('móvil', 375, 700)]:
        ctx, pg = page(b, w, h, has_touch=w < 900, is_mobile=w < 900); pg.goto(B + '/?3d=1', wait_until='networkidle'); pg.wait_for_timeout(1200); jump(pg, '#calculadora', 120 if w > 900 else 260)
        check(fig(pg) == '30.600', f'{tag}: valor de ejemplo 30.600 € ({fig(pg)})')
        typ(pg, '#input-citas', '300'); typ(pg, '#input-tasa', '20'); typ(pg, '#input-ticket', '100')
        check(fig(pg) == '72.000' and pg.inner_text('#out-fuga-mes').replace(' ', ' ') == '6.000 €' and pg.inner_text('#out-citas-perdidas') == '60', f'{tag}: 300 × 20 % × 100 € = 72.000 € al año ({fig(pg)})')
        check(pg.inner_text('#out-rec-mes').replace(' ', ' ') == '5.010 €', f'{tag}: recuperable 5.010 € al mes ({pg.inner_text("#out-rec-mes")})')
        check(not pg.is_visible('#calc-example-note'), f'{tag}: la nota de ejemplo desaparece al tocar')
        typ(pg, '#input-citas', ''); check(pg.input_value('#input-citas') == '200', f'{tag}: campo vacío vuelve al valor de ejemplo')
        typ(pg, '#input-citas', '0'); check(pg.input_value('#input-citas') == '20', f'{tag}: 0 citas se queda en el mínimo (20)')
        typ(pg, '#input-tasa', '0'); check(pg.input_value('#input-tasa') == '1', f'{tag}: 0 % se queda en el mínimo (1 %)')
        typ(pg, '#input-ticket', '0'); check(pg.input_value('#input-ticket') == '30', f'{tag}: 0 € se queda en el mínimo (30 €)')
        check(fig(pg) == '72' and pg.is_visible('#calc-recover-low'), f'{tag}: mínimos dan 72 € y aviso de fuga pequeña ({fig(pg)})')
        typ(pg, '#input-citas', '99999999999999'); typ(pg, '#input-tasa', '1e9'); typ(pg, '#input-ticket', '5000000')
        check(pg.input_value('#input-citas') == '1000' and pg.input_value('#input-tasa') == '40' and pg.input_value('#input-ticket') == '500', f'{tag}: números enormes se quedan en el máximo')
        check(fig(pg) == '2.400.000', f'{tag}: máximos dan 2.400.000 € ({fig(pg)})')
        check(pg.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0 and pg.evaluate('(() => { const f = document.querySelector(".calc-figure"); return f.scrollWidth <= f.parentElement.clientWidth + 1; })()'), f'{tag}: la cifra máxima cabe sin desbordar')
        typ(pg, '#input-citas', '-50'); check(pg.input_value('#input-citas') == '20', f'{tag}: negativo se queda en el mínimo')
        typ(pg, '#input-citas', 'abc'); check(pg.input_value('#input-citas') == '200', f'{tag}: texto vuelve al valor de ejemplo')
        typ(pg, '#input-citas', '1.000'); check(pg.input_value('#input-citas') == '1000', f'{tag}: «1.000» se lee como mil')
        typ(pg, '#input-ticket', '85,5'); check(pg.input_value('#input-ticket') in ('86', '85'), f'{tag}: «85,5» se acepta ({pg.input_value("#input-ticket")})')
        typ(pg, '#input-tasa', '12,5 %'); check(pg.input_value('#input-tasa') in ('12', '13'), f'{tag}: «12,5 %» se acepta ({pg.input_value("#input-tasa")})')
        typ(pg, '#input-citas', '<script>alert(1)</script>'); check(pg.input_value('#input-citas') == '200', f'{tag}: código pegado se ignora')
        pg.fill('#input-citas', '450'); pg.wait_for_timeout(80); check(pg.input_value('#slider-citas') == '450', f'{tag}: el deslizador sigue lo que se escribe')
        pg.evaluate('(() => { const s = document.getElementById("slider-tasa"); s.value = 25; s.dispatchEvent(new Event("input", { bubbles: true })); })()'); pg.wait_for_timeout(80)
        check(pg.input_value('#input-tasa') == '25', f'{tag}: el campo sigue al deslizador')
        pg.click('[data-mode="recupera"]'); pg.wait_for_timeout(300)
        check(pg.get_attribute('[data-mode="recupera"]', 'aria-pressed') == 'true' and pg.evaluate('document.documentElement.dataset.calcMode') == 'recupera', f'{tag}: cambia a «Lo que se recupera»')
        check(pg.inner_text('#calc-live-figure').replace(' ', ' ').endswith('€'), f'{tag}: cifra junto a la agenda')
        # report request
        sent = {}
        def ok_route(route):
            sent['url'] = route.request.url; sent['body'] = json.loads(route.request.post_data); route.fulfill(status=200, content_type='application/json', body='{"success":"true"}')
        pg.route('https://formsubmit.co/**', ok_route)
        check(pg.is_visible('#sector-text') and pg.is_visible('#calc-email') and pg.locator('.measured li').count() == 3, f'{tag}: comparativa con el sector y «te calculo las tres fugas» a la vista, sin desplegar')
        pg.locator('#calc-submit-btn').scroll_into_view_if_needed(); pg.click('#calc-submit-btn'); pg.wait_for_timeout(200)
        check(not sent and 'email' in pg.inner_text('#calc-form-status'), f'{tag}: el informe no se envía sin email ni casilla')
        pg.fill('#calc-email', 'no-es-un-email'); pg.check('#calc-consent'); pg.click('#calc-submit-btn'); pg.wait_for_timeout(200); check(not sent, f'{tag}: email mal escrito no se envía')
        pg.fill('#calc-email', 'a@b.es'); pg.fill('#calc-pacientes', '99999999999999999999'); pg.click('#calc-submit-btn'); pg.wait_for_timeout(500)
        check(sent.get('url', '').endswith('ceo@axionasystems.es') and sent['body'].get('citas_al_mes') == '450' and sent['body'].get('tasa_ausencias') == '25 %' and sent['body'].get('consultas_mes') == 'no facilitado', f'{tag}: el informe se envía a ceo@ con los datos de la calculadora {sent.get("body", {}).get("fuga_anual")}')
        check(pg.is_visible('#calc-form-success'), f'{tag}: mensaje de enviado')
        check(not pg.errs, f'{tag}: calculadora sin errores {pg.errs[:3]}')
        ctx.close()

    # ---- contact form (inside its disclosure)
    ctx, pg = page(b); pg.goto(B + '/?3d=0', wait_until='networkidle'); sent = {}
    def ok2(route):
        sent['url'] = route.request.url; sent['body'] = json.loads(route.request.post_data); route.fulfill(status=200, content_type='application/json', body='{"success":"true"}')
    pg.route('https://formsubmit.co/**', ok2); jump(pg, '#contacto', -40)
    check(not pg.is_visible('#leadForm'), 'el formulario está plegado al llegar')
    pg.click('#form-details summary'); pg.wait_for_timeout(300); check(pg.is_visible('#f-name'), 'se despliega al pulsar')
    pg.click('#leadForm button[type=submit]'); pg.wait_for_timeout(200); check('Rellena' in pg.inner_text('#formMsg') and not sent, 'vacío no se envía y avisa')
    pg.fill('#f-name', '   '); pg.fill('#f-clinic', 'x'); pg.fill('#f-phone', '0'); pg.fill('#f-email', 'mal@'); pg.click('#leadForm button[type=submit]'); pg.wait_for_timeout(200); check(not sent, 'email mal escrito no se envía')
    pg.fill('#f-name', 'Ana ' * 300); pg.fill('#f-clinic', '<b>Clínica & Sol</b>'); pg.fill('#f-phone', '0'); pg.fill('#f-email', 'ana@sol.es'); pg.select_option('#f-volume', index=2)
    pg.click('#leadForm button[type=submit]'); pg.wait_for_timeout(500)
    check(sent.get('url', '').endswith('ceo@axionasystems.es') and sent['body']['clinica'] == '<b>Clínica & Sol</b>' and sent['body']['telefono'] == '0' and sent['body']['citas_al_mes'] == 'Entre 50 y 150', 'se envía a ceo@ con los datos tal cual')
    check('Recibido' in pg.inner_text('#formMsg') and pg.inner_text('#leadForm button[type=submit]') == 'Enviado', 'mensaje de recibido')
    ctx.close()
    ctx, pg = page(b); pg.route('https://formsubmit.co/**', lambda r: r.fulfill(status=500, body='{"message":"Server Error"}')); pg.goto(B + '/?3d=0', wait_until='networkidle'); jump(pg, '#contacto', -40); pg.click('#form-details summary')
    pg.fill('#f-name', 'T'); pg.fill('#f-clinic', 'C'); pg.fill('#f-phone', '6'); pg.fill('#f-email', 'a@b.es'); pg.select_option('#f-volume', index=1); pg.click('#leadForm button[type=submit]'); pg.wait_for_timeout(500)
    check('No he podido confirmar' in pg.inner_text('#formMsg') and pg.is_enabled('#leadForm button[type=submit]'), 'si el envío falla, lo dice y deja reintentar')
    pg.click('.copy-btn'); pg.wait_for_timeout(200); check(pg.inner_text('.copy-btn') in ('Copiado', 'Copiar'), 'botón de copiar el email')
    ctx.close()

    # ---- phone: menu, nav behaviour, story fit
    ctx, pg = page(b, 375, 700, has_touch=True, is_mobile=True); pg.goto(B + '/?3d=1', wait_until='networkidle'); pg.wait_for_timeout(1500)
    pg.click('#navToggle'); pg.wait_for_timeout(300); check(pg.is_visible('#mobilePanel a[href="#precios"]') and pg.get_attribute('#navToggle', 'aria-expanded') == 'true', 'móvil: el menú se abre')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); check(pg.get_attribute('#navToggle', 'aria-expanded') == 'false', 'móvil: se cierra con Escape')
    pg.click('#navToggle'); pg.wait_for_timeout(250); pg.click('#mobilePanel a[href="#preguntas"]'); pg.wait_for_timeout(1800)
    check(pg.get_attribute('#navToggle', 'aria-expanded') == 'false' and 0 <= pg.evaluate('document.getElementById("preguntas").getBoundingClientRect().top') < 200, 'móvil: el menú lleva a Preguntas y se cierra')
    for i, name in [(1, 'demo'), (2, 'fugas'), (3, 'semanas')]:
        pg.evaluate('''(i) => { document.documentElement.style.scrollBehavior = 'auto'; const a = document.querySelectorAll('[data-act]')[i]; window.scrollTo(0, a.getBoundingClientRect().top + scrollY + a.offsetHeight * 0.4); }''', i); pg.wait_for_timeout(900)
        fit = pg.evaluate('''(i) => { const a = document.querySelectorAll('[data-act]')[i], t = a.querySelector('.act-text'), s = a.querySelector('[data-slot]'); const tr = t.getBoundingClientRect(), sr = s.getBoundingClientRect(); return { bottom: Math.round(tr.bottom), vh: innerHeight, clip: t.scrollHeight - t.clientHeight, slot: Math.round(sr.height), gap: Math.round(tr.top - sr.bottom) }; }''', i)
        check(fit['bottom'] <= fit['vh'] + 1 and fit['slot'] >= 100 and fit['gap'] >= 0 and (fit['clip'] <= 1 or i == 1), f'móvil pequeño: «{name}» cabe en pantalla {fit}')
    check(not pg.errs, f'móvil sin errores {pg.errs[:3]}')
    ctx.close()

    # ---- help assistant (the server side is simulated here; herramientas/prueba-ayuda.mjs covers the function)
    asked = []
    def ayuda(route):
        if route.request.method == 'GET': route.fulfill(status=200, content_type='application/json', body='{"ok":true}')
        else:
            asked.append(json.loads(route.request.post_data)); route.fulfill(status=200, content_type='application/json', body=json.dumps({"ok": True, "text": "Desde 690 € al mes. Si quieres la cifra exacta, escribe a ceo@axionasystems.es."}))
    ctx, pg = page(b); pg.goto(B + '/?3d=0', wait_until='networkidle'); pg.wait_for_timeout(1500)
    check(pg.locator('#ayudaBtn').count() == 0 and not pg.errs, f'asistente sin clave en el servidor: el botón no aparece y no hay errores {pg.errs[:3]}')
    pg.wait_for_selector('img.hero-full.on', timeout=8000)
    same = pg.evaluate('(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(); }; return r(document.getElementById("heroPoster")) === r(document.querySelector("img.hero-full")); })()')
    check(same, 'sin 3D: la agenda llena del hero cae exactamente encima de la agenda con huecos')
    ctx.close()
    ctx, pg = page(b); pg.route('**/api/ayuda', ayuda); pg.goto(B + '/?3d=0', wait_until='networkidle'); pg.wait_for_selector('#ayudaBtn', timeout=5000)
    check(pg.is_visible('#ayudaBtn') and pg.locator('#ayudaPanel').count() == 0, 'asistente: botón a la vista y ventana sin crear hasta que se pide')
    pg.click('#ayudaBtn'); pg.wait_for_timeout(400)
    check(pg.is_visible('#ayudaPanel') and pg.get_attribute('#ayudaBtn', 'aria-expanded') == 'true' and 'automático' in pg.inner_text('.ayuda-list'), 'asistente: se abre y se presenta como automático')
    pg.fill('#ayudaInput', '¿Cuánto cuesta?'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check(len(asked) == 1 and asked[0]['messages'] == [{'role': 'user', 'content': '¿Cuánto cuesta?'}], 'asistente: envía la pregunta')
    check('Desde 690' in pg.inner_text('.ayuda-msg.bot >> nth=1') and pg.locator('.ayuda-msg.bot a[href="mailto:ceo@axionasystems.es"]').count() == 1, 'asistente: enseña la respuesta y enlaza el correo')
    pg.fill('#ayudaInput', '<img src=x onerror=alert(1)> y la garantía'); pg.click('.ayuda-form button'); pg.wait_for_timeout(500)
    check(len(asked) == 2 and len(asked[1]['messages']) == 3 and pg.locator('.ayuda-list img').count() == 0, 'asistente: mantiene la conversación y trata lo escrito como texto')
    pg.fill('#ayudaInput', '   '); pg.keyboard.press('Enter'); pg.wait_for_timeout(200); check(len(asked) == 2, 'asistente: no envía preguntas vacías')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check(not pg.is_visible('#ayudaPanel') and pg.evaluate('document.activeElement.id') == 'ayudaBtn', 'asistente: Escape lo cierra y devuelve el foco')
    check(not pg.errs, f'asistente sin errores {pg.errs[:3]}')
    ctx.close()
    def caido(route):
        if route.request.method == 'GET': route.fulfill(status=200, content_type='application/json', body='{"ok":true}')
        else: route.fulfill(status=502, content_type='application/json', body='{"ok":false,"error":"upstream"}')
    ctx, pg = page(b, 375, 700, has_touch=True, is_mobile=True); pg.route('**/api/ayuda', caido); pg.goto(B + '/?3d=0', wait_until='networkidle'); pg.wait_for_selector('#ayudaBtn', timeout=5000)
    pg.click('#ayudaBtn'); pg.wait_for_timeout(400); pg.click('.ayuda-suggest button >> nth=0'); pg.wait_for_timeout(600)
    box = pg.evaluate('(() => { const r = document.getElementById("ayudaPanel").getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })()')
    check(box[0] >= 0 and box[1] >= 0 and box[2] <= 375 and box[3] <= 700, f'asistente en móvil: la ventana cabe en pantalla {box}')
    check('Ahora mismo no puedo responder' in pg.inner_text('.ayuda-list') and pg.is_disabled('#ayudaInput') and pg.locator('.ayuda-call').get_attribute('href').startswith('mailto:ceo@axionasystems.es?subject='), 'asistente caído a media conversación: lo dice y ofrece el correo y la llamada')
    ctx.close()

    # ---- internal tool (not linked, not indexed): same sums as the public calculator and the email with the three leaks
    ctx, pg = page(b); pg.goto(B + '/interno/calculo', wait_until='networkidle')
    for k, v in (('nombre', 'Marta'), ('citas', '200'), ('tasa', '15'), ('ticket', '85'), ('pacientes', '900'), ('consultas', '40')): pg.fill('#f-' + k, v)
    pg.wait_for_timeout(200)
    check(pg.inner_text('#out-fuga1-mes').replace('\n', '') == '2.550€' and pg.inner_text('#out-rec1') == '1.989 €' and pg.inner_text('#out-total-mes') == '3.315 €', 'herramienta interna: 200 citas, 15 % y 85 € dan 2.550 € de fuga, 1.989 € recuperables y 3.315 € con las tres fugas')
    check('variante A' in pg.inner_text('#email-variant-label') and pg.input_value('#emailOutput').startswith('Asunto: Tus tres fugas suman 3.315 € al mes') and 'Hola Marta,' in pg.input_value('#emailOutput'), 'herramienta interna: genera el email completo')
    check('noindex' in pg.get_attribute('meta[name="robots"]', 'content') and pg.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0 and pg.evaluate('document.querySelector(".nav").getBoundingClientRect().top') == 0 and not pg.errs, f'herramienta interna: sin indexar, sin desbordes y sin errores {pg.errs[:3]}')
    ctx.close()

    # ---- cookie banner on a first visit
    ctx, pg = page(b, 375, 700, consent=False, has_touch=True, is_mobile=True); pg.goto(B + '/', wait_until='networkidle'); pg.wait_for_timeout(600)
    check(pg.is_visible('#cookieBanner'), 'banner de cookies en la primera visita')
    cta = pg.evaluate('document.querySelector(".act-hero .btn").getBoundingClientRect().bottom'); ban = pg.evaluate('document.getElementById("cookieBanner").getBoundingClientRect().top')
    check(cta <= ban, f'el banner no tapa el botón principal (botón acaba en {round(cta)}, banner empieza en {round(ban)})')
    pg.click('#cookieBanner [data-action="reject"]'); pg.wait_for_timeout(250); check(not pg.is_visible('#cookieBanner'), 'rechazar lo cierra')
    pg.evaluate('document.querySelector("[data-cookie-settings]").scrollIntoView()'); pg.click('[data-cookie-settings]'); pg.wait_for_timeout(250); check(pg.is_visible('#cookieModalBackdrop'), '«Configurar cookies» abre el panel')
    ctx.close()

    # ---- without the 3D: stills, reduced motion, no JavaScript
    ctx, pg = page(b); pg.goto(B + '/?3d=0', wait_until='networkidle'); pg.wait_for_timeout(1500)
    cls = pg.evaluate('document.documentElement.className')
    check('story-on' in cls and 'live3d' not in cls and 'flat-calc' in cls and pg.locator('#calcGrid i').count() == 200, 'sin 3D: historia con imágenes fijas y rejilla plana de 200 citas')
    check(pg.locator('img.hero-full.on').count() == 1, 'sin 3D: el hero pasa a la agenda ya llena')
    jump(pg, '#calculadora', 100); typ(pg, '#input-tasa', '40'); pg.click('[data-mode="recupera"]'); pg.wait_for_timeout(200)
    check(pg.locator('#calcGrid i.back').count() > 0 and pg.locator('#calcGrid i.lost').count() + pg.locator('#calcGrid i.back').count() == 80, 'sin 3D: la rejilla plana reacciona a los números')
    ctx.close()
    ctx, pg = page(b); pg.goto(B + '/', wait_until='networkidle'); pg.wait_for_timeout(2500)
    cls = pg.evaluate('document.documentElement.className')
    check('live3d' not in cls and 'flat-calc' in cls, 'sin aceleración gráfica (este navegador de pruebas): se queda en imágenes fijas por sí solo')
    idle = pg.evaluate('''() => new Promise(res => { let n = 0; const mo = new MutationObserver(m => { n += m.length; }); mo.observe(document.documentElement, { attributes: true, subtree: true, childList: true }); setTimeout(() => { mo.disconnect(); res(n); }, 1500); })''')
    check(idle == 0, f'en reposo la página no hace nada ({idle} cambios en 1,5 s)')
    check(not pg.errs, f'sin errores {pg.errs[:3]}')
    ctx.close()
    ctx, pg = page(b, reduced_motion='reduce'); pg.goto(B + '/', wait_until='networkidle'); pg.wait_for_timeout(800)
    cls = pg.evaluate('document.documentElement.className')
    check('story-on' not in cls and pg.evaluate('getComputedStyle(document.querySelector(".stage")).display') == 'none', 'movimiento reducido: sin historia ni 3D')
    check(pg.locator('.chat li').evaluate_all('els => els.every(e => getComputedStyle(e).opacity === "1" && e.offsetParent)') and pg.locator('.leak.is-open').count() == 3 and pg.locator('.step.is-on').count() == 4, 'movimiento reducido: todo el contenido a la vista')
    check('hilo-hero-lleno' in pg.evaluate('document.getElementById("heroPoster").currentSrc'), 'movimiento reducido: el hero enseña la agenda llena')
    pg.click('#leak-btn-2'); pg.wait_for_timeout(350); check(pg.get_attribute('#leak-btn-2', 'aria-expanded') == 'false', 'movimiento reducido: las fugas se pliegan al pulsar')
    check(not pg.errs, f'movimiento reducido sin errores {pg.errs[:3]}')
    ctx.close()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, java_script_enabled=False); ctx.add_cookies([CONSENT]); pg = ctx.new_page(); pg.goto(B + '/', wait_until='load')
    vis = pg.locator('#faq-panel-3 p').is_visible() and pg.locator('.chat li').first.is_visible() and pg.locator('#leak-panel-2 p').is_visible() and pg.locator('.price-amount').first.is_visible() and pg.locator('#out-fuga-anual').is_visible()
    check(vis, 'sin JavaScript: mensajes, fugas, precios, cifra de ejemplo y respuestas a la vista')
    check(pg.locator('.act-hero img').is_visible(), 'sin JavaScript: imagen fija en el hero')
    ctx.close()
    b.close()
print('\n'.join(fails) or 'NO FAILS'); print(ok, 'comprobaciones OK')
