/* Autenticación por usuario y contraseña con sesión firmada (cookie HttpOnly).
   Usuarios en la variable de entorno APP_USERS (JSON):
   [{"user":"erick","role":"editor","hash":"pbkdf2$sha256$210000$<sal-base64>$<hash-base64>"}]
   Roles: "editor" (lee y escribe) y "lector" (solo lee). Genera el hash con scripts/hash-password.ps1 o .mjs. */
import crypto from 'node:crypto';

const COOKIE = 'ccs_session';
const MAX_AGE = 8 * 60 * 60; // 8 horas

export function authConfig() {
  const secret = process.env.SESSION_SECRET || '';
  let users = [];
  try { users = JSON.parse(process.env.APP_USERS || '[]'); } catch { users = []; }
  if (!Array.isArray(users)) users = [];
  const missing = [];
  if (secret.length < 32) missing.push('SESSION_SECRET');
  if (!users.length) missing.push('APP_USERS');
  return { secret, users, missing, configured: missing.length === 0 };
}

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const sign = (data, secret) => b64url(crypto.createHmac('sha256', secret).update(data).digest());

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 100000) return false;
  const salt = Buffer.from(parts[3], 'base64'), expected = Buffer.from(parts[4], 'base64');
  const got = crypto.pbkdf2Sync(String(password), salt, iterations, expected.length, 'sha256');
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

export function findUser(cfg, name) {
  const n = String(name || '').trim().toLowerCase();
  return cfg.users.find(u => String(u.user || '').toLowerCase() === n) || null;
}

export function createSessionCookie(req, cfg, user) {
  const payload = b64url(JSON.stringify({ u: user.user, r: user.role === 'editor' ? 'editor' : 'lector', exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  return cookieString(req, `${payload}.${sign(payload, cfg.secret)}`, MAX_AGE);
}

export const clearSessionCookie = req => cookieString(req, '', 0);

function cookieString(req, value, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') || process.env.VERCEL === '1';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/* Devuelve { user, role } si la cookie es válida y el usuario sigue existiendo en APP_USERS. */
export function getSession(req, cfg = authConfig()) {
  if (!cfg.configured) return null;
  const raw = String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload, cfg.secret))) return null;
  let data; try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!data.exp || data.exp < Date.now() / 1000) return null;
  const u = findUser(cfg, data.u);
  if (!u) return null; // usuario eliminado → la sesión deja de valer
  return { user: u.user, role: u.role === 'editor' ? 'editor' : 'lector' };
}
