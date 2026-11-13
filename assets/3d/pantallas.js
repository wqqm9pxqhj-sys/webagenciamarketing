// What the tablet and the phone of the 3D scene show on their screens. Drawn here, on the page's thread, because the
// site's font is only guaranteed to exist here; the worker receives everything as bitmaps plus the layout numbers.
// Loaded on demand by home.js (and by the stills harness), never on the critical path.
export const AW = 2200, AH = 1548;      // tablet screen, in drawing units
export const PW = 1080, PH = 2430;      // phone screen
// the two devices, in scene units: width, height, corner radius, thickness and chamfer
const TABLET = { w: 2.84, h: 2.04, r: 0.15, t: 0.062, b: 0.016 }, PHONE = { w: 0.74, h: 1.56, r: 0.125, t: 0.078, b: 0.02 };
const INK = '#16202f', MUTED = '#77839a', LINE = '#e4e9f0', GREEN = '#18a574', GREEN_INK = '#0d6a4b', CORAL = '#d9482f', CORAL_INK = '#b93a24', BLUE = '#1d57c9';
const F = (w, px) => w + ' ' + px + "px Geist, 'Geist Fallback', system-ui, sans-serif";

// agenda grid: 5 days x 10 slots, with the midday pause after the fifth
export const GX = 150, GY = 200, GW = AW - GX - 40, GH = AH - GY - 40, PAUSE = 52, ROWH = (GH - PAUSE) / 10, COLW = GW / 5;
const rowY = (r) => GY + r * ROWH + (r >= 5 ? PAUSE : 0);
export const cell = (col, row) => ({ x: GX + col * COLW + 8, y: rowY(row) + 7, w: COLW - 16, h: ROWH - 14 });
export const GAPS = [[0, 1], [0, 8], [1, 2], [1, 5], [2, 2], [2, 6], [3, 8], [4, 5]];
const TREAT = ['Revisión', 'Limpieza', 'Empaste', 'Ortodoncia', 'Endodoncia', 'Implante', 'Primera visita', 'Blanqueamiento', 'Férula', 'Higiene'];
const DUR = ['30 min', '45 min', '1 h', '30 min', '30 min', '1 h', '45 min'];
const HOURS = ['9:00', '10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const BARS = ['#6f8fb3', '#b99a6b', '#6f8fb3'], FILLS = ['#e3eaf3', '#f1eadd', '#e3eaf3'];

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function sheet(w, h, k) { const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext('2d'); g.scale(k, k); g.textBaseline = 'middle'; return [c, g]; }
const bitmap = (c) => createImageBitmap(c, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
// between two drawings the page gets its turn: each waits for a quiet moment (or 120 ms at most)
const pause = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 0)));
function wrap(g, text, max) { const out = []; let line = ''; text.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
function check(g, cx, cy, s, color, width) { g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx - s, cy); g.lineTo(cx - s * 0.25, cy + s * 0.75); g.lineTo(cx + s, cy - s * 0.75); g.stroke(); g.lineCap = 'butt'; }

