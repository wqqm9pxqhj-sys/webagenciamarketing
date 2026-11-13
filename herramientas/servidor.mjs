// Servidor local para pruebas: sirve la web como Vercel (direcciones sin .html) y ejecuta las funciones de api/.
// Uso, desde la raíz del repositorio:  node herramientas/servidor.mjs [puerto]     (por defecto, 4174)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PORT = Number(process.argv[2] || 4174);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

async function api(req, res, name) {
  const file = path.join(ROOT, 'api', name + '.mjs');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  try { req.body = raw ? JSON.parse(raw) : {}; } catch (err) { req.body = {}; }
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  const { default: handler } = await import(pathToFileURL(file).href);
  await handler(req, res);
}

http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (p.startsWith('/api/')) return await api(req, res, p.slice(5).replace(/[^a-z0-9_-]/gi, ''));
    const base = path.join(ROOT, path.normalize(p));
    if (!base.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const file = [base, base + '.html', path.join(base, 'index.html')].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream', head = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
    // text goes compressed, as on Vercel: without it the speed measurements would be pessimistic
    if (/^(text|application\/(json|manifest|xml))|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); res.end(zlib.gzipSync(fs.readFileSync(file))); return; }
    res.writeHead(200, head);
    fs.createReadStream(file).pipe(res);
  } catch (err) { res.writeHead(500).end(String(err && err.message)); }
}).listen(PORT, '127.0.0.1', () => console.log('http://127.0.0.1:' + PORT));
