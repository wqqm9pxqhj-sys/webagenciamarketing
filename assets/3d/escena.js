// Scroll-driven 3D thread of the home page: a clinic's weekly agenda built from blocks.
// One block is one appointment, a gap is a missing block, and what the system fills comes in mint.
// Runs in a worker on an OffscreenCanvas (see trabajador.js); the page only sends state.
import * as THREE from './three-0.169.0.module.min.js';
import { RoundedBoxGeometry } from './RoundedBoxGeometry-0.169.0.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// board: 5 days x 10 slots = 50 appointments a week, 200 a month (the calculator's example clinic)
const COLS = 5, ROWS = 10, PX = 1.24, PZ = 0.6, TW = 1.08, TD = 0.46, TH = 0.16;
const BW = COLS * PX, BD = ROWS * PZ, WEEK = COLS * ROWS, N = 250, GAP = BW + 1.7, LAYER = 3.3;
const slotX = (c) => (c - (COLS - 1) / 2) * PX, slotZ = (r) => (r - (ROWS - 1) / 2) * PZ;
// which slots are gaps at each moment (index = row * 5 + column)
const G0 = [1, 8, 12, 15, 22, 26, 38, 45], SLOT = 49, G2 = [6, 19, 27, 33, 40], BACK2 = [0.4, 0.46, 0.66, 0.72, 0.92];
const GW = [G0, [3, 9, 16, 20, 27, 31, 42, 48], [0, 7, 13, 24, 28, 35, 41, 46], [4, 11, 17, 23, 30, 36, 39, 47]];
const g0 = new Map(G0.map((j, i) => [j, i])), g2 = new Map(G2.map((j, i) => [j, i]));
const FILL0 = 0.9, FILL_STEP = 0.55, FILL_DUR = 0.6;
// colours of the plate, the gap outline and the lost blocks on each section's ground
const THEME = [
  { plate: 0xc2e3d6, line: 0x0b2e29, shadow: 0.2, lost: 0x9fb5ac },   // hero, pale mint ground
  { plate: 0x0e5c4d, line: 0xffffff, shadow: 0.24, lost: 0x0b4136 },  // demo, mint ground
  { plate: 0xd3eee3, line: 0x0b2e29, shadow: 0.1, lost: 0xa9bdb5 },   // leaks, white ground
  { plate: 0xcce5da, line: 0x0b2e29, shadow: 0.11, lost: 0xa9bdb5 },  // weeks, light grey ground
  { plate: 0x0e5c4d, line: 0xffffff, shadow: 0.24, lost: 0x86b3a6 }   // calculator, mint ground
];
const WHITE = 0xffffff, MINT = 0x35cfa3, DROP = [0.8, 0.2, 0.8, 0.55, 0.2];