// ---------- tablet ----------
function topBar(g, title, sub, view) {
  g.fillStyle = '#fbfcfd'; g.fillRect(0, 0, AW, AH);
  g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 48); g.fillText(title, 52, 70);
  const tw = g.measureText(title).width; g.fillStyle = MUTED; g.font = F(500, 30); g.fillText(sub, 52 + tw + 22, 73);
  if (view < 0) return;
  const sx = AW - 52 - 400; rr(g, sx, 38, 400, 64, 32); g.fillStyle = '#edf0f5'; g.fill();
  const px = [sx + 5, sx + 126, sx + 269][view], pw = [118, 150, 126][view];
  rr(g, px, 43, pw, 54, 27); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.12)'; g.shadowBlur = 10; g.shadowOffsetY = 2; g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.font = F(500, 28); g.textAlign = 'center';
  [['Día', sx + 64], ['Semana', sx + 201], ['Mes', sx + 332]].forEach(([t, x], i) => { g.fillStyle = i === view ? INK : MUTED; g.fillText(t, x, 71); });
}
function booked(g, col, row) {
  const { x, y, w, h } = cell(col, row), n = col * 10 + row, tone = (n * 7 + col) % 3;
  rr(g, x, y, w, h, 14); g.fillStyle = FILLS[tone]; g.fill();
  rr(g, x, y, 10, h, [14, 0, 0, 14]); g.fillStyle = BARS[tone]; g.fill();
  g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 31); g.fillText(TREAT[(n * 3 + col * 5) % TREAT.length], x + 30, y + h / 2 + 1);
  g.fillStyle = '#6c7686'; g.font = F(500, 23); g.textAlign = 'right'; g.fillText(DUR[(n * 5 + row) % DUR.length], x + w - 20, y + h / 2 + 1);
}
function agenda(k) {
  const [c, g] = sheet(AW, AH, k); topBar(g, 'Agenda', 'Esta semana', 1);
  g.font = F(600, 28); g.textAlign = 'center'; g.fillStyle = INK; DAYS.forEach((d, i) => g.fillText(d, GX + (i + 0.5) * COLW, 162));
  g.fillStyle = '#f2f4f8'; g.fillRect(GX, GY + 5 * ROWH, GW, PAUSE);
  g.font = F(500, 22); g.fillStyle = MUTED; g.fillText('Pausa de mediodía', GX + GW / 2, GY + 5 * ROWH + PAUSE / 2 + 1);
  g.strokeStyle = LINE; g.lineWidth = 2;
  for (let r = 0; r <= 10; r++) { const y = r === 10 ? GY + GH : rowY(r); g.beginPath(); g.moveTo(GX, y); g.lineTo(GX + GW, y); g.stroke(); }
  g.beginPath(); g.moveTo(GX, GY + 5 * ROWH); g.lineTo(GX + GW, GY + 5 * ROWH); g.stroke();
  for (let i = 0; i <= 5; i++) { g.beginPath(); g.moveTo(GX + i * COLW, GY); g.lineTo(GX + i * COLW, GY + GH); g.stroke(); }
  g.font = F(500, 25); g.textAlign = 'right'; g.fillStyle = MUTED; HOURS.forEach((h, r) => g.fillText(h, GX - 22, rowY(r) + ROWH / 2));
  for (let col = 0; col < 5; col++) for (let row = 0; row < 10; row++) if (!GAPS.some((p) => p[0] === col && p[1] === row)) booked(g, col, row);
  return c;
}
// the three faces a slot can show on top of the agenda: nobody came, cancelled, filled from the waiting list
function tile(k, kind) {
  const w = COLW - 16, h = ROWH - 14, [c, g] = sheet(w, h, k);
  g.textAlign = 'left'; g.font = F(600, 31);
  if (kind === 'fill') {
    rr(g, 0, 0, w, h, 14); g.fillStyle = GREEN; g.fill();
    g.fillStyle = '#fff'; g.fillText('Lista de espera', 26, h / 2 + 1);
    g.beginPath(); g.arc(w - 38, h / 2, 17, 0, 7); g.fillStyle = 'rgba(255,255,255,.24)'; g.fill(); check(g, w - 38, h / 2, 8, '#fff', 4);
  } else {
    rr(g, 0, 0, w, h, 14); g.fillStyle = '#fff3ef'; g.fill();
    g.setLineDash([16, 11]); g.strokeStyle = '#e0563f'; g.lineWidth = 3.5; rr(g, 2, 2, w - 4, h - 4, 12); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#c0412b'; g.fillText(kind === 'cancel' ? 'Cita cancelada' : 'No se presentó', 26, h / 2 + 1);
  }
  return c;
}
// one pill per number of gaps left, stacked in a strip (row 0 = none left)
export const CHIP = { x: AW - 52 - 400 - 40 - 340, y: 40, w: 340, h: 60, rows: 9 };
function chips(k) {
  const [c, g] = sheet(CHIP.w, CHIP.h * CHIP.rows, k); g.font = F(600, 28);
  for (let left = 0; left < CHIP.rows; left++) {
    const txt = left ? left + (left === 1 ? ' hueco' : ' huecos') : 'Agenda llena', tw = g.measureText(txt).width, w = tw + 62, x = CHIP.w - w, y = left * CHIP.h;
    rr(g, x, y, w, CHIP.h, 30); g.fillStyle = left ? '#fdece8' : '#e2f5ec'; g.fill();
    g.beginPath(); g.arc(x + 28, y + 30, 8, 0, 7); g.fillStyle = left ? CORAL : GREEN; g.fill();
    g.textAlign = 'left'; g.fillStyle = left ? CORAL_INK : GREEN_INK; g.fillText(txt, x + 46, y + 32);
  }
  return c;
}
// "connected" notice that drops over the agenda in week 2
export const TOAST = { x: AW / 2 - 330, y: 122, w: 660, h: 84 };
function toast(k) {
  const [c, g] = sheet(TOAST.w, TOAST.h, k);
  rr(g, 6, 4, TOAST.w - 12, TOAST.h - 14, 32); g.fillStyle = '#16202f'; g.shadowColor = 'rgba(13,27,51,.3)'; g.shadowBlur = 8 * k; g.shadowOffsetY = 3 * k; g.fill(); g.shadowColor = 'transparent';
  g.beginPath(); g.arc(46, 39, 15, 0, 7); g.fillStyle = GREEN; g.fill(); check(g, 46, 39, 7, '#fff', 3.5);
  g.fillStyle = '#fff'; g.font = F(500, 29); g.textAlign = 'left'; g.fillText('Conectado con el software de la clínica', 76, 40);
  return c;
}
// patients who stopped coming (second leak)
const PATIENTS = [['Anna G.', 'hace 7 meses'], ['Jordi P.', 'hace 9 meses'], ['Núria S.', 'hace 1 año'], ['Carles M.', 'hace 8 meses'], ['Montse R.', 'hace 11 meses'], ['Albert F.', 'hace 7 meses'], ['Laia C.', 'hace 1 año'], ['Pere T.', 'hace 10 meses']];
const PROW = 152, PTOP = 236;
export const PILL = { w: 380, h: 68, x: AW - 70 - 380, y: (i) => PTOP + i * PROW + (PROW - 68) / 2 - 6 };
function patients(k) {
  const [c, g] = sheet(AW, AH, k); topBar(g, 'Pacientes', 'Sin venir desde hace más de 6 meses', -1);
  g.fillStyle = MUTED; g.font = F(500, 25); g.textAlign = 'left'; g.fillText('Paciente', 70, 178); g.fillText('Última visita', 900, 178); g.textAlign = 'right'; g.fillText('Estado', AW - 70, 178);
  PATIENTS.forEach(([name, ago], i) => {
    const y = PTOP + i * PROW, cy = y + PROW / 2 - 6;
    g.fillStyle = LINE; g.fillRect(70, y - 12, AW - 140, 2);
    g.beginPath(); g.arc(108, cy, 38, 0, 7); g.fillStyle = ['#e3eaf3', '#f1eadd'][i % 2]; g.fill();
    g.fillStyle = '#4b5a70'; g.font = F(600, 28); g.textAlign = 'center'; g.fillText(name[0] + name.split(' ')[1][0], 108, cy + 2);
    g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 34); g.fillText(name, 176, cy + 1);
    g.fillStyle = MUTED; g.font = F(500, 30); g.fillText(ago, 900, cy + 1);
    rr(g, PILL.x, PILL.y(i), PILL.w, PILL.h, 34); g.fillStyle = '#eef1f5'; g.fill();
    g.fillStyle = '#6c7686'; g.font = F(500, 28); g.textAlign = 'center'; g.fillText('Sin cita', PILL.x + PILL.w / 2, PILL.y(i) + PILL.h / 2 + 1);
  });
  return c;
}
function pill(k, kind) {
  const [c, g] = sheet(PILL.w, PILL.h, k), ok = kind === 'ok';
  rr(g, 0, 0, PILL.w, PILL.h, 34); g.fillStyle = ok ? GREEN : '#e3ecfb'; g.fill();
  g.font = F(600, 28); g.textAlign = 'center'; g.fillStyle = ok ? '#fff' : BLUE; g.fillText(ok ? 'Ha pedido cita' : 'Mensaje enviado', PILL.w / 2 + (ok ? -16 : 0), PILL.h / 2 + 1);
  if (ok) check(g, PILL.w / 2 + 104, PILL.h / 2, 8, '#fff', 4);
  return c;
}
// Monday report (week 4). No figures on purpose: the amounts are the clinic's, so their place is left blank.
function report(k) {
  const [c, g] = sheet(AW, AH, k); topBar(g, 'Informe del lunes', 'Lo que ha vuelto la semana pasada', -1);
  const rows = [['Huecos ocupados con la lista de espera', 0.82, GREEN], ['Pacientes que han vuelto a pedir cita', 0.56, GREEN], ['Consultas respondidas fuera de horario', 0.38, GREEN], ['Huecos que se quedaron vacíos', 0.12, '#e0563f']];
  rows.forEach(([label, v, color], i) => {
    const y = 250 + i * 290;
    g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 40); g.fillText(label, 70, y);
    rr(g, 70, y + 56, AW - 560, 56, 28); g.fillStyle = '#edf0f5'; g.fill();
    rr(g, 70, y + 56, (AW - 560) * v, 56, 28); g.fillStyle = color; g.fill();
    rr(g, AW - 410, y + 46, 250, 76, 20); g.fillStyle = '#edf0f5'; g.fill();
    g.fillStyle = MUTED; g.font = F(600, 46); g.fillText('€', AW - 136, y + 86);
    if (i < 3) { g.fillStyle = LINE; g.fillRect(70, y + 190, AW - 140, 2); }
  });
  g.fillStyle = MUTED; g.font = F(500, 26); g.textAlign = 'left'; g.fillText('Ejemplo de informe. Las cifras son las de cada clínica.', 70, AH - 62);
  return c;
}
// month view behind the calculator: the scene lays one square per appointment inside BODY
export const BODY = { x: 60, y: 226, w: AW - 120, h: AH - 226 - 56 };
function month(k) {
  const [c, g] = sheet(AW, AH, k); topBar(g, 'Agenda', 'Este mes', 2);
  let x = 60; g.font = F(500, 27); g.textAlign = 'left';
  [['Atendida', '#c9d7ea'], ['No se presentó', '#e36b55'], ['Recuperada', GREEN]].forEach(([t, col]) => { rr(g, x, 150, 34, 34, 9); g.fillStyle = col; g.fill(); g.fillStyle = '#4b5a70'; g.fillText(t, x + 48, 168); x += 48 + g.measureText(t).width + 54; });
  return c;
}

