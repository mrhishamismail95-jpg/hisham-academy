import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "ha_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  return process.env.ACADEMY_SESSION_SECRET || process.env.AUTH_SECRET || "";
}

export function sessionCookieHeader(user) {
  const key = secret();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ id: String(user.id), role: user.role, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function getServerSession(request) {
  const key = secret();
  if (!key) return null;
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", key).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.id || !data.role || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

export function unauthorized() {
  return Response.json({ error: "سجل الدخول مرة أخرى لإكمال العملية" }, { status: 401 });
}

export function clearSessionCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}