export function createScene(canvas, opts) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(opts.dpr); renderer.setSize(opts.w, opts.h, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, opts.w / opts.h, 0.1, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc6ddd3, 1.55);
  const key = new THREE.DirectionalLight(0xffffff, 2.0), LDIR = new THREE.Vector3(-0.5, 1, 0.55).normalize();
  key.castShadow = true; key.shadow.mapSize.set(opts.mobile ? 1024 : 2048, opts.mobile ? 1024 : 2048);
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.camera.near = 1; key.shadow.camera.far = 90;
  scene.add(hemi, key, key.target);

  const S = { k: 0, t: 0, cut: 2, stick: [0.23, 0.47, 0.47, 0.5, 1], reg: { cx: 0.7, cy: 0.5, fw: 0.5, fh: 0.7 }, w: opts.w, h: opts.h, mobile: !!opts.mobile, reduce: !!opts.reduce, vis: true, calc: { citas: 200, tasa: 15, ticket: 85, modo: 'pierde', v: 0 } };
  const white = new THREE.Color(WHITE), mint = new THREE.Color(MINT), col = new THREE.Color(), cLost = new THREE.Color(), cPlate = new THREE.Color(), cLine = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q0 = new THREE.Quaternion(), E = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), tmp = new THREE.Vector3();
  const lambert = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
  const shadowed = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
  function inst(geo, count, material) {
    const m = new THREE.InstancedMesh(geo, material || lambert(WHITE), count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false;
    for (let i = 0; i < count; i++) m.setColorAt(i, white);
    return m;
  }

  // ---- blocks (appointments) and gap outlines
  const tileGeo = new RoundedBoxGeometry(TW, TH, TD, 3, 0.05);
  const tiles = shadowed(inst(tileGeo, N)); scene.add(tiles);
  const outData = new Uint8Array(128 * 56 * 4);  // dashed rounded outline, drawn by hand so no 2D canvas is needed in the worker
  for (let y = 0; y < 56; y++) for (let x = 0; x < 128; x++) {
    const dx = Math.max(0, Math.abs(x - 63.5) - 52), dy = Math.max(0, Math.abs(y - 27.5) - 16), d = Math.hypot(dx, dy) - 9;
    const along = (x + y) % 11 < 6, a = Math.abs(d) < 1.6 && along ? 255 : 0, o = (y * 128 + x) * 4;
    outData[o] = outData[o + 1] = outData[o + 2] = 255; outData[o + 3] = a;
  }
  const outTex = new THREE.DataTexture(outData, 128, 56); outTex.magFilter = THREE.LinearFilter; outTex.minFilter = THREE.LinearFilter; outTex.needsUpdate = true;
  const outGeo = new THREE.PlaneGeometry(TW, TD); outGeo.rotateX(-Math.PI / 2);
  const outMat = new THREE.MeshBasicMaterial({ map: outTex, transparent: true, depthWrite: false, opacity: 0.6 });
  const outlines = inst(outGeo, N, outMat); scene.add(outlines);

  // ---- plates: one per week, one for the month view, one under the lost pile, plus the soft shadow on the page
  const plateMat = () => lambert(0xcbe8dc, { transparent: true, opacity: 0 });
  const plateGeo = new RoundedBoxGeometry(BW + 0.5, 0.12, BD + 0.5, 3, 0.06);
  const plates = [0, 1, 2, 3].map(() => { const m = shadowed(new THREE.Mesh(plateGeo, plateMat()), false); m.position.y = -0.07; scene.add(m); return m; });
  const wallPlate = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), plateMat()), false); wallPlate.position.y = -0.07; scene.add(wallPlate);
  const pilePlate = shadowed(new THREE.Mesh(new RoundedBoxGeometry(4.2, 0.12, 3.2, 3, 0.06), plateMat()), false); pilePlate.position.y = -0.07; scene.add(pilePlate);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.16, depthWrite: false })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // weekday initials, flat on the plate (bitmap drawn by the page so it uses the site font)
  let days = null;
  if (opts.bitmaps && opts.bitmaps.dias) {
    const t = new THREE.Texture(opts.bitmaps.dias); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    const g = new THREE.PlaneGeometry(BW, BW * opts.bitmaps.dias.height / opts.bitmaps.dias.width); g.rotateX(-Math.PI / 2);
    days = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 })); days.position.set(0, 0.002, -BD / 2 - 0.62); scene.add(days);
  }
  let euro = null;
  if (opts.bitmaps && opts.bitmaps.euro) {
    const t = new THREE.Texture(opts.bitmaps.euro); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    euro = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, opacity: 0 })); euro.userData.ratio = opts.bitmaps.euro.width / opts.bitmaps.euro.height; scene.add(euro);
  }

  // ---- soft cut: erases whatever is drawn below a given height, so on phones the agenda never runs into the text under it
  const eraser = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { cut: { value: 0 }, fade: { value: 40 } },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'uniform float cut;uniform float fade;void main(){gl_FragColor=vec4(0.,0.,0.,1.-smoothstep(cut,cut+fade,gl_FragCoord.y));}',
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor
  }));
  eraser.frustumCulled = false; eraser.renderOrder = 999; scene.add(eraser);
  const bufSize = new THREE.Vector2();

  // ---- the empty chair inside the gap, and the waiting list (demo)
  const REC = THREE.MathUtils.degToRad(35), LEG = THREE.MathUtils.degToRad(18), CH = 0.5;
  const sp = [slotX(SLOT % COLS), slotZ(Math.floor(SLOT / COLS))];
  const chair = new THREE.Group(); chair.position.set(sp[0] + 0.06, 0, sp[1]); chair.rotation.y = Math.PI / 2; scene.add(chair);
  const upholstery = lambert(0xffffff), metal = lambert(0x93a79e), lampMat = new THREE.MeshBasicMaterial({ color: 0xb5c4bd });
  const part = (geo, m, px, py, pz, rx = 0, ry = 0) => { const o = shadowed(new THREE.Mesh(geo, m)); o.position.set(px, py, pz); o.rotation.set(rx, ry, 0); chair.add(o); return o; };
  part(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 28), metal, 0, 0.05, 0);
  part(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 16), metal, 0, 0.31, 0);
  part(new RoundedBoxGeometry(0.72, 0.16, 0.78, 3, 0.06), upholstery, 0, 0.6, 0.05);
  part(new RoundedBoxGeometry(0.68, 0.14, 1.0, 3, 0.06), upholstery, 0, 0.62 + 0.5 * Math.sin(REC), -0.34 - 0.5 * Math.cos(REC), REC);
  part(new RoundedBoxGeometry(0.4, 0.12, 0.3, 3, 0.05), upholstery, 0, 0.64 + 1.14 * Math.sin(REC), -0.34 - 1.14 * Math.cos(REC), REC);
  part(new RoundedBoxGeometry(0.6, 0.12, 0.72, 3, 0.05), upholstery, 0, 0.6 - 0.36 * Math.sin(LEG), 0.44 + 0.36 * Math.cos(LEG), LEG);
  part(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 10), metal, 0.62, 1.0, -0.55);
  part(new THREE.BoxGeometry(0.06, 0.06, 0.87), metal, 0.31, 2.0, -0.25, 0, Math.atan2(-0.62, 0.6));
  const lamp = part(new THREE.CylinderGeometry(0.17, 0.3, 0.13, 24), lampMat, 0, 1.92, 0.05); lamp.castShadow = false;
  const seatPos = new THREE.Vector3(0, 1.06, -0.55).multiplyScalar(CH).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).add(chair.position);
  const seatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(REC - Math.PI / 2, Math.PI / 2, 0, 'YXZ'));
  const pillGeo = new THREE.CapsuleGeometry(0.17, 0.5, 6, 14);
  const WAIT = [0, -1, 1].map((d) => new THREE.Vector3(BW / 2 + 0.75, 0.21, sp[1] + 0.1 + d * 0.5));
  const waiting = [0, 1, 2].map(() => { const m = shadowed(new THREE.Mesh(pillGeo, lambert(0xffffff))); m.scale.setScalar(0.0001); scene.add(m); return m; });
  // the bench the waiting list stands on, beside the agenda
  const bench = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.12, 1.75, 3, 0.06), lambert(0x0e5c4d)), false); bench.position.set(BW / 2 + 0.75, -0.07, sp[1] + 0.1); bench.scale.setScalar(0.0001); scene.add(bench);

  // ---- layers 2 and 3 of "the three leaks": patients who stopped coming and out-of-hours enquiries
  const layerB = new THREE.Group(), layerC = new THREE.Group(); scene.add(layerB, layerC);
  const lpB = shadowed(new THREE.Mesh(plateGeo, plateMat()), false), lpC = shadowed(new THREE.Mesh(plateGeo, plateMat()), false);
  lpB.position.y = lpC.position.y = -0.07; layerB.add(lpB); layerC.add(lpC);
  const DX = 14, DZ = 8, ND = DX * DZ, RISE_B = [33, 86], RISE_C = 3;
  const dotPos = (n) => [(n % DX - (DX - 1) / 2) * (BW / DX), 0.19, (Math.floor(n / DX) - (DZ - 1) / 2) * (BD / DZ)];
  const crowd = shadowed(inst(pillGeo, ND, lambert(WHITE, { transparent: true }))); layerB.add(crowd);
  const cDorm = new THREE.Color(0xa9bbb3), cAwake = new THREE.Color(0xffffff);
  const MSG = [[-2.2, -1.9], [-0.6, -2.3], [1.5, -1.6], [2.3, 0.3], [-1.6, 0.9], [0.4, 1.8], [2.0, 2.1]];
  const msgs = shadowed(inst(new RoundedBoxGeometry(0.56, 0.12, 0.34, 2, 0.05), MSG.length, lambert(WHITE, { transparent: true }))); layerC.add(msgs);
  const risers = [0, 1, 2].map(() => { const m = shadowed(new THREE.Mesh(tileGeo, lambert(MINT))); m.scale.setScalar(0.0001); scene.add(m); return m; });
  // "connected" bar on weeks 2 to 4
  const bars = [1, 2, 3].map((w) => { const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, BD + 0.5), lambert(MINT))); m.position.set(w * GAP - BW / 2 - 0.45, 0.01, 0); scene.add(m); return m; });

  // ---- month view of the calculator: lost appointments leave the agenda and pile up in front of it
  const order = Array.from({ length: N }, (_, i) => hash(i + 7.31));
  let wall = null, wallKey = '';
  function layout() {
    const c = S.calc, key = c.v + '|' + c.citas + '|' + c.tasa + '|' + c.ticket + '|' + S.mobile;
    if (key === wallKey) return wall;
    wallKey = key;
    const unit = c.citas <= 250 ? 1 : c.citas <= 500 ? 2 : 4;
    const shown = Math.max(1, Math.round(c.citas / unit)), cols = S.mobile ? 10 : 14, rows = Math.ceil(shown / cols);
    const T = c.tasa / 100, holes = Math.min(shown, Math.round(shown * T));
    const recFrac = T > 0 ? (Math.max(0, T - 0.06) + Math.min(T, 0.06) * 0.45) / T : 0, nRec = Math.round(holes * recFrac);
    const lost = new Int16Array(N).fill(-1), rec = new Uint8Array(N);
    Array.from({ length: shown }, (_, i) => i).sort((a, b) => order[a] - order[b]).slice(0, holes).forEach((i, n) => { lost[i] = n; if (n < nRec) rec[i] = 1; });
    // blocks that cannot be recovered take the lowest places of the pile, so nothing floats when the rest fly back
    let n = 0; const place = new Int16Array(N).fill(-1);
    Array.from({ length: shown }, (_, i) => i).filter((i) => lost[i] >= 0).sort((a, b) => (rec[a] - rec[b]) || (lost[a] - lost[b])).forEach((i) => { place[i] = n++; });
    const h = lerp(0.7, 2.8, clamp((c.ticket - 30) / 470)), depth = rows * PZ;
    wall = { unit, shown, cols, rows, lost, rec, place, h, depth, pz: depth / 2 + 2.2, holes };
    return wall;
  }
  const PILE_COLS = 3, PILE_ROWS = 5, PER = PILE_COLS * PILE_ROWS;
  function pileSlot(n, L, P) {
    const layer = Math.floor(n / PER), i = n % PER;
    P.x = (i % PILE_COLS - 1) * 1.16 + (hash(n + 1.3) - 0.5) * 0.14;
    P.z = L.pz + (Math.floor(i / PILE_COLS) - 2) * 0.53 + (hash(n + 9.1) - 0.5) * 0.08;
    P.y = layer * (TH * L.h + 0.012); P.ry = (hash(n + 3.7) - 0.5) * 0.26;
  }

  // ---- pose of every block at every moment
  const KEYS = ['x', 'y', 'z', 's', 'h', 'm', 'd', 'o', 'rx', 'ry', 'ox', 'oz'], F = KEYS.length;
  const cur = new Float32Array(N * F), tgt = new Float32Array(N * F), A = {}, B = {};
  const drop = (P, p) => { if (p >= 1) { P.m = 1; return; } if (p <= 0) { P.s = 0; P.o = 1; return; } P.m = 1; P.y = (1 - easeOut(p)) * 1.5; P.s = lerp(0.55, 1, easeOutBack(p)); P.o = 1 - seg(p, 0.6, 1); };
  const lift = (P, p) => { if (p <= 0) return; P.y = easeOut(p) * 1.1; P.s = 1 - smooth(p); P.o = seg(p, 0.5, 1); };
  const fall = (P, p) => { if (p <= 0) return; P.y = -2.6 * p * p; P.rx = p * 1.1; P.s = 1 - seg(p, 0.55, 1); P.o = seg(p, 0.15, 0.5); P.d = seg(p, 0, 0.4); };
  function pose(k, i, u, time, P) {
    const w = Math.floor(i / WEEK), j = i % WEEK, c = j % COLS, r = Math.floor(j / COLS);
    P.x = P.ox = slotX(c); P.z = P.oz = slotZ(r); P.y = 0; P.s = 1; P.h = 1; P.m = 0; P.d = 0; P.o = 0; P.rx = 0; P.ry = 0;
    if (k <= 2) {
      if (w > 0) { P.s = 0; return; }
      if (g0.has(j)) drop(P, S.reduce ? 1 : seg(time, FILL0 + g0.get(j) * FILL_STEP, FILL0 + g0.get(j) * FILL_STEP + FILL_DUR));
      // the demo slot stays empty while the chair stands in it
      if (j === SLOT) { if (k === 1) { lift(P, seg(u, 0.04, 0.18)); if (u >= 0.18) { P.s = 0; P.o = 0; } } else if (k === 2) P.m = 1; }
      if (g2.has(j) && k === 2) {
        const n = g2.get(j);
        if (u >= BACK2[n]) P.m = 1;
        else if (n < 2 && u > BACK2[n] - 0.09) drop(P, seg(u, BACK2[n] - 0.09, BACK2[n]));
        else fall(P, seg(u, 0.06 + n * 0.025, 0.2 + n * 0.025));
      }
      return;
    }
    if (k === 3) {
      if (w > 3) { P.s = 0; return; }
      P.x += w * GAP; P.ox = P.x;
      const ap = w === 0 ? 1 : easeOut(seg(u, w * 0.04, 0.14 + w * 0.04));
      P.s = ap;
      const gi = GW[w].indexOf(j);
      if (gi >= 0) {
        if (w <= 1) { P.s = 0; P.o = ap; }
        else if (w === 2) { if (gi % 2 === 0) { P.m = 0.5; P.h = 0.55; } else { P.s = 0; P.o = ap; } }
        else P.m = 1;
      }
      return;
    }
    const L = layout();
    P.x = P.ox = (i % L.cols - (L.cols - 1) / 2) * PX; P.z = P.oz = (Math.floor(i / L.cols) - (L.rows - 1) / 2) * PZ; P.h = L.h;
    if (i >= L.shown) { P.s = 0; return; }
    if (L.lost[i] >= 0) {
      const rec = S.calc.modo === 'recupera';
      if (rec && L.rec[i]) { P.m = 1; return; }
      P.o = 1; P.d = 1; pileSlot(L.place[i], L, P);
    }
  }

  // ---- camera: the page says where the object lives (a region of the canvas); the scene says what must fit in it
  function frameOf(k, u, time) {
    const m = S.mobile;
    if (k === 0) { const sway = S.reduce || opts.fixedTime != null ? 0 : Math.sin(time * 0.35) * 0.04 * seg(time, 1, 4); return m ? { look: [0, 0, 0.1], dir: [-0.3 + sway, 0.95, 0.72], span: [7.9, 6.9] } : { look: [0, 0, 0.1], dir: [-0.38 + sway, 0.72, 0.9], span: [8.4, 5.7] }; }
    if (k === 1) return m ? { look: [sp[0] + 0.2, 0.42, sp[1]], dir: [-0.34, 0.5, 0.85], span: [3.5, 2.7] } : { look: [sp[0] + 0.25, 0.45, sp[1]], dir: [-0.4, 0.44, 0.9], span: [3.9, 2.9] };
    if (k === 2) return { look: [0, -LAYER, 0.2], dir: [-0.55, 0.36, 0.9], span: [9.4, 11] };
    if (k === 3) return { look: [GAP * [0.25, 0.5, 0.75].reduce((x, c) => x + smooth(seg(u, c - 0.08, c + 0.08)), 0), 0, 0], dir: [-0.3, 0.7, 0.9], span: m ? [BW + 1.8, 5.9] : [BW + 9, 5.9] };
    const L = layout(), deep = L.depth + 4.6;
    return { look: [0, 0, 1.3], dir: [-0.14, 0.95, 0.66], span: [Math.max(L.cols * PX, 6) + 1.6, deep * 0.86 + 1.4 + L.h * 0.3] };
  }
  const mix = (a, b, t) => ({ look: a.look.map((v, i) => lerp(v, b.look[i], t)), dir: a.dir.map((v, i) => lerp(v, b.dir[i], t)), span: a.span.map((v, i) => lerp(v, b.span[i], t)) });
  const camF = { look: [0, 0, 0], dir: [0, 0.7, 0.7], span: [8, 6] }, look = new THREE.Vector3(), dir = new THREE.Vector3();
  const reg = { cx: 0.7, cy: 0.5, fw: 0.5, fh: 0.7 };

  let first = true, t0 = 0, last = 0, eCur = 0, chairCur = 0, dirty = true, settled = false, blank = false, hold = 0;
  const towards = (obj, key, v, a) => { const d = v - obj[key]; obj[key] += d * a; return Math.abs(d); };

  function frame(now) {
    if (first) { t0 = now; last = now; }
    // opts.fixedTime freezes the clock: used to render the still images of each act
    const dt = Math.min(0.05, (now - last) / 1000), time = opts.fixedTime != null ? opts.fixedTime : (now - t0) / 1000; last = now;
    const k = S.k, st = S.stick[k] || 1, u = k < 4 ? seg(S.t, 0.02, st - 0.03) : 1, tb = k < 4 ? smooth(seg(S.t, st, 0.97)) : 0;
    const intro = !S.reduce && time < FILL0 + 8 * FILL_STEP + FILL_DUR + 0.2, idle = k === 0 && tb < 1 && !S.reduce;
    if (!S.vis) { if (!blank) { renderer.clear(); blank = true; } last = now; return false; }
    if (dirty) hold = 24; else hold--;
    if (!dirty && settled && hold <= 0 && !intro && !idle && !blank) return false;
    dirty = false; blank = false;
    const a = first ? 1 : 1 - Math.exp(-dt * 9);
    let move = 0;

    // blocks
    for (let i = 0; i < N; i++) {
      pose(k, i, u, time, A);
      if (tb > 0) { pose(k + 1, i, 0, time, B); for (const key of KEYS) A[key] = lerp(A[key], B[key], tb); }
      const o = i * F; for (let n = 0; n < F; n++) tgt[o + n] = A[KEYS[n]];
    }
    for (let n = 0; n < N * F; n++) { const d = tgt[n] - cur[n]; cur[n] += d * a; if (d > move) move = d; else if (-d > move) move = -d; }
    const th = THEME[k], th2 = THEME[Math.min(4, k + 1)];
    cLost.setHex(th.lost).lerp(cA.setHex(th2.lost), tb); cPlate.setHex(th.plate).lerp(cA.setHex(th2.plate), tb); cLine.setHex(th.line).lerp(cA.setHex(th2.line), tb);
    for (let i = 0; i < N; i++) {
      const o = i * F, s = Math.max(0, cur[o + 3]), h = cur[o + 4], oa = clamp(cur[o + 7]);
      pos.set(cur[o], cur[o + 1] + TH * h * s / 2, cur[o + 2]); scl.set(s, s * h, s);
      Q.setFromEuler(E.set(cur[o + 8], cur[o + 9], 0)); M.compose(pos, Q, scl); tiles.setMatrixAt(i, M);
      col.copy(white).lerp(cLost, clamp(cur[o + 6])).lerp(mint, clamp(cur[o + 5])); tiles.setColorAt(i, col);
      pos.set(cur[o + 10], 0.006, cur[o + 11]); scl.set(oa, 1, oa); M.compose(pos, Q0, scl); outlines.setMatrixAt(i, M);
    }
    tiles.instanceMatrix.needsUpdate = true; tiles.instanceColor.needsUpdate = true; outlines.instanceMatrix.needsUpdate = true;
    outMat.color.copy(cLine);

    // plates
    const pa = (kk, uu, w) => (kk <= 2 ? (w === 0 ? 1 : 0) : kk === 3 ? (w === 0 ? 1 : easeOut(seg(uu, w * 0.04, 0.14 + w * 0.04))) : 0);
    plates.forEach((p, w) => {
      move = Math.max(move, towards(p.material, 'opacity', lerp(pa(k, u, w), pa(k + 1, 0, w), tb), a));
      towards(p.position, 'x', lerp(k === 3 ? w * GAP : 0, k + 1 === 3 ? w * GAP : 0, tb), a);
      p.material.color.copy(cPlate); p.visible = p.material.opacity > 0.01;
    });
    const L = layout(), inCalc = lerp(k === 4 ? 1 : 0, k + 1 === 4 ? 1 : 0, tb);
    move = Math.max(move, towards(wallPlate.material, 'opacity', inCalc, a));
    wallPlate.scale.set(L.cols * PX + 0.5, 1, L.depth + 0.5); wallPlate.material.color.copy(cPlate); wallPlate.visible = wallPlate.material.opacity > 0.01;
    pilePlate.material.opacity = wallPlate.material.opacity; pilePlate.position.z = L.pz; pilePlate.material.color.copy(cPlate); pilePlate.visible = wallPlate.visible;
    if (days) { towards(days.material, 'opacity', lerp(k <= 2 ? 0.75 : 0, k + 1 <= 2 ? 0.75 : 0, tb), a); days.material.color.copy(cLine); days.visible = days.material.opacity > 0.01; }

    // demo: chair in the gap, waiting list, Marta takes the seat
    const chairT = k === 1 ? easeOutBack(seg(u, 0.16, 0.3)) * (1 - seg(tb, 0, 0.5)) : 0;
    move = Math.max(move, Math.abs(chairT - chairCur)); chairCur += (chairT - chairCur) * a; chair.scale.setScalar(Math.max(0.0001, chairCur * CH)); chair.visible = chairCur > 0.02;
    const benchT = k === 1 ? easeOut(seg(u, 0.26, 0.36)) * (1 - seg(u, 0.8, 0.92)) * (1 - seg(tb, 0, 0.5)) : 0;
    bench.scale.set(1, 1, Math.max(0.0001, benchT)); bench.visible = benchT > 0.01; bench.material.color.copy(cPlate);
    const seated = k === 1 && u >= 0.72;
    lampMat.color.lerp(cA.setHex(seated ? MINT : 0xb5c4bd), a);
    waiting.forEach((m, i) => {
      let s = 0, mm = 0, lie = 0;
      if (k === 1 && tb < 0.5) {
        const w0 = WAIT[i], hop = Math.sin(Math.PI * seg(u, 0.38 + i * 0.04, 0.46 + i * 0.04)) * 0.3;
        s = easeOutBack(seg(u, 0.3 + i * 0.03, 0.4 + i * 0.03)) * 0.5;
        m.position.set(w0.x, w0.y + hop, w0.z);
        if (i === 0) {
          const p = easeInOut(seg(u, 0.52, 0.72));
          m.position.lerpVectors(tmp.set(w0.x, w0.y + hop, w0.z), seatPos, p); m.position.y += Math.sin(Math.PI * p) * 0.7;
          s = lerp(s, CH, p); mm = seg(u, 0.48, 0.54); lie = seg(p, 0.55, 1);
        } else s *= 1 - seg(u, 0.78, 0.9);
        s *= 1 - seg(tb, 0, 0.5);
      }
      Q.identity(); if (lie > 0) Q.slerp(seatQ, lie); m.quaternion.copy(Q);
      m.scale.setScalar(Math.max(0.0001, s)); m.visible = s > 0.01; m.material.color.copy(white).lerp(mint, mm);
    });
    if (euro) { const al = k === 1 ? seg(u, 0.76, 0.84) * (1 - seg(tb, 0, 0.4)) : 0, sc = 1.25 * (0.8 + 0.2 * easeOutBack(seg(u, 0.76, 0.86))); euro.material.opacity = al; euro.visible = al > 0.01; euro.position.set(sp[0] - 0.1, 1.5, sp[1]); euro.scale.set(sc * euro.userData.ratio * 0.42, sc * 0.42, 1); }

    // the three leaks: the board opens into layers
    const eT = k === 2 ? easeInOut(seg(u, 0, 0.2)) * (1 - tb) : 0; move = Math.max(move, Math.abs(eT - eCur)); eCur += (eT - eCur) * a;
    layerB.position.y = -LAYER * eCur; layerC.position.y = -2 * LAYER * eCur;
    const la = clamp(eCur * 1.7);
    lpB.material.opacity = lpC.material.opacity = crowd.material.opacity = msgs.material.opacity = la;
    lpB.material.color.copy(cPlate); lpC.material.color.copy(cPlate);
    layerB.visible = layerC.visible = la > 0.01;
    if (layerB.visible) {
      for (let n = 0; n < ND; n++) {
        const p = dotPos(n), ri = RISE_B.indexOf(n), start = ri < 0 ? 9 : 0.54 + ri * 0.06;
        pos.set(p[0], p[1], p[2]); scl.setScalar(u >= start ? 0 : 0.45); M.compose(pos, Q0, scl); crowd.setMatrixAt(n, M);
        crowd.setColorAt(n, ri >= 0 && u > start - 0.1 ? mint : hash(n) < 0.6 ? cDorm : cAwake);
      }
      crowd.instanceMatrix.needsUpdate = true; crowd.instanceColor.needsUpdate = true;
      MSG.forEach((p, n) => {
        pos.set(p[0], 0.06, p[1]); scl.setScalar(n === RISE_C && u >= 0.78 ? 0 : 1); M.compose(pos, Q0, scl); msgs.setMatrixAt(n, M);
        msgs.setColorAt(n, n === RISE_C && u > 0.7 ? mint : cAwake);
      });
      msgs.instanceMatrix.needsUpdate = true; msgs.instanceColor.needsUpdate = true;
    }
    risers.forEach((m, i) => {
      let s = 0;
      if (k === 2 && tb < 1) {
        const from = i < 2 ? dotPos(RISE_B[i]) : [MSG[RISE_C][0], 0.06, MSG[RISE_C][1]], fy = (i < 2 ? -LAYER : -2 * LAYER) * eCur;
        const j = G2[i + 2], a0 = i < 2 ? 0.54 + i * 0.06 : 0.78, a1 = BACK2[i + 2], p = easeInOut(seg(u, a0, a1));
        m.position.set(lerp(from[0], slotX(j % COLS), p), lerp(from[1] + fy, TH / 2, p), lerp(from[2], slotZ(Math.floor(j / COLS)), p));
        s = u >= a0 && u < a1 ? lerp(0.3, 1, p) : 0;
      }
      m.scale.setScalar(Math.max(0.0001, s)); m.visible = s > 0.01;
    });
    bars.forEach((bar, n) => { const s = k === 3 ? easeOut(seg(u, 0.1 + n * 0.04, 0.3 + n * 0.04)) * (1 - tb) : 0; bar.scale.z = Math.max(0.0001, s); bar.visible = s > 0.01; });

    // camera
    const f = tb > 0 ? mix(frameOf(k, u, time), frameOf(k + 1, 0, time), tb) : frameOf(k, u, time), ac = first ? 1 : 1 - Math.exp(-dt * 6);
    for (let i = 0; i < 3; i++) { move = Math.max(move, Math.abs(f.look[i] - camF.look[i]) * 0.1); camF.look[i] += (f.look[i] - camF.look[i]) * ac; camF.dir[i] += (f.dir[i] - camF.dir[i]) * ac; }
    for (let i = 0; i < 2; i++) { move = Math.max(move, Math.abs(f.span[i] - camF.span[i]) * 0.1); camF.span[i] += (f.span[i] - camF.span[i]) * ac; }
    // the region follows the page layout exactly: any easing here would let the agenda drift from its slot while scrolling
    for (const key of ['cx', 'cy', 'fw', 'fh']) reg[key] = S.reg[key];
    camera.aspect = S.w / S.h;
    camera.setViewOffset(S.w, S.h, (0.5 - reg.cx) * S.w, (0.5 - reg.cy) * S.h, S.w, S.h);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(camF.span[0] / (2 * tanV * camera.aspect * Math.max(0.05, reg.fw)), camF.span[1] / (2 * tanV * Math.max(0.05, reg.fh)));
    look.set(camF.look[0], camF.look[1], camF.look[2]); dir.set(camF.dir[0], camF.dir[1], camF.dir[2]).normalize();
    camera.position.copy(look).addScaledVector(dir, d); camera.lookAt(look);

    // light follows the camera target so the shadow map always covers what is on screen
    const R = Math.max(camF.span[0], camF.span[1]) * 0.8 + 2, sc = key.shadow.camera;
    key.target.position.copy(look); key.position.copy(look).addScaledVector(LDIR, 40); key.target.updateMatrixWorld();
    if (Math.abs(sc.right - R) > 0.05) { sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix(); }
    // how far the agenda floats above the page: more where it is the whole picture, less where it is a close-up
    ground.position.set(look.x, -2 * LAYER * eCur - 0.14 - lerp(DROP[k], DROP[Math.min(4, k + 1)], tb), look.z);
    renderer.getDrawingBufferSize(bufSize);
    eraser.visible = S.cut < 1; eraser.material.uniforms.cut.value = (1 - S.cut) * bufSize.y; eraser.material.uniforms.fade.value = bufSize.y * 0.05;
    ground.material.opacity = lerp(th.shadow, th2.shadow, tb);

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