// ---------- phone ----------
function chatBase(g, time, day) {
  g.fillStyle = '#efe9e0'; g.fillRect(0, 0, PW, PH);
  g.fillStyle = '#f7f6f3'; g.fillRect(0, 0, PW, 300); g.fillStyle = '#dedbd4'; g.fillRect(0, 300, PW, 2);
  g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 42); g.fillText(time, 78, 78);
  rr(g, PW / 2 - 150, 40, 300, 84, 42); g.fillStyle = '#060607'; g.fill();
  rr(g, PW - 170, 60, 78, 38, 11); g.strokeStyle = INK; g.lineWidth = 3; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1; rr(g, PW - 164, 66, 56, 26, 6); g.fillStyle = INK; g.fill();
  g.strokeStyle = '#2f7cf6'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(72, 188); g.lineTo(48, 214); g.lineTo(72, 240); g.stroke(); g.lineCap = 'butt';
  g.beginPath(); g.arc(160, 214, 52, 0, 7); g.fillStyle = GREEN; g.fill();
  g.fillStyle = '#fff'; g.font = F(600, 38); g.textAlign = 'center'; g.fillText('CD', 160, 217);
  g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 44); g.fillText('Clínica dental', 240, 194);
  g.fillStyle = MUTED; g.font = F(400, 32); g.fillText('Cuenta de empresa', 240, 244);
  g.font = F(500, 30); g.textAlign = 'center'; const dw = g.measureText(day).width + 56; rr(g, PW / 2 - dw / 2, 340, dw, 58, 16); g.fillStyle = 'rgba(255,255,255,.92)'; g.fill(); g.fillStyle = MUTED; g.fillText(day, PW / 2, 371);
  g.fillStyle = '#f7f6f3'; g.fillRect(0, PH - 250, PW, 250);
  rr(g, 130, PH - 215, PW - 290, 92, 46); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#dedbd4'; g.lineWidth = 2; g.stroke();
  g.strokeStyle = '#2f7cf6'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(66, PH - 195); g.lineTo(66, PH - 143); g.moveTo(40, PH - 169); g.lineTo(92, PH - 169); g.stroke(); g.lineCap = 'butt';
  g.beginPath(); g.arc(PW - 84, PH - 169, 46, 0, 7); g.fillStyle = GREEN; g.fill();
  rr(g, PW / 2 - 190, PH - 44, 380, 14, 7); g.fillStyle = INK; g.fill();
}
// size and place of each bubble of a conversation; `mine` is the phone's owner (the patient)
const BPAD = 12;
function layoutBubbles(g, msgs) {
  let y = 440; g.font = F(400, 50);
  return msgs.map(([text, mine, time]) => {
    const lines = wrap(g, text, PW * 0.8 - 64), lh = 66, w = Math.max(250, Math.max(...lines.map((l) => g.measureText(l).width)) + 64), h = lines.length * lh + 92;
    const b = { text, mine, time, lines, lh, x: mine ? PW - 40 - w : 40, y, w, h }; y += h + 22; return b;
  });
}
function paintBubble(g, b, ox, oy) {
  const x = b.x - ox, y = b.y - oy;
  g.shadowColor = 'rgba(0,0,0,.10)'; g.shadowBlur = 6; g.shadowOffsetY = 2; rr(g, x, y, b.w, b.h, b.mine ? [30, 30, 8, 30] : [30, 30, 30, 8]); g.fillStyle = b.mine ? '#d9fdd3' : '#fff'; g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.font = F(400, 50); g.fillStyle = INK; g.textAlign = 'left'; b.lines.forEach((l, i) => g.fillText(l, x + 32, y + 56 + i * b.lh));
  g.font = F(400, 27); g.fillStyle = MUTED; g.textAlign = 'right'; g.fillText(b.time, x + b.w - (b.mine ? 76 : 28), y + b.h - 30);
  if (b.mine) { g.strokeStyle = '#3aa0e8'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x + b.w - 64, y + b.h - 30); g.lineTo(x + b.w - 55, y + b.h - 21); g.lineTo(x + b.w - 38, y + b.h - 40); g.moveTo(x + b.w - 50, y + b.h - 26); g.lineTo(x + b.w - 45, y + b.h - 21); g.lineTo(x + b.w - 28, y + b.h - 40); g.stroke(); g.lineCap = 'butt'; }
}
const CONFIRM = [['Hola Jordi. Te esperamos mañana a las 12:00 con la doctora. ¿Nos confirmas que vienes?', false, '17:30'], ['Sí, allí estaré', true, '17:42'], ['Gracias, Jordi. Hasta mañana.', false, '17:42']];
// the same conversation the page shows beside the phone (index.html, #demo)
const OFFER = [['Hola Marta. Se ha liberado un hueco mañana a las 10:30 con la doctora. ¿Te va bien?', false, '18:42'], ['uy sí, perfecto', true, '18:43'], ['Hecho. Te esperamos mañana a las 10:30.', false, '18:43']];
const NIGHT = [['Hola, ¿tenéis hora para un implante?', true, '22:07'], ['Hola. Te puedo dar cita el martes a las 17:00 para una primera visita. ¿Te va bien?', false, '22:07']];
function chat(k, time, day, baked) {
  const [c, g] = sheet(PW, PH, k); chatBase(g, time, day);
  if (baked) layoutBubbles(g, baked).forEach((b) => paintBubble(g, b, 0, 0));
  return c;
}
function bubbles(k, msgs) {
  const [, m] = sheet(8, 8, 1);
  return layoutBubbles(m, msgs).map((b) => { const [c, g] = sheet(b.w + BPAD * 2, b.h + BPAD * 2, k); paintBubble(g, b, b.x - BPAD, b.y - BPAD); return { c, rect: { x: b.x - BPAD, y: b.y - BPAD, w: b.w + BPAD * 2, h: b.h + BPAD * 2 } }; });
}
// week 3: every message waits for the clinic's approval
export const OKBOX = { x: 70, y: 1180, w: PW - 140, h: 150 };
function approve(k) {
  const [c, g] = sheet(PW, PH, k);
  g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, PW, PH);
  g.textAlign = 'left'; g.fillStyle = INK; g.font = F(600, 42); g.fillText('9:41', 78, 78);
  rr(g, PW / 2 - 150, 40, 300, 84, 42); g.fillStyle = '#060607'; g.fill();
  rr(g, PW - 170, 60, 78, 38, 11); g.strokeStyle = INK; g.lineWidth = 3; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1; rr(g, PW - 164, 66, 56, 26, 6); g.fillStyle = INK; g.fill();
  g.fillStyle = INK; g.font = F(600, 62); g.fillText('En prueba', 70, 250);
  g.fillStyle = MUTED; g.font = F(400, 38); g.fillText('Nada sale sin tu visto bueno.', 70, 330);
  rr(g, 40, 420, PW - 80, 950, 44); g.fillStyle = '#fff'; g.shadowColor = 'rgba(13,27,51,.12)'; g.shadowBlur = 24 * k; g.shadowOffsetY = 8 * k; g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = MUTED; g.font = F(500, 34); g.fillText('Recordatorio · 24 horas antes', 70 + 20, 500);
  rr(g, 90, 560, PW - 180, 420, 34); g.fillStyle = '#efe9e0'; g.fill();
  const [, m] = sheet(8, 8, 1); m.font = F(400, 46); const lines = wrap(m, 'Hola Jordi. Te esperamos mañana a las 12:00 con la doctora. ¿Nos confirmas que vienes?', PW - 180 - 150);
  rr(g, 120, 600, PW - 280, lines.length * 62 + 70, [30, 30, 30, 8]); g.fillStyle = '#fff'; g.fill();
  g.fillStyle = INK; g.font = F(400, 46); lines.forEach((l, i) => g.fillText(l, 152, 660 + i * 62));
  g.fillStyle = MUTED; g.font = F(400, 34); g.fillText('Para: pacientes con cita mañana', 90, 1080);
  rr(g, OKBOX.x + 20, OKBOX.y, 440, OKBOX.h - 20, 36); g.fillStyle = BLUE; g.fill(); g.fillStyle = '#fff'; g.font = F(600, 44); g.textAlign = 'center'; g.fillText('Aprobar', OKBOX.x + 240, OKBOX.y + 66);
  rr(g, OKBOX.x + 490, OKBOX.y, OKBOX.w - 510, OKBOX.h - 20, 36); g.strokeStyle = '#c5cedc'; g.lineWidth = 3; g.stroke(); g.fillStyle = INK; g.fillText('Cambiar', OKBOX.x + 490 + (OKBOX.w - 510) / 2, OKBOX.y + 66);
  rr(g, PW / 2 - 190, PH - 44, 380, 14, 7); g.fillStyle = INK; g.fill();
  return c;
}
function approved(k) {
  const [c, g] = sheet(OKBOX.w, OKBOX.h, k);
  g.fillStyle = '#fff'; g.fillRect(0, 0, OKBOX.w, OKBOX.h);
  rr(g, 20, 0, OKBOX.w - 40, OKBOX.h - 20, 36); g.fillStyle = '#e2f5ec'; g.fill();
  g.beginPath(); g.arc(OKBOX.w / 2 - 150, 65, 26, 0, 7); g.fillStyle = GREEN; g.fill(); check(g, OKBOX.w / 2 - 150, 65, 11, '#fff', 5);
  g.fillStyle = GREEN_INK; g.font = F(600, 44); g.textAlign = 'left'; g.fillText('Aprobado', OKBOX.w / 2 - 104, 67);
  return c;
}

