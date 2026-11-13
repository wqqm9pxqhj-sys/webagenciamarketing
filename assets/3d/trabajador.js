// Worker that owns the OffscreenCanvas and the render loop, so the page's main thread stays free for scrolling.
const raf = self.requestAnimationFrame ? (fn) => self.requestAnimationFrame(fn) : (fn) => setTimeout(() => fn(performance.now()), 16);
let scene = null, running = false, drawn = 0, streak = 0, acc = 0, prev = 0, reported = false;
const queued = [];

// Without GPU acceleration (SwiftShader, llvmpipe…) the scene would be drawn by the CPU and starve the page.
// Checked on a throwaway context before three.js is even downloaded.
function softwareGL() {
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl');
    if (!gl) return true;
    let name = String(gl.getParameter(gl.RENDERER) || '');
    if (/^webkit webgl$/i.test(name)) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''); }
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (err) { return true; }
}

function loop(now) {
  if (!running) return;
  let drew = false;
  try { drew = scene.frame(now); } catch (err) { running = false; postMessage({ type: 'error', message: String(err && err.message || err) }); return; }
  if (drew) {
    if (++drawn === 2) postMessage({ type: 'ready' });
    // average frame time over a run of consecutive frames, so the page can fall back to the still images on slow devices
    if (prev && !reported) { streak++; if (streak > 12) acc += now - prev; if (streak === 60) { reported = true; postMessage({ type: 'perf', ms: acc / 48 }); } }
    prev = now;
  } else { prev = 0; if (!reported) { streak = 0; acc = 0; } }
  raf(loop);
}

function apply(m) {
  if (m.type === 'state') scene.set(m.state);
  else if (m.type === 'resize') scene.resize(m.w, m.h, m.dpr);
  else if (m.type === 'stop') running = false;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type !== 'init') { if (scene) apply(m); else queued.push(m); return; }
  try {
    if (!m.opts.force && softwareGL()) { postMessage({ type: 'error', message: 'no GPU acceleration' }); return; }
    const { createScene } = await import('./escena.js');
    m.canvas.addEventListener('webglcontextlost', () => { running = false; postMessage({ type: 'error', message: 'context lost' }); });
    scene = createScene(m.canvas, m.opts); running = true;
    queued.splice(0).forEach(apply);
    if (running) raf(loop);
  } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); }
};
