import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const client = path.join(root, 'build', 'client');
const port = Number(process.env.PORT || 3000);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

async function fileResponse(file) {
  try { const info = await stat(file); if (!info.isFile()) return null; return { body: await readFile(file), type: mime[path.extname(file)] || 'application/octet-stream' }; } catch { return null; }
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, service: 'hisham-academy', time: new Date().toISOString() }));
  }
  if (url.pathname === '/manus-routes.json') {
    const file = await fileResponse(path.join(client, 'manus-routes.json'));
    if (file) { res.writeHead(200, { 'content-type': file.type }); return res.end(file.body); }
  }
  const requested = path.resolve(client, `.${url.pathname}`);
  const safe = requested.startsWith(client) ? requested : path.join(client, 'index.html');
  const file = await fileResponse(safe) || await fileResponse(path.join(client, 'index.html'));
  if (!file) { res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Application is not built. Run: npm run build'); }
  res.writeHead(200, { 'content-type': file.type, 'cache-control': url.pathname === '/' ? 'no-cache' : 'public, max-age=31536000, immutable' });
  res.end(file.body);
});
server.listen(port, '0.0.0.0', () => console.log(`Hisham Academy listening on :${port}`));