// ---------- soft shadow of a device lying on the table ----------
// Three blurred copies of its outline in one image: tight where it touches, wide and faint further out.
function shadow(w, h, r, S) {
  const pad = 0.8, cw = Math.ceil((w + pad * 2) * S), ch = Math.ceil((h + pad * 2) * S), c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'), FAR = 10000;
  [[0.012, 0.7, 0.004, 0.006, 1], [0.065, 0.4, 0.035, 0.05, 1.01], [0.22, 0.24, 0.085, 0.13, 1.05]].forEach(([blur, alpha, dx, dz, k]) => {
    g.shadowColor = 'rgba(0,0,0,' + alpha + ')'; g.shadowBlur = blur * S * 2; g.shadowOffsetX = FAR; g.shadowOffsetY = 0; g.fillStyle = '#000';
    rr(g, (pad + dx - (k - 1) * w / 2) * S - FAR, (pad + dz - (k - 1) * h / 2) * S, w * k * S, h * k * S, r * S); g.fill();
  });
  return { c, w: w + pad * 2, h: h + pad * 2 };
}

// Everything the scene needs, as { bitmaps: {name: ImageBitmap}, meta: {...} }. `mobile` halves the resolution.
export async function crearPantallas({ mobile }) {
  await Promise.all([400, 500, 600].map((w) => document.fonts.load(F(w, 40))));
  const kt = mobile ? 0.5 : 1, kp = mobile ? 0.5 : 0.75, S = mobile ? 70 : 110;
  const jobs = {
    agenda: () => agenda(kt), gap: () => tile(kt, 'gap'), fill: () => tile(kt, 'fill'), cancel: () => tile(kt, 'cancel'), chips: () => chips(kt), toast: () => toast(kt),
    patients: () => patients(kt), pillSent: () => pill(kt, 'sent'), pillOk: () => pill(kt, 'ok'), report: () => report(kt), month: () => month(kt),
    chatConfirm: () => chat(kp, '17:42', 'Hoy', CONFIRM), chatOffer: () => chat(kp, '18:42', 'Hoy'), chatNight: () => chat(kp, '22:07', 'Sábado'), approve: () => approve(kp), approved: () => approved(kp)
  };
  const bitmaps = {}, meta = { TABLET, PHONE, AW, AH, PW, PH, GX, GY, GW, GH, PAUSE, ROWH, COLW, GAPS, CHIP, TOAST, PILL: { x: PILL.x, w: PILL.w, h: PILL.h, ys: PATIENTS.map((_, i) => PILL.y(i)) }, BODY, OKBOX, offer: [], night: [], shadows: {} };
  for (const name in jobs) { bitmaps[name] = await bitmap(jobs[name]()); await pause(); }
  for (const [key, msgs] of [['offer', OFFER], ['night', NIGHT]]) {
    const list = bubbles(kp, msgs);
    for (let i = 0; i < list.length; i++) { bitmaps[key + i] = await bitmap(list[i].c); meta[key].push(list[i].rect); }
    await pause();
  }
  for (const [key, d] of [['tablet', TABLET], ['phone', PHONE]]) { const s = shadow(d.w, d.h, d.r, S); bitmaps['shadow_' + key] = await bitmap(s.c); meta.shadows[key] = { w: s.w, h: s.h }; }
  return { bitmaps, meta };
}
