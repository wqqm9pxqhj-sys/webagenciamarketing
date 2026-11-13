// Scroll-driven 3D thread of the home page: a tablet with the clinic's agenda and a phone with the conversation,
// lit like a product photo. Their screens change with the story, and what the system fills or recovers shows in green.
// Runs in a worker on an OffscreenCanvas (see trabajador.js). The page sends the state and, once, the screens as
// bitmaps with their layout numbers (see pantallas.js).
import * as THREE from './three-0.169.0.module.min.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// the hero fills its gaps by itself, one after another, a moment after the page appears
const FILL0 = 0.9, FILL_STEP = 0.55, N = 250;
// which patients of the list get a message and which of them ask for an appointment (second leak)
const SENT = [1, 3, 6], BOOKED = [1, 6];

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2, P = Math.PI;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -P / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, P / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, P / 2, P, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, P, P * 1.5, false);
  return s;
}
// a device body: rounded rectangle with a small chamfer, lying in XY with its back at z = 0
function slab(w, h, r, t, b, fine) {
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(r - b, 0.001)), { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: fine ? 8 : 5, curveSegments: fine ? 32 : 20 });
  g.translate(0, 0, b); return g;
}
function face(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 24), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

export function createScene(canvas, opts) {
  const B = opts.pantallas.bitmaps, m = opts.pantallas.meta, fine = !opts.mobile;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(opts.dpr); renderer.setSize(opts.w, opts.h, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, opts.w / opts.h, 1, 60);

  // studio light: a large softbox above and to the left, a strip on the right, one behind for the glass, a dim room
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, 0.5), side: THREE.BackSide })));
  const panel = (w, h, x, y, z, k) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p); };
  panel(16, 11, -7, 13, 5, 5.2); panel(5, 14, 15, 6, -2, 2.4); panel(22, 5, 0, 7, -18, 1.5); panel(9, 7, 8.5, 12.5, -11, 3.4);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(env, 0.03).texture; pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(-4, 8, 3); scene.add(key);

  const S = { k: 0, t: 0, cut: 2, stick: [0.23, 0.47, 0.47, 0.5, 1], reg: { cx: 0.7, cy: 0.5, fw: 0.5, fh: 0.7 }, w: opts.w, h: opts.h, mobile: !!opts.mobile, reduce: !!opts.reduce, vis: true, calc: { citas: 200, tasa: 15, ticket: 85, modo: 'pierde', v: 0 } };
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (name) => { const t = new THREE.Texture(B[name]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true; return t; };
  const flatMat = (map, extra) => new THREE.MeshBasicMaterial(Object.assign({ map, transparent: true, depthWrite: false, toneMapped: false }, extra));
  const unit = new THREE.PlaneGeometry(1, 1);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x07080a, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });

  // ---- a device: body, glass, the screens it can show and what is laid over each of them
  function device(d, bezel, sr, frameColor, UW, UH, names, order, glareK) {
    const b = d.b, t = d.t, sw = d.w - 2 * b - 2 * bezel, sh = d.h - 2 * b - 2 * bezel;
    const flat = new THREE.Group(), holder = new THREE.Group(); flat.rotation.x = -Math.PI / 2; holder.add(flat);
    flat.add(new THREE.Mesh(slab(d.w, d.h, d.r, t, b, fine), new THREE.MeshStandardMaterial({ color: frameColor, metalness: 1, roughness: 0.3 })));
    const gl = new THREE.Mesh(face(d.w - 2 * b, d.h - 2 * b, d.r - b), glass); gl.position.z = t + 0.0008; flat.add(gl);
    const sg = face(sw, sh, sr);
    const dev = { holder, flat, order, active: 0, prev: -1, op: names.map((_, i) => (i ? 0 : 1)), over: names.map(() => []) };
    dev.screens = names.map((name, i) => { const s = new THREE.Mesh(sg, flatMat(tex(name), { opacity: i ? 0 : 1 })); s.position.z = t + 0.002; s.visible = !i; flat.add(s); return s; });
    // lays a flat piece over a screen, given its rectangle in that screen's drawing units
    dev.put = (screen, mesh, r, layer = 1) => {
      mesh.position.set((r.x + r.w / 2) / UW * sw - sw / 2, sh / 2 - (r.y + r.h / 2) / UH * sh, t + 0.002 + layer * 0.0007);
      mesh.scale.set(r.w / UW * sw, r.h / UH * sh, 1); mesh.userData.size = [mesh.scale.x, mesh.scale.y]; mesh.userData.layer = layer;
      flat.add(mesh); dev.over[screen].push(mesh); return mesh;
    };
    dev.toLocal = (r) => [(r.x + r.w / 2) / UW * sw - sw / 2, sh / 2 - (r.y + r.h / 2) / UH * sh, r.w / UW * sw, r.h / UH * sh];
    dev.z = (layer) => t + 0.002 + layer * 0.0007;
    if (glareK) { const gr = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: glareK })); gr.position.z = t + 0.006; gr.renderOrder = order + 28; flat.add(gr); }
    scene.add(holder); return dev;
  }
  function shadowOf(dev, name, order) {
    const s = m.shadows[name], p = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), flatMat(tex('shadow_' + name)));
    p.rotation.x = -Math.PI / 2; p.position.y = 0.002; p.renderOrder = order; dev.holder.add(p);
  }
  const tablet = device(m.TABLET, 0.055, 0.075, 0xd6d8da, m.AW, m.AH, ['agenda', 'patients', 'report', 'month'], 0, 0.05);
  const phone = device(m.PHONE, 0.022, 0.085, 0x4a4b4f, m.PW, m.PH, ['chatConfirm', 'chatOffer', 'chatNight', 'approve'], 50, 0);
  shadowOf(tablet, 'tablet', -1); shadowOf(phone, 'phone', 40);
  // on phones the two overlap a little so both fit large in a narrow slot: the phone rests on the tablet's corner
  let away = 0;
  function arrange() {
    const mob = S.mobile;
    tablet.holder.position.set(mob ? -0.12 : -0.3, 0, mob ? -0.2 : -0.1); tablet.holder.rotation.y = 0.05;
    // `away` slides the phone off to the right: in the calculator the tablet is the whole picture
    phone.holder.position.set((mob ? 1.12 : 1.52) + away * 1.7, mob ? m.TABLET.t + 0.004 : 0, mob ? 1.02 : 0.86); phone.holder.rotation.y = -0.16;
    scene.updateMatrixWorld(true);
  }
  arrange();
  const world = (dev, x, y, out) => dev.flat.localToWorld(out.set(x, y, 0));

  // ---- agenda: the eight gaps, the slot that gets cancelled in the demo, the counter and the "connected" notice
  const cellOf = (c, r) => ({ x: m.GX + c * m.COLW + 8, y: m.GY + r * m.ROWH + (r >= 5 ? m.PAUSE : 0) + 7, w: m.COLW - 16, h: m.ROWH - 14 });
  const DEMO = () => (S.mobile ? [3, 7] : [4, 7]);
  const NG = m.GAPS.length, slots = m.GAPS.map(([c, r]) => tablet.toLocal(cellOf(c, r)));
  const inst = (map, count) => { const im = new THREE.InstancedMesh(unit, flatMat(map), count); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; tablet.flat.add(im); return im; };
  const gapTiles = inst(tex('gap'), NG), fillTiles = inst(tex('fill'), NG + 1); tablet.over[0].push(gapTiles, fillTiles);
  gapTiles.userData.layer = 1; fillTiles.userData.layer = 3;
  const cancelTile = tablet.put(0, new THREE.Mesh(unit, flatMat(tex('cancel'))), cellOf(...DEMO()), 2);
  const chipTex = tex('chips'); chipTex.repeat.set(1, 1 / m.CHIP.rows);
  const chip = tablet.put(0, new THREE.Mesh(unit, flatMat(chipTex)), m.CHIP, 1);
  const toast = tablet.put(0, new THREE.Mesh(unit, flatMat(tex('toast'))), m.TOAST, 4);
  // ---- patients who stopped coming
  const pillRect = (i) => ({ x: m.PILL.x, y: m.PILL.ys[i], w: m.PILL.w, h: m.PILL.h });
  const sentPills = SENT.map((i) => tablet.put(1, new THREE.Mesh(unit, flatMat(tex('pillSent'))), pillRect(i), 1));
  const okPills = BOOKED.map((i) => tablet.put(1, new THREE.Mesh(unit, flatMat(tex('pillOk'))), pillRect(i), 2));
  // ---- conversations on the phone
  const offer = m.offer.map((r, i) => phone.put(1, new THREE.Mesh(unit, flatMat(tex('offer' + i))), r, 1));
  const night = m.night.map((r, i) => phone.put(2, new THREE.Mesh(unit, flatMat(tex('night' + i))), r, 1));
  const approved = phone.put(3, new THREE.Mesh(unit, flatMat(tex('approved'))), m.OKBOX, 1);

  // ---- month view of the calculator: one square per appointment (or per 2 or 4 when there are many)
  const maskData = new Uint8Array(48 * 48 * 4);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const dx = Math.max(0, Math.abs(x - 23.5) - 15), dy = Math.max(0, Math.abs(y - 23.5) - 15), o = (y * 48 + x) * 4; maskData[o] = maskData[o + 1] = maskData[o + 2] = 255; maskData[o + 3] = 255 * clamp(8.5 - Math.hypot(dx, dy)); }
  const mask = new THREE.DataTexture(maskData, 48, 48); mask.magFilter = THREE.LinearFilter; mask.minFilter = THREE.LinearFilter; mask.needsUpdate = true;
  const days = inst(mask, N); days.userData.layer = 1; tablet.over[3].push(days);
  const cSeen = new THREE.Color(0xc9d7ea), cLost = new THREE.Color(0xe36b55), cBack = new THREE.Color(0x18a574), col = new THREE.Color();
  for (let i = 0; i < N; i++) days.setColorAt(i, cSeen);
  const order = Array.from({ length: N }, (_, i) => hash(i + 7.31));
  let wall = null, wallKey = '';
  function layout() {
    const c = S.calc, key = c.v + '|' + c.citas + '|' + c.tasa;
    if (key === wallKey) return wall;
    wallKey = key;
    const per = c.citas <= 250 ? 1 : c.citas <= 500 ? 2 : 4, shown = Math.max(1, Math.round(c.citas / per));
    const cols = clamp(Math.ceil(Math.sqrt(shown * 1.35)), 5, 21), rows = Math.ceil(shown / cols);
    const T = c.tasa / 100, holes = Math.min(shown, Math.round(shown * T));
    // same model as the calculator: absences drop to 6 % and 45 % of what is left gets refilled
    const recFrac = T > 0 ? (Math.max(0, T - 0.06) + Math.min(T, 0.06) * 0.45) / T : 0, nRec = Math.round(holes * recFrac);
    const lost = new Uint8Array(N), rec = new Uint8Array(N);
    Array.from({ length: shown }, (_, i) => i).sort((a, b) => order[a] - order[b]).slice(0, holes).forEach((i, n) => { lost[i] = 1; if (n < nRec) rec[i] = 1; });
    const cw = m.BODY.w / cols, ch = Math.min(m.BODY.h / rows, cw * 0.82);
    wall = { shown, cols, rows, lost, rec, cw, ch };
    return wall;
  }
  const DK = 6, dCur = new Float32Array(N * DK), dTgt = new Float32Array(N * DK);   // x, y, w, h, lost, recovered

  // ---- soft cut: erases whatever is drawn below a given height, so on phones nothing runs into the text under the slot
  const eraser = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { cut: { value: 0 }, fade: { value: 40 } },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'uniform float cut;uniform float fade;void main(){gl_FragColor=vec4(0.,0.,0.,1.-smoothstep(cut,cut+fade,gl_FragCoord.y));}',
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor
  }));
  eraser.frustumCulled = false; eraser.renderOrder = 999; scene.add(eraser);
  const bufSize = new THREE.Vector2();

  // ---- what every moment of the story asks for
  const W = { ts: 0, ps: 0, fill: new Float32Array(NG), demo: 0, toast: 0, sent: 0, booked: 0, offer: 0, night: 0, approved: 0 };
  function want(k, u, time) {
    W.ts = 0; W.ps = 0; W.demo = 2; W.toast = 0; W.sent = 0; W.booked = 0; W.offer = 0; W.night = 0; W.approved = 0;
    if (k === 0) { W.demo = 0; for (let i = 0; i < NG; i++) W.fill[i] = S.reduce || time >= FILL0 + i * FILL_STEP ? 1 : 0; return; }
    if (k === 1) {
      // someone cancels, the hour is offered to the waiting list, Marta takes it
      W.fill.fill(1); W.ps = 1; W.offer = u >= 0.66 ? 3 : u >= 0.5 ? 2 : u >= 0.36 ? 1 : 0; W.demo = u >= 0.72 ? 2 : u >= 0.06 ? 1 : 0; return;
    }
    if (k === 2) {
      // the three leaks: gaps that get filled, patients who come back, a question answered on a Saturday night
      for (let i = 0; i < NG; i++) W.fill[i] = u >= 0.2 + i * 0.03 ? 1 : 0;
      if (u >= 0.5) { W.ts = 1; W.sent = u >= 0.56 ? 1 : 0; W.booked = u >= 0.64 ? 1 : 0; }
      if (u >= 0.72) { W.ps = 2; W.night = u >= 0.86 ? 2 : 1; }
      return;
    }
    if (k === 3) {
      // four weeks: measure, connect, test with every message approved, then it runs alone and reports on Mondays
      const step = u < 0.25 ? 0 : u < 0.5 ? 1 : u < 0.75 ? 2 : 3;
      for (let i = 0; i < NG; i++) W.fill[i] = step === 3 || (step === 2 && i % 2 === 0 && u >= 0.56 + i * 0.015) ? 1 : 0;
      W.toast = step === 1 ? 1 : 0;
      if (step === 2) { W.ps = 3; W.approved = u >= 0.62 ? 1 : 0; }
      if (step === 3 && u >= 0.86) W.ts = 2;
      return;
    }
    W.ts = 3; W.fill.fill(1);
  }

  // ---- camera: the page says where the object lives (a region of the canvas); the scene says what must fit in it
  const V = new THREE.Vector3();
  function frameOf(k, u, time) {
    const mob = S.mobile, T = tablet.holder.position, P = phone.holder.position;
    if (k === 0 || k === 3) {
      const sway = k === 0 && !S.reduce && opts.fixedTime == null ? Math.sin(time * 0.35) * 0.03 * seg(time, 1, 4) : 0;
      if (k === 0) return mob ? { look: [0.08, 0, 0.42], dir: [-0.115 + sway, 0.8, 0.59], span: [3.76, 3.28] } : { look: [0.16, 0, 0.3], dir: [-0.115 + sway, 0.8, 0.59], span: [4.13, 2.8] };
      return mob ? { look: [0.1, 0, 0.42], dir: [-0.1, 0.8, 0.59], span: [3.8, 3.0] } : { look: [0.3, 0, 0.3], dir: [-0.1, 0.74, 0.67], span: [4.5, 2.5] };
    }
    if (k === 1) {
      // the phone, with the column of the agenda where the freed hour is; on phones, only the part of it with the messages
      if (mob) { world(phone, 0, 0.3, V); return { look: [V.x - 0.36, 0.03, V.z + 0.05], dir: [-0.08, 0.87, 0.49], span: [1.75, 1.05] }; }
      return { look: [P.x - 0.26, 0, P.z - 0.06], dir: [-0.08, 0.87, 0.49], span: [1.95, 1.78] };
    }
    if (k === 2) {
      // both devices while the story is on the tablet (the phone must not run into the text), then only the phone
      const a = mob ? { look: [T.x, 0, T.z + 0.05], dir: [-0.1, 0.84, 0.53], span: [3.6, 2.4] } : { look: [0.16, 0, 0.3], dir: [-0.1, 0.84, 0.53], span: [4.13, 2.95] };
      let b;
      if (mob) { world(phone, 0, 0.3, V); b = { look: [V.x - 0.1, 0.03, V.z], dir: [-0.08, 0.87, 0.49], span: [1.3, 1.05] }; }
      else b = { look: [P.x - 0.1, 0, P.z], dir: [-0.08, 0.87, 0.49], span: [1.6, 1.9] };
      return mix(a, b, smooth(seg(u, 0.66, 0.8)));
    }
    // on phones the year's figure sits under the tablet, so it is framed a little higher
    return mob ? { look: [T.x, 0, T.z + 0.26], dir: [-0.05, 0.88, 0.47], span: [3.7, 2.5] } : { look: [T.x, 0, T.z + 0.02], dir: [-0.05, 0.88, 0.47], span: [3.6, 2.5] };
  }
  const mix = (a, b, t) => ({ look: a.look.map((v, i) => lerp(v, b.look[i], t)), dir: a.dir.map((v, i) => lerp(v, b.dir[i], t)), span: a.span.map((v, i) => lerp(v, b.span[i], t)) });
  const camF = { look: [0, 0, 0], dir: [0, 0.7, 0.7], span: [8, 6] }, look = new THREE.Vector3(), dir = new THREE.Vector3();
  const reg = { cx: 0.7, cy: 0.5, fw: 0.5, fh: 0.7 };

  const M = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const fillCur = new Float32Array(NG + 1), cur = { cancel: 0, toast: 0, sent: 0, booked: 0, approved: 0, offer: [0, 0, 0], night: [0, 0] };
  let first = true, t0 = 0, last = 0, dirty = true, settled = false, blank = false, hold = 0, mobileWas = S.mobile, move = 0;
  const ease = (v, target, a) => { const d = target - v; if (Math.abs(d) > move) move = Math.abs(d); return Math.abs(d) < 0.0005 ? target : v + d * a; };
  // a piece that appears: it grows a little past its size and settles, and fades in with its screen
  function show(mesh, v, screenOp, grow = 0.12) {
    const s = mesh.userData.size, k = 1 - grow + grow * easeOutBack(clamp(v));
    mesh.scale.set(s[0] * k, s[1] * k, 1); mesh.material.opacity = clamp(v * 1.4) * screenOp; mesh.visible = mesh.material.opacity > 0.01;
  }
  // shows one screen of a device: the new one fades in over the old one, which is dropped once covered
  function screens(dev, target, a) {
    if (target !== dev.active) { dev.screens.forEach((s, i) => { if (i !== dev.active) { dev.op[i] = 0; } }); dev.prev = dev.active; dev.active = target; }
    dev.op[dev.active] = ease(dev.op[dev.active], 1, a);
    if (dev.op[dev.active] >= 1 && dev.prev >= 0) { dev.op[dev.prev] = 0; dev.prev = -1; }
    dev.screens.forEach((s, i) => {
      const top = i === dev.active ? 12 : 0;
      s.material.opacity = dev.op[i]; s.visible = dev.op[i] > 0.01; s.renderOrder = dev.order + top;
      dev.over[i].forEach((o) => { o.renderOrder = dev.order + top + (o.userData.layer || 1); if (o.isInstancedMesh) { o.material.opacity = dev.op[i]; o.visible = s.visible; } });
    });
  }

  function frame(now) {
    if (first) { t0 = now; last = now; }
    // opts.fixedTime freezes the clock: used to render the still images of each act
    const dt = Math.min(0.05, (now - last) / 1000), time = opts.fixedTime != null ? opts.fixedTime : (now - t0) / 1000; last = now;
    const k = S.k, st = S.stick[k] || 1, u = k < 4 ? seg(S.t, 0.02, st - 0.03) : 1, tb = k < 4 ? smooth(seg(S.t, st, 0.97)) : 0;
    const intro = !S.reduce && time < FILL0 + NG * FILL_STEP + 1.2, idle = k === 0 && tb < 1 && !S.reduce;
    if (!S.vis) { if (!blank) { renderer.clear(); blank = true; } last = now; return false; }
    if (dirty) hold = 24; else hold--;
    if (!dirty && settled && hold <= 0 && !intro && !idle && !blank) return false;
    dirty = false; blank = false; move = 0;
    const a = first ? 1 : 1 - Math.exp(-dt * 9), slow = first ? 1 : 1 - Math.exp(-dt * 6);
    const awayNow = ease(away, k === 4 ? 1 : k === 3 ? tb : 0, slow);
    if (S.mobile !== mobileWas || awayNow !== away) { mobileWas = S.mobile; away = awayNow; arrange(); const r = tablet.toLocal(cellOf(...DEMO())); cancelTile.position.x = r[0]; cancelTile.position.y = r[1]; }

    // halfway through the passage to the next act the screens become the next act's
    const kk = tb < 0.5 ? k : Math.min(4, k + 1);
    want(kk, tb < 0.5 ? u : 0, time);
    screens(tablet, W.ts, slow); screens(phone, W.ps, slow);
    const opA = tablet.op[0];

    // agenda: gaps, the demo slot, counter, notice
    let left = 0;
    for (let i = 0; i < NG; i++) {
      fillCur[i] = ease(fillCur[i], W.fill[i], a); if (W.fill[i] < 0.5) left++;
      const s = slots[i], f = clamp(fillCur[i]), g = f >= 0.999 ? 0 : 1, z = tablet.z(1);
      pos.set(s[0], s[1], z); scl.set(s[2] * g, s[3] * g, 1); M.compose(pos, Q0, scl); gapTiles.setMatrixAt(i, M);
      const e = f <= 0.001 ? 0 : easeOutBack(f); pos.z = tablet.z(3); scl.set(s[2] * e, s[3] * e, 1); M.compose(pos, Q0, scl); fillTiles.setMatrixAt(i, M);
    }
    fillCur[NG] = ease(fillCur[NG], W.demo === 2 ? 1 : 0, a); cur.cancel = ease(cur.cancel, W.demo >= 1 ? 1 : 0, a);
    { const s = tablet.toLocal(cellOf(...DEMO())), f = clamp(fillCur[NG]), e = f <= 0.001 ? 0 : easeOutBack(f); pos.set(s[0], s[1], tablet.z(3)); scl.set(s[2] * e, s[3] * e, 1); M.compose(pos, Q0, scl); fillTiles.setMatrixAt(NG, M); }
    gapTiles.instanceMatrix.needsUpdate = true; fillTiles.instanceMatrix.needsUpdate = true;
    show(cancelTile, cur.cancel, opA, 0.1);
    chipTex.offset.y = 1 - (left + 1) / m.CHIP.rows; show(chip, 1, opA, 0);
    cur.toast = ease(cur.toast, W.toast, a); show(toast, cur.toast, opA, 0.06);
    // patients
    cur.sent = ease(cur.sent, W.sent, a); cur.booked = ease(cur.booked, W.booked, a);
    sentPills.forEach((p) => show(p, cur.sent, tablet.op[1], 0.08)); okPills.forEach((p) => show(p, cur.booked, tablet.op[1], 0.14));
    // phone
    offer.forEach((b, i) => { cur.offer[i] = ease(cur.offer[i], W.offer > i ? 1 : 0, a); show(b, cur.offer[i], phone.op[1], 0.1); });
    night.forEach((b, i) => { cur.night[i] = ease(cur.night[i], W.night > i ? 1 : 0, a); show(b, cur.night[i], phone.op[2], 0.1); });
    cur.approved = ease(cur.approved, W.approved, a); show(approved, cur.approved, phone.op[3], 0.05);

    // month of the calculator
    if (tablet.op[3] > 0.01) {
      const L = layout(), rec = S.calc.modo === 'recupera', z = tablet.z(1), gap = 0.14;
      for (let i = 0; i < N; i++) {
        const o = i * DK, on = i < L.shown, r = tablet.toLocal({ x: m.BODY.x + (i % L.cols) * L.cw + L.cw * gap / 2, y: m.BODY.y + Math.floor(i / L.cols) * L.ch + L.ch * gap / 2, w: L.cw * (1 - gap), h: L.ch * (1 - gap) });
        dTgt[o] = r[0]; dTgt[o + 1] = r[1]; dTgt[o + 2] = on ? r[2] : 0; dTgt[o + 3] = on ? r[3] : 0; dTgt[o + 4] = on && L.lost[i] ? 1 : 0; dTgt[o + 5] = on && L.lost[i] && L.rec[i] && rec ? 1 : 0;
        for (let n = 0; n < DK; n++) dCur[o + n] = first || !days.userData.live ? dTgt[o + n] : ease(dCur[o + n], dTgt[o + n], a);
        pos.set(dCur[o], dCur[o + 1], z); scl.set(Math.max(0, dCur[o + 2]), Math.max(0, dCur[o + 3]), 1); M.compose(pos, Q0, scl); days.setMatrixAt(i, M);
        col.copy(cSeen).lerp(cLost, clamp(dCur[o + 4])).lerp(cBack, clamp(dCur[o + 5])); days.setColorAt(i, col);
      }
      days.userData.live = true; days.instanceMatrix.needsUpdate = true; days.instanceColor.needsUpdate = true;
    } else days.userData.live = false;

    // camera
    const f = tb > 0 ? mix(frameOf(k, u, time), frameOf(k + 1, 0, time), tb) : frameOf(k, u, time), ac = first ? 1 : 1 - Math.exp(-dt * 6);
    for (let i = 0; i < 3; i++) { move = Math.max(move, Math.abs(f.look[i] - camF.look[i]) * 0.1); camF.look[i] += (f.look[i] - camF.look[i]) * ac; camF.dir[i] += (f.dir[i] - camF.dir[i]) * ac; }
    for (let i = 0; i < 2; i++) { move = Math.max(move, Math.abs(f.span[i] - camF.span[i]) * 0.1); camF.span[i] += (f.span[i] - camF.span[i]) * ac; }
    // the region follows the page layout exactly: any easing here would let the object drift from its slot while scrolling
    for (const key of ['cx', 'cy', 'fw', 'fh']) reg[key] = S.reg[key];
    camera.aspect = S.w / S.h;
    camera.setViewOffset(S.w, S.h, (0.5 - reg.cx) * S.w, (0.5 - reg.cy) * S.h, S.w, S.h);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(camF.span[0] / (2 * tanV * camera.aspect * Math.max(0.05, reg.fw)), camF.span[1] / (2 * tanV * Math.max(0.05, reg.fh)));
    look.set(camF.look[0], camF.look[1], camF.look[2]); dir.set(camF.dir[0], camF.dir[1], camF.dir[2]).normalize();
    camera.position.copy(look).addScaledVector(dir, d); camera.lookAt(look);
    renderer.getDrawingBufferSize(bufSize);
    eraser.visible = S.cut < 1; eraser.material.uniforms.cut.value = (1 - S.cut) * bufSize.y; eraser.material.uniforms.fade.value = bufSize.y * 0.05;

    renderer.render(scene, camera);
    settled = move < 0.002; first = false;
    return true;
  }

  return {
    frame,
    set(patch) { for (const key in patch) { if (key === 'calc' || key === 'reg') Object.assign(S[key], patch[key]); else S[key] = patch[key]; } dirty = true; },
    resize(w, h, dpr) { S.w = w; S.h = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); dirty = true; },
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles })
  };
}
