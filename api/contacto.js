// Vercel function: receives the home and calculator forms and emails them to
// ceo@axionasystems.es through Resend. Needs RESEND_API_KEY in Vercel.
const TO = 'ceo@axionasystems.es';
const FROM = 'Web AXIONA <web@axionasystems.es>';
const MAX_FIELD = 500;

const LABELS = {
  nombre: 'Nombre',
  clinica: 'Clínica',
  telefono: 'Teléfono',
  email: 'Email',
  citas_al_mes: 'Citas al mes',
  tasa_ausencias: 'Tasa de ausencias',
  ticket_medio: 'Ticket medio',
  fuga_mensual: 'Fuga mensual',
  fuga_anual: 'Fuga anual',
  recuperable_mensual: 'Recuperable al mes',
  recuperable_anual: 'Recuperable al año',
  pacientes_base: 'Pacientes en base de datos',
  consultas_mes: 'Consultas al mes',
  consentimiento: 'Acepta comunicaciones'
};

const FORMS = {
  contacto: { subject: 'Nueva solicitud desde la web', required: ['nombre', 'clinica', 'telefono', 'email'] },
  informe: { subject: 'Nuevo informe pedido desde la calculadora', required: ['email', 'consentimiento'] }
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ ok: false, error: 'missing_key' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const form = FORMS[body.formulario];
  if (!form) return res.status(400).json({ ok: false, error: 'bad_form' });

  // honeypot: bots fill the hidden field, people don't. Pretend it worked.
  if (body._honey) return res.status(200).json({ ok: true });

  const fields = {};
  for (const key of Object.keys(LABELS)) {
    if (body[key] === undefined || body[key] === null) continue;
    const value = String(body[key]).trim().slice(0, MAX_FIELD);
    if (value) fields[key] = value;
  }
  const missing = form.required.filter((k) => !fields[k]);
  if (missing.length) return res.status(400).json({ ok: false, error: 'missing', fields: missing });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return res.status(400).json({ ok: false, error: 'bad_email' });

  const rows = Object.entries(fields).map(([k, v]) => [LABELS[k], v]);
  const text = rows.map(([k, v]) => k + ': ' + v).join('\n');
  const html = '<table cellpadding="6" style="font-family:sans-serif;font-size:14px;border-collapse:collapse">' +
    rows.map(([k, v]) => '<tr><td style="color:#6b706d">' + escapeHtml(k) + '</td><td><b>' + escapeHtml(v) + '</b></td></tr>').join('') +
    '</table>';

  const who = fields.clinica || fields.nombre || fields.email;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: fields.email, subject: form.subject + ': ' + who, text, html })
  });
  if (!r.ok) {
    console.error('resend', r.status, await r.text());
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
  return res.status(200).json({ ok: true });
};
