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
function base32(buffer) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0, out = ''; for (const byte of buffer) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += alphabet[(value << (5 - bits)) & 31]; return out; }
function hotp(secret, counter) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0, bytes = []; for (const char of secret.replace(/=+$/, '').toUpperCase()) { value = (value << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } } const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter)); const digest = createHmac('sha1', Buffer.from(bytes)).update(msg).digest(); const offset = digest[19] & 15; return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0'); }
function verifyTotp(secret, code) { const counter = Math.floor(Date.now() / 30000); return [counter - 1, counter, counter + 1].some(item => hotp(secret, item) === String(code || '').replace(/\s/g, '')); }
async function audit(req, actorId, action, entityType, entityId, metadata = {}) { if (!sql) return; await sql`INSERT INTO academy_audit_logs (actor_user_id, action, entity_type, entity_id, metadata, ip_address) VALUES (${actorId ? Number(actorId) : null}, ${action}, ${entityType || null}, ${entityId ? String(entityId) : null}, ${JSON.stringify(metadata)}, ${req.socket.remoteAddress || null})`; }
function requireAdminSession(req, res) { const session = readSession(req); if (!session || session.role !== 'admin') { send(res, 401, { error: 'يجب تسجيل الدخول كمدير' }); return null; } return session; }
async function requirePermission(req, res, permission) { const session = readSession(req); if (!session) { send(res, 401, { error: 'يجب تسجيل الدخول' }); return null; } if (!sql) { send(res, 503, { error: 'DATABASE_URL غير مضبوط' }); return null; } const rows = await sql`SELECT role, is_active FROM academy_users WHERE id = ${Number(session.id)} LIMIT 1`; const user = rows[0]; if (!user || !user.is_active) { send(res, 401, { error: 'الحساب غير نشط' }); return null; } if (user.role === 'admin') return session; const roles = await sql`SELECT permissions FROM academy_roles WHERE role_key = ${user.role} LIMIT 1`; const permissions = Array.isArray(roles[0]?.permissions) ? roles[0].permissions : []; if (!permissions.includes(permission)) { send(res, 403, { error: 'لا تملك الصلاحية المطلوبة', permission }); return null; } return session; }
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

async function fileResponse(file) {
  try { const info = await stat(file); if (!info.isFile()) return null; return { body: await readFile(file), type: mime[path.extname(file)] || 'application/octet-stream' }; } catch { return null; }
}
function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': process.env.CORS_ORIGINS || '*' }); res.end(JSON.stringify(data)); }
async function body(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (raw.length > 100_000) throw new Error('payload_too_large'); return raw ? JSON.parse(raw) : {}; }
function requireDb(res) { if (!sql) { send(res, 503, { error: 'DATABASE_URL غير مضبوط. أضف متغير قاعدة البيانات ثم شغّل migrations.' }); return false; } return true; }

