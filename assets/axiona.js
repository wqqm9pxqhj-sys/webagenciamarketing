// Shared across all redesigned pages: footer year, mobile nav, scroll reveal,
// mailto with prefilled text, copy email, FAQ accordion, lead form.
document.documentElement.classList.add('js');

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// mobile nav
const navToggle = document.getElementById('navToggle');
const mobilePanel = document.getElementById('mobilePanel');
if (navToggle && mobilePanel) {
  const setOpen = (open) => {
    mobilePanel.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  navToggle.addEventListener('click', () => setOpen(!mobilePanel.classList.contains('open')));
  mobilePanel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

// "Pide una llamada": email with subject and body already written
const CALL_EMAIL = 'ceo@axionasystems.es';
const CALL_SUBJECT = 'Quiero hablar de mi clínica';
const CALL_BODY = 'Hola Hugo,\n\ntengo una clínica y quiero hablar contigo.\n\nClínica:\nTeléfono:\nMejor hora para llamarme:\n';
const callHref = 'mailto:' + CALL_EMAIL + '?subject=' + encodeURIComponent(CALL_SUBJECT) + '&body=' + encodeURIComponent(CALL_BODY);
document.querySelectorAll('[data-call]').forEach(a => a.setAttribute('href', callHref));

// copy email
document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-copy');
    const done = () => {
      btn.textContent = 'Copiado';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 1800);
    };
    // fallback: select the address so the visitor can copy it by hand
    const selectIt = () => {
      const target = btn.parentElement.querySelector('.email');
      if (!target) return;
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(selectIt);
    else selectIt();
  });
});

// scroll reveal, once per element (reduced motion is handled in CSS)
const revealEls = document.querySelectorAll('.reveal, .reveal-group');
if (!('IntersectionObserver' in window)) {
  revealEls.forEach(el => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => io.observe(el));
}

// FAQ accordion
// closed answers are inert so screen readers skip them
document.querySelectorAll('.faq-item').forEach(item => {
  const trigger = item.querySelector('.faq-trigger');
  const inner = item.querySelector('.faq-panel-inner');
  inner.inert = !item.classList.contains('open');
  trigger.addEventListener('click', () => {
    const open = !item.classList.contains('open');
    item.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    inner.inert = !open;
  });
});

// lead form → FormSubmit
const leadForm = document.getElementById('leadForm');
if (leadForm) {
  const msg = document.getElementById('formMsg');
  const btn = leadForm.querySelector('button[type="submit"]');
  const btnText = btn.textContent;
  const show = (text, isError) => {
    msg.textContent = text;
    msg.classList.toggle('is-error', !!isError);
  };
  leadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!leadForm.checkValidity()) {
      show('Rellena todos los campos para poder enviarlo.', true);
      leadForm.reportValidity();
      return;
    }
    show('', false);
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    const slow = setTimeout(() => {
      show('Está tardando más de lo normal. Espera un poco más o escríbeme a ' + CALL_EMAIL + '.', false);
    }, 15000);
    fetch('https://formsubmit.co/ajax/' + CALL_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(leadForm)))
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
      .then((data) => {
        if (String(data.success) !== 'true') throw new Error('not delivered');
        clearTimeout(slow);
        show('Recibido. Te escribo o te llamo en menos de 24 horas laborables.', false);
        btn.textContent = 'Enviado';
        leadForm.querySelectorAll('input,select').forEach(el => { el.disabled = true; });
      })
      .catch(() => {
        clearTimeout(slow);
        // FormSubmit sometimes delivers the email and still answers with an error,
        // so don't claim it failed: say we couldn't confirm it.
        show('No he podido confirmar el envío. Si mañana no tienes respuesta, escríbeme a ' + CALL_EMAIL + '.', true);
        btn.disabled = false;
        btn.textContent = btnText;
      });
  });
}
