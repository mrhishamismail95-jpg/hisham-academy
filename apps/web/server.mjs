import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const root = path.dirname(fileURLToPath(import.meta.url));
const client = path.join(root, 'build', 'client');
const port = Number(process.env.PORT || 3000);
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const COOKIE_NAME = 'ha_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
function sessionSecret() { return process.env.ACADEMY_SESSION_SECRET || process.env.AUTH_SECRET || ''; }
function makeSessionCookie(user) { const payload = Buffer.from(JSON.stringify({ id: String(user.id), email: user.email, role: user.role, name: user.full_name, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })).toString('base64url'); const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url'); const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Path=/; SameSite=Lax${secure}; Max-Age=${SESSION_MAX_AGE}`; }
function readSession(req) { const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1); if (!token || !sessionSecret()) return null; const [payload, signature] = token.split('.'); if (!payload || !signature) return null; const expected = createHmac('sha256', sessionSecret()).update(payload).digest(); const actual = Buffer.from(signature, 'base64url'); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null; try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return data.exp > Math.floor(Date.now() / 1000) ? data : null; } catch { return null; } }
function clearSessionCookie() { const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax${secure}; Max-Age=0`; }
function verifyPassword(password, stored) { const [, salt, expected] = String(stored || '').split('$'); if (!salt || !expected) return false; const actual = scryptSync(password, salt, 64).toString('hex'); return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
function requireAdminSession(req, res) { const session = readSession(req); if (!session || session.role !== 'admin') { send(res, 401, { error: 'يجب تسجيل الدخول كمدير' }); return null; } return session; }
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

async function fileResponse(file) {
  try { const info = await stat(file); if (!info.isFile()) return null; return { body: await readFile(file), type: mime[path.extname(file)] || 'application/octet-stream' }; } catch { return null; }
}
function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': process.env.CORS_ORIGINS || '*' }); res.end(JSON.stringify(data)); }
async function body(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (raw.length > 100_000) throw new Error('payload_too_large'); return raw ? JSON.parse(raw) : {}; }
function requireDb(res) { if (!sql) { send(res, 503, { error: 'DATABASE_URL غير مضبوط. أضف متغير قاعدة البيانات ثم شغّل migrations.' }); return false; } return true; }

async function handleApi(req, res, url) {
  if (url.pathname === '/api/auth/me' && req.method === 'GET') { const session = readSession(req); return send(res, 200, { authenticated: Boolean(session), user: session }); }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', clearSessionCookie()); return send(res, 200, { ok: true }); }
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    if (!requireDb(res)) return true;
    try { const input = await body(req); const email = String(input.email || '').trim().toLowerCase(); const password = String(input.password || ''); const rows = await sql`SELECT id, full_name, email, password_hash, role FROM academy_users WHERE LOWER(email) = ${email} AND is_active = TRUE LIMIT 1`; const user = rows[0]; if (!user || !verifyPassword(password, user.password_hash)) return send(res, 401, { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }); await sql`UPDATE academy_users SET last_login_at = NOW() WHERE id = ${user.id}`; res.setHeader('Set-Cookie', makeSessionCookie(user)); return send(res, 200, { ok: true, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } }); } catch (error) { return send(res, 400, { error: 'تعذر تسجيل الدخول', detail: error.message }); }
  }
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, service: 'hisham-academy', database: Boolean(sql), time: new Date().toISOString() });
  if (url.pathname === '/api/academy/packages' && req.method === 'GET') {
    if (!requireDb(res)) return true;
    try { const packages = await sql`SELECT id, name, description, sessions_count, price, currency, is_featured, is_active, sort_order FROM academy_packages WHERE is_active = TRUE ORDER BY sort_order, id`; return send(res, 200, { packages }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة الباقات', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/packages' && req.method === 'POST') {
    if (!requireDb(res) || !requireAdminSession(req, res)) return true;
    try { const input = await body(req); const rows = await sql`INSERT INTO academy_packages (name, description, sessions_count, price, currency, is_featured, sort_order) VALUES (${String(input.name || '').trim()}, ${input.description || null}, ${Number(input.sessionsCount || 4)}, ${Number(input.price || 0)}, ${input.currency || 'SAR'}, ${Boolean(input.isFeatured)}, ${Number(input.sortOrder || 0)}) RETURNING *`; return send(res, 201, { package: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر حفظ الباقة', detail: error.message }); }
  }
  const packageMatch = url.pathname.match(/^\/api\/academy\/packages\/(\d+)$/);
  if (packageMatch && req.method === 'DELETE') {
    if (!requireDb(res) || !requireAdminSession(req, res)) return true;
    try { await sql`UPDATE academy_packages SET is_active = FALSE, updated_at = NOW() WHERE id = ${Number(packageMatch[1])}`; return send(res, 200, { ok: true }); } catch (error) { return send(res, 400, { error: 'تعذر إيقاف الباقة', detail: error.message }); }
  }
  if (packageMatch && req.method === 'PATCH') {
    if (!requireDb(res) || !requireAdminSession(req, res)) return true;
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
    if (!requireDb(res) || !requireAdminSession(req, res)) return true;
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
