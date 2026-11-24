// Central server-side access policy for /api/*. Default deny: any API path not
// listed as public requires a valid signed session (see serverSession.js).
// Pure functions (no I/O) so they can be unit-tested.

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Public endpoints: [METHOD or "*", path regex relative to /api]
const PUBLIC = [
  ["POST", /^\/academy\/auth$/],
  ["DELETE", /^\/academy\/auth$/],
  ["POST", /^\/admins\/auth$/], // login only; PUT (code reset) is admin-gated
  ["GET", /^\/academy\/settings$/],
  ["GET", /^\/academy\/packages$/],
  ["POST", /^\/academy\/registrations$/], // public sign-up form
  ["*", /^\/auth(\/|$)/], // Auth.js handlers
  ["*", /^\/__create(\/|$)/], // self-gated dev helpers
  ["GET", /^\/health$/], // public health check
];

// Admin-only (any method unless noted)
const ADMIN_ONLY = [
  ["*", /^\/admins(\/|$)/],
  ["WRITE", /^\/academy\/settings$/],
  ["WRITE", /^\/academy\/packages(\/|$)/],
  ["WRITE", /^\/academy\/teachers(\/|$)/],
  ["*", /^\/academy\/registrations(\/|$)/], // non-POST (POST is public above)
];

// Staff (admin or teacher): all writes elsewhere under academy/teacher/exams/reports
const STAFF_WRITE = [
  /^\/academy(\/|$)/,
  /^\/teacher(\/|$)/,
  /^\/exams(\/|$)/,
  /^\/reports(\/|$)/,
];
// Reads that expose other people's data are staff-only too
const STAFF_READ = [/^\/reports(\/|$)/, /^\/academy\/(payments|dashboard)(\/|$)/];
// Self-service for any signed-in user (route handlers do their own ownership checks)
const ANY_ROLE = [/^\/academy\/(bookings|bookable-sessions)(\/|$)/, /^\/teacher\/messages$/];

const matches = (rule, method) =>
  rule[0] === "*" || rule[0] === method || (rule[0] === "WRITE" && WRITE.has(method));

/**
 * @returns {null | {status: 401|403, error: string}} null = allowed
 */
export function evaluateApiAccess(method, path, session, query = new URLSearchParams()) {
  method = method.toUpperCase();
  if (method === "OPTIONS") return null;
  if (PUBLIC.some((r) => matches(r, method) && r[1].test(path))) return null;

  if (!session) return { status: 401, error: "سجل الدخول مرة أخرى لإكمال العملية" };

  const role = session.role;
  if (role === "admin") return null;

  if (ADMIN_ONLY.some((r) => matches(r, method) && r[1].test(path))) {
    return { status: 403, error: "غير مصرح" };
  }

  if (role === "teacher") {
    if (STAFF_WRITE.some((re) => re.test(path)) && WRITE.has(method)) return null;
    if (STAFF_READ.some((re) => re.test(path))) return null;
    if (ANY_ROLE.some((re) => re.test(path))) return null;
    // teachers can read most academy data related to their work
    if (/^\/academy(\/|$)/.test(path) && method === "GET") return null;
    if (/^\/teacher(\/|$)/.test(path)) return null;
    return { status: 403, error: "غير مصرح" };
  }

  // student / parent
  if (ANY_ROLE.some((re) => re.test(path))) return null;
  if (/^\/students\//.test(path) && method === "GET") return null; // ownership checked in handlers
  if (/^\/academy\/settings$/.test(path) && method === "GET") return null;

  return { status: 403, error: "غير مصرح" };
}

/**
 * Simple in-memory rate limit for login attempts (per IP).
 * For multi-instance deployments replace with Redis.
 */
const loginAttempts = new Map();

export function tooManyAttempts(ip, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  loginAttempts.set(ip, entry);
  return entry.count > limit;
}

export { PUBLIC, ADMIN_ONLY };
