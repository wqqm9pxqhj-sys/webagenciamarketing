// Home page: the scroll story (ground colour, pinned text, 3D agenda in a worker), the calculator
// and a few small interactions. Shared bits (mobile menu, mailto, FAQ, contact form) live in axiona.js.
(function () {
  'use strict';
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  let lenis = null;
  // ?3d=1 keeps the 3D on even if the device measures slow, ?3d=0 forces the stills (both for testing)
  const force = (location.search.match(/[?&]3d=([01])/) || [])[1];

  // ---------- nav: solid once the page moves; on small screens it steps aside while reading down ----------
  const nav = $('nav'), panel = $('mobilePanel');
  let lastY = window.scrollY;
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('is-solid', y > 12);
    if (y < 320 || y < lastY - 6 || panel.classList.contains('open')) nav.classList.remove('is-hidden');
    else if (y > lastY + 6 && innerWidth <= 900) nav.classList.add('is-hidden');
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  onScroll();

  // ---------- the trust line links to the data-protection answer and opens it ----------
  function openFaq(item) { if (item && !item.classList.contains('open')) item.querySelector('.faq-trigger').click(); }
  document.querySelectorAll('a[href="#faq-datos"]').forEach((a) => a.addEventListener('click', () => openFaq($('faq-datos'))));
  if (location.hash === '#faq-datos') openFaq($('faq-datos'));

  // ---------- calculator: same formulas as the old /calculadora page ----------
  const calc = (function () {
    if (!$('slider-citas')) return null;
    const TARGET_RATE = 0.06, REFILL = 0.45, SECTOR_MIN = 0.12, SECTOR_MAX = 0.18;
    const DEFAULTS = { citas: 200, tasa: 15, ticket: 85 }, LIMITS = { citas: [20, 1000], tasa: [1, 40], ticket: [30, 500] };
    // es-ES leaves 4-digit numbers ungrouped (2550); de-DE uses the same separators and always groups (2.550)
    const numFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
    const num = (v) => numFmt.format(Math.round(v)), eur = (v) => num(v) + ' €';
    const state = Object.assign({ mode: 'pierde', v: 0 }, DEFAULTS);
    const api = { state, onChange: null, flat: false };
    let touched = false, announceTimer = null;

    function track(name) {
      if (window.gtag) window.gtag('event', name);
      else if (window.plausible) window.plausible(name);
    }
    // accepts "1.000" (thousands), "85,5" (decimal comma) and plain digits; anything else is not a number
    function parse(raw) {
      let s = String(raw == null ? '' : raw).trim().replace(/\s|€|%/g, '');
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      const n = parseFloat(s.replace(',', '.'));
      return isFinite(n) ? n : null;
    }
    const limit = (key, n) => clamp(n, LIMITS[key][0], LIMITS[key][1]);

    function model() {
      const C = state.citas, T = state.tasa / 100, P = state.ticket;
      const lostMonth = C * T * P, lostAppts = C * T;
      const recMonth = C * Math.max(0, T - TARGET_RATE) * P + C * Math.min(T, TARGET_RATE) * REFILL * P;
      return { C, T, P, lostMonth, lostYear: lostMonth * 12, lostAppts, recMonth, recYear: recMonth * 12, recFrac: lostMonth > 0 ? recMonth / lostMonth : 0 };
    }

    function paint() {
      const m = model();
      $('out-fuga-anual').textContent = num(m.lostYear); $('calc-live-figure').textContent = eur(m.lostYear);
      $('out-fuga-mes').textContent = eur(m.lostMonth);
      $('out-citas-perdidas').textContent = num(m.lostAppts);
      $('out-rec-mes').textContent = eur(m.recMonth);
      $('out-rec-anual').textContent = eur(m.recYear);
      $('calc-recover-low').hidden = !(m.recMonth < 400);
      ['citas', 'tasa', 'ticket'].forEach((key) => {
        const s = $('slider-' + key), lo = LIMITS[key][0], hi = LIMITS[key][1];
        s.style.setProperty('--fill', ((state[key] - lo) / (hi - lo) * 100) + '%');
        s.setAttribute('aria-valuetext', key === 'citas' ? num(state.citas) + ' citas al mes' : key === 'tasa' ? num(state.tasa) + ' % de ausencias' : eur(state.ticket) + ' de ticket medio');
      });
      // sector comparison
      const pct = num(m.T * 100) + ' %';
      $('sector-range').style.left = (SECTOR_MIN * 100 / 40 * 100) + '%';
      $('sector-range').style.width = ((SECTOR_MAX - SECTOR_MIN) * 100 / 40 * 100) + '%';
      $('sector-marker').style.setProperty('--marker-pct', clamp(m.T / 0.4) * 100 + '%');
      $('sector-bar').setAttribute('aria-label', 'Tu tasa de ausencias es del ' + pct + '. El rango habitual del sector va del 12 % al 18 %.');
      $('sector-text').textContent = m.T < SECTOR_MIN
        ? 'Estás por debajo del rango habitual del sector, que va del 12 % al 18 %. Aun así, esas citas siguen siendo dinero que no vuelve.'
        : m.T <= SECTOR_MAX
          ? 'Estás dentro del rango habitual del sector, entre el 12 % y el 18 %. Es lo normal, pero se puede bajar.'
          : 'Estás por encima del rango habitual del sector, que va del 12 % al 18 %. La diferencia entre tu cifra y ese rango es margen que pierdes cada mes.';
      // values that travel with the report request
      $('hid-citas').value = m.C; $('hid-tasa').value = num(m.T * 100) + ' %'; $('hid-ticket').value = num(m.P) + ' €';
      $('hid-fuga-mes').value = num(m.lostMonth) + ' €'; $('hid-fuga-anual').value = num(m.lostYear) + ' €';
      $('hid-rec-mes').value = num(m.recMonth) + ' €'; $('hid-rec-anual').value = num(m.recYear) + ' €';
      const unit = m.C <= 250 ? 1 : m.C <= 500 ? 2 : 4;
      $('calc-unit').textContent = (unit === 1 ? 'Cada bloque es una cita.' : 'Cada bloque son ' + unit + ' citas.') + ' Las que faltan en la agenda están en el montón.';
      root.dataset.calcMode = state.mode;
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { $('calc-sr-announce').textContent = 'Se te escapan ' + eur(m.lostYear) + ' al año. Se pueden recuperar ' + eur(m.recMonth) + ' al mes.'; }, 700);
      state.v++;
      if (api.flat) paintFlat(m, unit);
      if (api.onChange) api.onChange(state);
    }

    // flat stand-in for the 3D month: one square per block, gaps outlined, recovered ones in mint
    const grid = $('calcGrid'), order = Array.from({ length: 250 }, (_, i) => { const x = Math.sin((i + 7.31) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); });
    function paintFlat(m, unit) {
      const shown = Math.max(1, Math.round(m.C / unit)), holes = Math.min(shown, Math.round(shown * m.T)), nRec = Math.round(holes * m.recFrac);
      const rank = Array.from({ length: shown }, (_, i) => i).sort((a, b) => order[a] - order[b]), kind = new Array(shown).fill('');
      rank.slice(0, holes).forEach((i, n) => { kind[i] = state.mode === 'recupera' && n < nRec ? 'back' : 'lost'; });
      while (grid.children.length < shown) grid.appendChild(document.createElement('i'));
      while (grid.children.length > shown) grid.lastChild.remove();
      for (let i = 0; i < shown; i++) if (grid.children[i].className !== kind[i]) grid.children[i].className = kind[i];
    }
    api.useFlat = () => { if (api.flat) return; api.flat = true; grid.hidden = false; root.classList.add('flat-calc'); paint(); };

    function bind(key) {
      const slider = $('slider-' + key), input = $('input-' + key);
      const touch = () => { if (!touched) { touched = true; $('calc-example-note').hidden = true; track('calc_interact'); } };
      slider.addEventListener('input', () => { state[key] = +slider.value; input.value = slider.value; touch(); paint(); });
      // while typing the figure follows what is typed, kept inside the limits; the field itself is tidied on blur
      input.addEventListener('input', () => { const n = parse(input.value); if (n === null) return; state[key] = limit(key, n); slider.value = state[key]; touch(); paint(); });
      input.addEventListener('blur', () => { const n = parse(input.value); state[key] = Math.round(limit(key, n === null ? DEFAULTS[key] : n)); input.value = state[key]; slider.value = state[key]; paint(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    }
    ['citas', 'tasa', 'ticket'].forEach(bind);
    document.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      paint();
    }));

    // report request, sent through FormSubmit like the contact form
    const form = $('calc-email-form'), statusEl = $('calc-form-status'), submitBtn = $('calc-submit-btn');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      statusEl.textContent = '';
      if (!form.checkValidity()) { statusEl.textContent = 'Pon tu email y marca la casilla para poder enviártelo.'; form.reportValidity(); return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Enviando…';
      const payload = Object.fromEntries(new FormData(form));
      if (!String(payload.pacientes_base || '').trim()) payload.pacientes_base = 'no facilitado';
      if (!String(payload.consultas_mes || '').trim()) payload.consultas_mes = 'no facilitado';
      fetch('https://formsubmit.co/ajax/ceo@axionasystems.es', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
        .then((data) => { if (String(data.success) !== 'true') throw new Error('not delivered'); form.hidden = true; $('calc-form-success').hidden = false; track('calc_email_submit'); })
        .catch(() => { statusEl.textContent = 'No he podido confirmar el envío. Si mañana no tienes el informe, escríbeme a ceo@axionasystems.es.'; submitBtn.disabled = false; submitBtn.textContent = 'Enviar el desglose'; });
    });

    paint();
    return api;
  })();

  // ---------- story ----------
  const acts = [...document.querySelectorAll('[data-act]')], pinned = acts.filter((a) => !a.hasAttribute('data-free'));
  const leakRows = [...document.querySelectorAll('.leak')], steps = [...document.querySelectorAll('.step')], stepsEl = $('steps');
  const storyOn = root.classList.contains('story-on') && !!(window.gsap && window.ScrollTrigger) && acts.length === 5;

  function setLeak(n) { leakRows.forEach((row, i) => { const open = i === n; if (row.classList.contains('is-open') !== open) { row.classList.toggle('is-open', open); row.querySelector('.leak-trigger').setAttribute('aria-expanded', String(open)); } }); }

  if (!storyOn) {
    // plain page: every section on its own ground, the stills in place, leak rows as a simple accordion
    root.classList.remove('story-on');
    leakRows.forEach((row) => row.querySelector('.leak-trigger').addEventListener('click', () => { const open = !row.classList.contains('is-open'); row.classList.toggle('is-open', open); row.querySelector('.leak-trigger').setAttribute('aria-expanded', String(open)); }));
    if (calc) calc.useFlat();
    return;
  }

  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  if (window.Lenis && !coarse) {
    // smooth wheel scrolling on desktop only; touch keeps the native scroll
    lenis = new window.Lenis({ lerp: 0.12 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]'), id = a && a.getAttribute('href').slice(1), target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      lenis.resize();   // re-reads the real scroll position before measuring the target
      lenis.scrollTo(target, { offset: target.hasAttribute('data-act') ? 2 : -80, duration: 1.2 });
      history.replaceState(null, '', '#' + id);
    });
  }

  const slots = acts.map((a) => a.querySelector('[data-slot]')), canvas = $('stageCanvas'), groundEl = $('stageGround');
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), grounds = acts.map((a) => hex(a.dataset.ground));
  const demoItems = [...acts[1].querySelectorAll('[data-at]')].map((el) => ({ el, at: +el.dataset.at }));
  const triggers = pinned.map((act) => ScrollTrigger.create({ trigger: act, start: 'top top', end: 'bottom top' }));
  const stick = [0.25, 0.47, 0.47, 0.5, 1];
  let view = { w: 1, h: 1 }, dirty = true, lastKey = '', worker = null, live = false, lastGround = '', lastSent = '', attached = null, stuckTop = 0, settleUntil = 0, heroFilled = false;

  function measure() {
    const r = canvas.getBoundingClientRect(); view = { w: r.width || innerWidth, h: r.height || innerHeight };
    pinned.forEach((act, i) => { const pin = act.querySelector('.act-pin'); stick[i] = clamp((act.offsetHeight - pin.offsetHeight) / act.offsetHeight, 0.1, 0.9); });
    stuckTop = parseFloat(getComputedStyle(slots[4]).top) || 0;
    dirty = true;
    if (worker) { worker.postMessage({ type: 'resize', w: view.w, h: view.h, dpr: pixelRatio() }); worker.postMessage({ type: 'state', state: { stick: stick.slice(), mobile: innerWidth <= 900 } }); }
  }
  // cap the pixel density: on phones 1.5 is plenty and halves the GPU work
  function pixelRatio() { return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2, Math.sqrt(3.4e6 / Math.max(1, view.w * view.h))); }
  const uOf = (i, t) => seg(t, 0.02, stick[i] - 0.03), passOf = (i, t) => smooth(seg(t, stick[i], 0.97));

  function tick() {
    // keep measuring for a moment after the last change, so the agenda follows any layout transition still running
    const key = window.scrollY + '|' + innerWidth + '|' + innerHeight, now = performance.now();
    if (key !== lastKey || dirty) settleUntil = now + 600; else if (now > settleUntil) return;
    lastKey = key; dirty = false;
    // Lenis can miss a native scroll (keyboard, scrollbar) that lands on the frame one of its own animations ends;
    // when it is idle and its position differs from the real one, bring it back in step
    if (lenis && lenis.isScrolling === false && Math.abs(lenis.animatedScroll - window.scrollY) > 2) lenis.resize();

    // where we are: the first pinned act still in progress, or the calculator after them
    let k = pinned.length, t = 0;
    for (let i = 0; i < pinned.length; i++) { const p = triggers[i].progress; if (p < 1) { k = i; t = p; break; } }
    const u = k < 4 ? uOf(k, t) : 1, tb = k < 4 ? passOf(k, t) : 0;

    // ground colour
    const a = grounds[k], b = grounds[Math.min(4, k + 1)], g = 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], tb))).join(',') + ')';
    if (g !== lastGround) { groundEl.style.backgroundColor = g; lastGround = g; }

    // text of each act: leaves as the agenda starts to change, arrives once the ground is its own
    acts.forEach((act, i) => {
      const show = i === k ? 1 - seg(tb, 0, 0.45) : i === k + 1 ? seg(tb, 0.55, 1) : 0;
      act.style.setProperty('--show', show.toFixed(3));
      act.classList.toggle('is-away', show === 0);
    });
    demoItems.forEach((o) => o.el.classList.toggle('on', k > 1 || (k === 1 && u >= o.at)));
    setLeak(k < 2 ? 0 : k > 2 ? 2 : leakRows.reduce((n, row, i) => (u >= +row.dataset.at ? i : n), 0));
    const step = k < 3 ? 0 : k > 3 ? 3 : steps.reduce((n, el, i) => (u >= +el.dataset.at ? i : n), 0);
    steps.forEach((el, i) => el.classList.toggle('is-on', i === step));
    stepsEl.style.setProperty('--prog', ((step + 1) / 4).toFixed(2));

    // where the agenda lives on screen: the slot of the current act, gliding to the next one's
    // The canvas is fixed while the acts are pinned. From the calculator on its slot scrolls with the page, so the
    // canvas is attached to the page there: the browser moves it with the scroll and nothing has to be redrawn.
    // The canvas is fixed while its slot stands still on screen (pinned acts, and the calculator while its agenda
    // is stuck). Once that slot scrolls away with the page the canvas is attached to the page, so the browser
    // moves both together and nothing has to be redrawn.
    const ra = slots[Math.min(4, k)].getBoundingClientRect(), rb = slots[Math.min(4, k + 1)].getBoundingClientRect();
    const attach = k >= 4 && ra.top < stuckTop - 0.5 ? Math.round(ra.top + window.scrollY - stuckTop) : null;
    if (attach !== attached) { attached = attach; canvas.style.position = attach === null ? '' : 'absolute'; canvas.style.top = attach === null ? '' : attach + 'px'; }
    acts[4].classList.toggle('is-live', k >= 4);
    const cr = canvas.getBoundingClientRect();
    const box = { x: lerp(ra.left, rb.left, tb) - cr.left, y: lerp(ra.top, rb.top, tb) - cr.top, w: lerp(ra.width, rb.width, tb), h: lerp(ra.height, rb.height, tb) };
    const reg = { cx: +((box.x + box.w / 2) / view.w).toFixed(4), cy: +((box.y + box.h / 2) / view.h).toFixed(4), fw: +(box.w / view.w).toFixed(4), fh: +(box.h / view.h).toFixed(4) };
    const vis = cr.bottom > 0 && cr.top < innerHeight && box.y < view.h && box.y + box.h > 0;
    // on phones the text sits under the agenda (from the demo on): nothing may be drawn below the slot
    const narrow = innerWidth <= 900, cutOf = (i, r) => (narrow && i >= 1 ? (r.bottom - cr.top) / view.h : 2);
    const cut = +lerp(cutOf(k, ra), cutOf(Math.min(4, k + 1), rb), tb).toFixed(4);
    if (worker) {
      const msg = { k: Math.min(4, k), t: +t.toFixed(4), reg, vis, cut }, sig = JSON.stringify(msg);
      if (sig !== lastSent) { lastSent = sig; worker.postMessage({ type: 'state', state: msg }); }
    }
  }

  // clicking a leak or a week moves the page to that moment, so scroll stays the single source of truth
  function goTo(i, u) {
    const act = pinned[i], y = act.getBoundingClientRect().top + window.scrollY + (0.02 + u * (stick[i] - 0.05) + 0.006) * act.offsetHeight;
    if (lenis) { lenis.resize(); lenis.scrollTo(y, { duration: 0.9 }); } else window.scrollTo({ top: y, behavior: 'smooth' });
  }
  leakRows.forEach((row) => row.querySelector('.leak-trigger').addEventListener('click', () => goTo(2, +row.dataset.at + 0.03)));
  steps.forEach((el) => el.querySelector('.step-trigger').addEventListener('click', () => goTo(3, +el.dataset.at + 0.04)));

  measure();
  ScrollTrigger.addEventListener('refresh', measure);
  addEventListener('resize', () => { dirty = true; });
  gsap.ticker.add(tick);
  if (calc) calc.onChange = (s) => { if (worker) worker.postMessage({ type: 'state', state: { calc: { citas: s.citas, tasa: s.tasa, ticket: s.ticket, modo: s.mode, v: s.v } } }); };

  // ---------- 3D: rendered in a worker so scrolling never waits for it ----------
  function still() {
    // no 3D: the stills stay, the hero shows the agenda already filled and the calculator gets its flat grid
    live = false; root.classList.remove('live3d');
    if (!heroFilled) {
      heroFilled = true;
      const full = new Image(); full.alt = ''; full.className = 'hero-full'; full.decoding = 'async';
      // appended to the slot, not to the <picture>: inside it the picture's sources would replace its src
      full.onload = () => { full.onload = null; slots[0].appendChild(full); requestAnimationFrame(() => requestAnimationFrame(() => full.classList.add('on'))); };
      full.src = '/assets/img/hilo-hero-lleno-' + (innerWidth <= 900 ? 'm' : 'd') + '.webp';
    }
    if (calc) calc.useFlat();
    if (worker) { worker.postMessage({ type: 'stop' }); worker.terminate(); worker = null; }
  }
  async function bitmaps() {
    await document.fonts.load('600 48px Geist');
    const make = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return createImageBitmap(c, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }); };
    const dias = await make(1000, 90, (g) => { g.fillStyle = '#fff'; g.font = '600 52px Geist'; g.textAlign = 'center'; g.textBaseline = 'middle'; ['L', 'M', 'X', 'J', 'V'].forEach((d, i) => g.fillText(d, (i + 0.5) * 200, 48)); });
    const euro = await make(300, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(4, 4, 292, 120, 60); g.fill(); g.fillStyle = '#0b0b0c'; g.font = '600 62px Geist'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+85 €', 150, 68); });
    return { dias, euro };
  }
  async function boot3d() {
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.connection && navigator.connection.saveData);
    if (force === '0' || (weak && force !== '1') || !window.Worker || !canvas.transferControlToOffscreen) return still();
    try {
      const bm = await bitmaps().catch(() => ({}));
      const off = canvas.transferControlToOffscreen();
      worker = new Worker('/assets/3d/trabajador.js', { type: 'module' });
      worker.onerror = still;
      worker.onmessage = (e) => {
        if (e.data.type === 'ready') { live = true; root.classList.add('live3d'); }
        else if (e.data.type === 'error' || (e.data.type === 'perf' && e.data.ms > 42 && force !== '1')) still();
      };
      worker.postMessage({ type: 'init', canvas: off, opts: { dpr: pixelRatio(), w: view.w, h: view.h, mobile: innerWidth <= 900, reduce, bitmaps: bm, force: force === '1' } }, [off].concat(Object.values(bm)));
      worker.postMessage({ type: 'state', state: { stick: stick.slice(), mobile: innerWidth <= 900 } });
      if (calc) calc.onChange(calc.state);
      lastSent = ''; dirty = true;
    } catch (err) { still(); }
  }
  // start after the page has loaded and the browser is idle, so the 3D never delays the content
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
  if (document.readyState === 'complete') idle(boot3d, { timeout: 2000 }); else addEventListener('load', () => idle(boot3d, { timeout: 2000 }));
})();
