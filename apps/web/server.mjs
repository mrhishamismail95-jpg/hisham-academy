import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const root = path.dirname(fileURLToPath(import.meta.url));
const client = path.join(root, 'build', 'client');
const port = Number(process.env.PORT || 3000);
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

async function fileResponse(file) {
  try { const info = await stat(file); if (!info.isFile()) return null; return { body: await readFile(file), type: mime[path.extname(file)] || 'application/octet-stream' }; } catch { return null; }
}
function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': process.env.CORS_ORIGINS || '*' }); res.end(JSON.stringify(data)); }
async function body(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (raw.length > 100_000) throw new Error('payload_too_large'); return raw ? JSON.parse(raw) : {}; }
function requireDb(res) { if (!sql) { send(res, 503, { error: 'DATABASE_URL غير مضبوط. أضف متغير قاعدة البيانات ثم شغّل migrations.' }); return false; } return true; }
function requireAdmin(req, res) { const key = process.env.ADMIN_API_KEY; if (key && req.headers['x-admin-key'] !== key) { send(res, 401, { error: 'مفتاح الإدارة غير صحيح' }); return false; } return true; }

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, service: 'hisham-academy', database: Boolean(sql), time: new Date().toISOString() });
  if (url.pathname === '/api/academy/packages' && req.method === 'GET') {
    if (!requireDb(res)) return true;
    try { const packages = await sql`SELECT id, name, description, sessions_count, price, currency, is_featured, is_active, sort_order FROM academy_packages WHERE is_active = TRUE ORDER BY sort_order, id`; return send(res, 200, { packages }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة الباقات', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/packages' && req.method === 'POST') {
    if (!requireDb(res) || !requireAdmin(req, res)) return true;
    try { const input = await body(req); const rows = await sql`INSERT INTO academy_packages (name, description, sessions_count, price, currency, is_featured, sort_order) VALUES (${String(input.name || '').trim()}, ${input.description || null}, ${Number(input.sessionsCount || 4)}, ${Number(input.price || 0)}, ${input.currency || 'SAR'}, ${Boolean(input.isFeatured)}, ${Number(input.sortOrder || 0)}) RETURNING *`; return send(res, 201, { package: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر حفظ الباقة', detail: error.message }); }
  }
  const packageMatch = url.pathname.match(/^\/api\/academy\/packages\/(\d+)$/);
  if (packageMatch && req.method === 'DELETE') {
    if (!requireDb(res) || !requireAdmin(req, res)) return true;
    try { await sql`UPDATE academy_packages SET is_active = FALSE, updated_at = NOW() WHERE id = ${Number(packageMatch[1])}`; return send(res, 200, { ok: true }); } catch (error) { return send(res, 400, { error: 'تعذر إيقاف الباقة', detail: error.message }); }
  }
  if (packageMatch && req.method === 'PATCH') {
    if (!requireDb(res) || !requireAdmin(req, res)) return true;
    try { const input = await body(req); const rows = await sql`UPDATE academy_packages SET name = COALESCE(${input.name || null}, name), description = COALESCE(${input.description || null}, description), sessions_count = COALESCE(${input.sessionsCount ? Number(input.sessionsCount) : null}, sessions_count), price = COALESCE(${input.price !== undefined ? Number(input.price) : null}, price), is_featured = COALESCE(${input.isFeatured === undefined ? null : Boolean(input.isFeatured)}, is_featured), updated_at = NOW() WHERE id = ${Number(packageMatch[1])} RETURNING *`; return send(res, 200, { package: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر تعديل الباقة', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/registrations' && req.method === 'POST') {
    if (!requireDb(res)) return true;
    try {
      const input = await body(req); const type = ['student','parent','teacher'].includes(input.requestType) ? input.requestType : null;
      const name = String(input.fullName || input.name || '').trim(); const phone = String(input.phone || '').trim();
      if (!type || !name || !phone) return send(res, 422, { error: 'نوع التسجيل والاسم ورقم الهاتف حقول مطلوبة' });
      if (type !== 'teacher' && !String(input.grade || '').trim()) return send(res, 422, { error: 'المرحلة الدراسية مطلوبة' });
      if (type === 'teacher' && !String(input.subject || input.grade || '').trim()) return send(res, 422, { error: 'المادة مطلوبة للمعلم' });
      const code = `HA-${Date.now().toString(36).toUpperCase()}`;
      const rows = await sql`INSERT INTO registrations (registration_code, request_type, full_name, phone, grade, subject, package_id, notes) VALUES (${code}, ${type}, ${name}, ${phone}, ${input.grade || null}, ${input.subject || null}, ${input.packageId ? Number(input.packageId) : null}, ${input.notes || null}) RETURNING id, registration_code, created_at`;
      return send(res, 201, { ok: true, registration: rows[0] });
    } catch (error) { return send(res, 400, { error: 'تعذر حفظ طلب التسجيل', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/registrations' && req.method === 'GET') {
    if (!requireDb(res) || !requireAdmin(req, res)) return true;
    try { const registrations = await sql`SELECT r.*, p.name AS package_name FROM registrations r LEFT JOIN academy_packages p ON p.id = r.package_id ORDER BY r.created_at DESC LIMIT 200`; return send(res, 200, { registrations }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة طلبات التسجيل', detail: error.message }); }
  }
  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) { const handled = await handleApi(req, res, url); if (handled) return; return send(res, 404, { error: 'API route not found' }); }
    if (url.pathname === '/manus-routes.json') { const file = await fileResponse(path.join(client, 'manus-routes.json')); if (file) { res.writeHead(200, { 'content-type': file.type }); return res.end(file.body); } }
    const requested = path.resolve(client, `.${url.pathname}`); const safe = requested.startsWith(client) ? requested : path.join(client, 'index.html');
    const file = await fileResponse(safe) || await fileResponse(path.join(client, 'index.html'));
    if (!file) { res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Application is not built. Run: npm run build'); }
    res.writeHead(200, { 'content-type': file.type, 'cache-control': url.pathname === '/' ? 'no-cache' : 'public, max-age=31536000, immutable' }); res.end(file.body);
  } catch (error) { console.error(error); send(res, 500, { error: 'حدث خطأ غير متوقع' }); }
});
server.listen(port, '0.0.0.0', () => console.log(`Hisham Academy listening on :${port}`));
