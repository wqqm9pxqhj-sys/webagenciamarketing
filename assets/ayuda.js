// Help assistant: a small chat that sends the visitor's questions to /api/ayuda (Claude, with the
// site's facts). Loaded last on every page. The conversation lives only while the page is open.
// Its button only shows up once the server says the assistant is switched on (it needs a key in Vercel).
(function () {
  'use strict';
  const EMAIL = 'ceo@axionasystems.es', MAX = 600;
  const SUGGESTIONS = ['¿Cuánto cuesta?', '¿Funciona con mi software?', '¿Qué pasa con los datos de mis pacientes?'];
  const OFFLINE = 'Ahora mismo no puedo responder. Escribe a ' + EMAIL + ' o pide una llamada y Hugo te contesta en menos de 24 horas laborables.';
  const history = [];
  let panel = null, list, input, sendBtn, suggest, busy = false;

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const icon = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';

  const launcher = el('button', 'ayuda-btn');
  launcher.type = 'button'; launcher.id = 'ayudaBtn';
  launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'ayudaPanel');
  launcher.innerHTML = icon('M4 5h16v11H9l-5 4z') + '<span>¿Dudas?</span>';
  function arrive() {
    fetch('/api/ayuda').then((r) => (r.ok ? r.json() : { ok: false })).then((d) => { if (d.ok) document.body.appendChild(launcher); }).catch(() => {});
  }
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  if (document.readyState === 'complete') idle(arrive); else addEventListener('load', () => idle(arrive));

  // text from the assistant is shown as text; only the contact address becomes a link
  function fill(node, text) {
    text.split(EMAIL).forEach((part, i) => {
      if (i) { const a = el('a', '', EMAIL); a.href = 'mailto:' + EMAIL; node.appendChild(a); }
      if (part) node.appendChild(document.createTextNode(part));
    });
  }
  function add(kind, text) {
    const item = el('div', 'ayuda-msg ' + kind);
    fill(item, text);
    list.appendChild(item); list.scrollTop = list.scrollHeight;
    return item;
  }
  function offline() {
    const item = add('bot', OFFLINE), call = document.querySelector('a[data-call]'), a = el('a', 'ayuda-call', 'Pide una llamada');
    a.href = call ? call.href : 'mailto:' + EMAIL;
    item.appendChild(a);
    input.disabled = true; sendBtn.disabled = true; suggest.hidden = true;
  }

  function build() {
    panel = el('section', 'ayuda'); panel.id = 'ayudaPanel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Asistente de AXIONA'); panel.tabIndex = -1;
    const head = el('div', 'ayuda-head'), titles = el('div');
    titles.appendChild(el('p', 'ayuda-title', 'Asistente de AXIONA'));
    titles.appendChild(el('p', 'ayuda-sub', 'Es automático. Responde con lo que hay en esta web.'));
    const close = el('button', 'ayuda-close'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar el asistente'); close.innerHTML = icon('M6 6l12 12M18 6L6 18');
    head.appendChild(titles); head.appendChild(close);
    list = el('div', 'ayuda-list'); list.setAttribute('role', 'log'); list.setAttribute('aria-live', 'polite'); list.setAttribute('data-lenis-prevent', '');
    suggest = el('div', 'ayuda-suggest');
    SUGGESTIONS.forEach((q) => { const b = el('button', '', q); b.type = 'button'; b.addEventListener('click', () => send(q)); suggest.appendChild(b); });
    const form = el('form', 'ayuda-form'), label = el('label', 'visually-hidden', 'Tu pregunta');
    input = el('textarea'); input.id = 'ayudaInput'; input.rows = 1; input.maxLength = MAX; input.placeholder = 'Escribe tu pregunta…'; input.setAttribute('autocomplete', 'off');
    label.htmlFor = 'ayudaInput';
    sendBtn = el('button'); sendBtn.type = 'submit'; sendBtn.setAttribute('aria-label', 'Enviar la pregunta'); sendBtn.innerHTML = icon('M5 12h14M13 6l6 6-6 6');
    form.appendChild(label); form.appendChild(input); form.appendChild(sendBtn);
    const note = el('p', 'ayuda-note', 'No escribas datos de pacientes. '), privacy = el('a', '', 'Privacidad');
    privacy.href = '/politica-privacidad'; note.appendChild(privacy);
    [head, list, suggest, form, note].forEach((n) => panel.appendChild(n));
    document.body.appendChild(panel);

    close.addEventListener('click', () => toggle(false));
    form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
    add('bot', 'Hola. Soy el asistente automático de AXIONA. Pregúntame por precios, plazos, tus datos o cómo funciona.');
  }

  function toggle(open) {
    if (open && !panel) build();
    if (!panel) return;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.classList.toggle('is-open', open);
    if (!open) { launcher.focus(); return; }
    // on a phone, focusing the field would throw the keyboard over the conversation before anything is read
    if (matchMedia('(pointer: coarse)').matches) panel.focus(); else input.focus();
  }
  launcher.addEventListener('click', () => toggle(!panel || panel.hidden));

  function send(raw) {
    const text = String(raw || '').trim().slice(0, MAX);
    if (!text || busy || input.disabled) return;
    busy = true; sendBtn.disabled = true; suggest.hidden = true; input.value = '';
    add('me', text); history.push({ role: 'user', content: text });
    const wait = add('bot is-waiting', 'Escribiendo…');
    fetch('/api/ayuda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12) }) })
      .then((r) => r.json().catch(() => ({})).then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        wait.remove();
        if (d.ok && d.text) { add('bot', d.text); history.push({ role: 'assistant', content: d.text }); }
        else if (d.ok && d.declined) { history.pop(); add('bot', 'Eso no te lo puedo responder aquí. Si tiene que ver con tu clínica, escribe a ' + EMAIL + '.'); }
        else if (status === 429) { history.pop(); add('bot', 'Has hecho muchas preguntas seguidas. Espera unos minutos o escribe a ' + EMAIL + '.'); }
        else { history.pop(); offline(); }
      })
      .catch(() => { wait.remove(); history.pop(); offline(); })
      .then(() => { busy = false; if (!input.disabled) { sendBtn.disabled = false; if (!matchMedia('(pointer: coarse)').matches) input.focus(); } });
  }
})();