async function handleApi(req, res, url) {
  if (url.pathname === '/api/auth/me' && req.method === 'GET') { const session = readSession(req); if (!session || !sql) return send(res, 200, { authenticated: Boolean(session), user: session }); const rows = await sql`SELECT id, full_name, email, role, is_active FROM academy_users WHERE id = ${Number(session.id)} LIMIT 1`; const user = rows[0]; const active = Boolean(user?.is_active); return send(res, 200, { authenticated: active, user: active ? { id: String(user.id), full_name: user.full_name, email: user.email, role: user.role } : null }); }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', clearSessionCookie()); return send(res, 200, { ok: true }); }
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    if (!requireDb(res)) return true;
    try { const input = await body(req); const email = String(input.email || '').trim().toLowerCase(); const password = String(input.password || ''); const rows = await sql`SELECT id, full_name, email, password_hash, role, totp_enabled, totp_secret FROM academy_users WHERE LOWER(email) = ${email} AND is_active = TRUE LIMIT 1`; const user = rows[0]; if (!user || !verifyPassword(password, user.password_hash)) return send(res, 401, { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }); if (user.totp_enabled && !verifyTotp(user.totp_secret, input.totpCode)) return send(res, 401, { error: 'أدخل رمز المصادقة الثنائية', code: '2fa_required' }); await audit(req, user.id, 'auth.login', 'user', user.id); await sql`UPDATE academy_users SET last_login_at = NOW() WHERE id = ${user.id}`; res.setHeader('Set-Cookie', makeSessionCookie(user)); return send(res, 200, { ok: true, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } }); } catch (error) { return send(res, 400, { error: 'تعذر تسجيل الدخول', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/roles' && req.method === 'GET') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'users.view'))) return true;
    try { const roles = await sql`SELECT role_key, name, description, permissions, is_system FROM academy_roles WHERE is_active = TRUE ORDER BY id`; return send(res, 200, { roles }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة الأدوار', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/users' && req.method === 'GET') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'users.view'))) return true;
    try { const users = await sql`SELECT id, full_name, email, role, is_active, last_login_at, created_at FROM academy_users ORDER BY created_at DESC`; return send(res, 200, { users }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة المستخدمين', detail: error.message }); }
  }
  const userMatch = url.pathname.match(/^\/api\/academy\/users\/(\d+)$/);
  if (userMatch && req.method === 'PATCH') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'users.manage'))) return true;
    try { const input = await body(req); const id = Number(userMatch[1]); const role = input.role === undefined ? null : String(input.role); if (role) { const valid = await sql`SELECT 1 FROM academy_roles WHERE role_key = ${role} LIMIT 1`; if (!valid[0]) return send(res, 422, { error: 'الدور غير صالح' }); } const rows = await sql`UPDATE academy_users SET full_name = COALESCE(${input.fullName || null}, full_name), email = COALESCE(${input.email ? String(input.email).trim().toLowerCase() : null}, email), role = COALESCE(${role}, role), is_active = COALESCE(${input.isActive === undefined ? null : Boolean(input.isActive)}, is_active), updated_at = NOW() WHERE id = ${id} RETURNING id, full_name, email, role, is_active, last_login_at, created_at`; if (!rows[0]) return send(res, 404, { error: 'المستخدم غير موجود' }); await audit(req, (readSession(req) || {}).id, 'user.update', 'user', id, input); return send(res, 200, { user: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر تعديل المستخدم', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/audit-logs' && req.method === 'GET') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'users.view'))) return true;
    try { const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500); const logs = await sql`SELECT l.id, l.action, l.entity_type, l.entity_id, l.metadata, l.ip_address, l.created_at, u.full_name AS actor_name, u.email AS actor_email FROM academy_audit_logs l LEFT JOIN academy_users u ON u.id = l.actor_user_id ORDER BY l.created_at DESC LIMIT ${limit}`; return send(res, 200, { logs }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة سجل النشاط', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/roles' && req.method === 'POST') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'users.manage'))) return true;
    try { const input = await body(req); const key = String(input.roleKey || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'); const permissions = Array.isArray(input.permissions) ? input.permissions : []; if (!key || !String(input.name || '').trim()) return send(res, 422, { error: 'مفتاح الدور واسمه مطلوبان' }); const rows = await sql`INSERT INTO academy_roles (role_key, name, description, permissions, is_system) VALUES (${key}, ${String(input.name).trim()}, ${input.description || null}, ${JSON.stringify(permissions)}, FALSE) RETURNING role_key, name, description, permissions, is_system`; await audit(req, (readSession(req) || {}).id, 'role.create', 'role', key, { permissions }); return send(res, 201, { role: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر إنشاء الدور', detail: error.message }); }
  }
  if (url.pathname.startsWith('/api/academy/roles/') && req.method === 'PATCH') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'users.manage'))) return true;
    try { const key = decodeURIComponent(url.pathname.split('/').pop()); const input = await body(req); const rows = await sql`UPDATE academy_roles SET name = COALESCE(${input.name || null}, name), description = COALESCE(${input.description || null}, description), permissions = COALESCE(${Array.isArray(input.permissions) ? JSON.stringify(input.permissions) : null}, permissions), updated_at = NOW() WHERE role_key = ${key} AND is_system = FALSE RETURNING role_key, name, description, permissions, is_system`; if (!rows[0]) return send(res, 404, { error: 'الدور غير موجود أو نظامي' }); await audit(req, (readSession(req) || {}).id, 'role.update', 'role', key, input); return send(res, 200, { role: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر تعديل الدور', detail: error.message }); }
  }
  if (url.pathname === '/api/auth/2fa/setup' && req.method === 'POST') {
    if (!requireDb(res)) return true; const session = await requirePermission(req, res, 'users.view'); if (!session) return true; const secret = base32(randomBytes(20)); await sql`UPDATE academy_users SET totp_pending_secret = ${secret}, updated_at = NOW() WHERE id = ${Number(session.id)}`; const issuer = 'Hisham Academy'; const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(session.email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`; return send(res, 200, { secret, otpauthUrl: uri });
  }
  if (url.pathname === '/api/auth/2fa/enable' && req.method === 'POST') {
    if (!requireDb(res)) return true; const session = await requirePermission(req, res, 'users.view'); if (!session) return true; const input = await body(req); const rows = await sql`SELECT totp_pending_secret FROM academy_users WHERE id = ${Number(session.id)}`; if (!rows[0]?.totp_pending_secret || !verifyTotp(rows[0].totp_pending_secret, input.code)) return send(res, 422, { error: 'رمز المصادقة غير صحيح' }); await sql`UPDATE academy_users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled = TRUE, updated_at = NOW() WHERE id = ${Number(session.id)}`; await audit(req, session.id, 'auth.2fa.enable', 'user', session.id); return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/auth/2fa/disable' && req.method === 'POST') {
    if (!requireDb(res)) return true; const session = await requirePermission(req, res, 'users.view'); if (!session) return true; const input = await body(req); const rows = await sql`SELECT totp_secret FROM academy_users WHERE id = ${Number(session.id)}`; if (!rows[0]?.totp_secret || !verifyTotp(rows[0].totp_secret, input.code)) return send(res, 422, { error: 'رمز المصادقة غير صحيح' }); await sql`UPDATE academy_users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled = FALSE, updated_at = NOW() WHERE id = ${Number(session.id)}`; await audit(req, session.id, 'auth.2fa.disable', 'user', session.id); return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, service: 'hisham-academy', database: Boolean(sql), time: new Date().toISOString() });
  if (url.pathname === '/api/academy/packages' && req.method === 'GET') {
    if (!requireDb(res)) return true;
    try { const packages = await sql`SELECT id, name, description, sessions_count, price, currency, is_featured, is_active, sort_order FROM academy_packages WHERE is_active = TRUE ORDER BY sort_order, id`; return send(res, 200, { packages }); } catch (error) { return send(res, 500, { error: 'تعذر قراءة الباقات', detail: error.message }); }
  }
  if (url.pathname === '/api/academy/packages' && req.method === 'POST') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'packages.manage'))) return true;
    try { const input = await body(req); const rows = await sql`INSERT INTO academy_packages (name, description, sessions_count, price, currency, is_featured, sort_order) VALUES (${String(input.name || '').trim()}, ${input.description || null}, ${Number(input.sessionsCount || 4)}, ${Number(input.price || 0)}, ${input.currency || 'SAR'}, ${Boolean(input.isFeatured)}, ${Number(input.sortOrder || 0)}) RETURNING *`; return send(res, 201, { package: rows[0] }); } catch (error) { return send(res, 400, { error: 'تعذر حفظ الباقة', detail: error.message }); }
  }
  const packageMatch = url.pathname.match(/^\/api\/academy\/packages\/(\d+)$/);
  if (packageMatch && req.method === 'DELETE') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'packages.manage'))) return true;
    try { await sql`UPDATE academy_packages SET is_active = FALSE, updated_at = NOW() WHERE id = ${Number(packageMatch[1])}`; return send(res, 200, { ok: true }); } catch (error) { return send(res, 400, { error: 'تعذر إيقاف الباقة', detail: error.message }); }
  }
  if (packageMatch && req.method === 'PATCH') {
    if (!requireDb(res) || !(await requirePermission(req, res, 'packages.manage'))) return true;
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
    if (!requireDb(res) || !(await requirePermission(req, res, 'registrations.view'))) return true;
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
