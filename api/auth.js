/* GET  /api/auth                       → sesión actual { user, role, configured }
   POST /api/auth { action:'login', user, password }
   POST /api/auth { action:'logout' } */
import { authConfig, findUser, verifyPassword, createSessionCookie, clearSessionCookie, getSession } from './_lib/auth.js';
import { send, fail, isAppRequest, readJson, handleError } from './_lib/http.js';

export default async function handler(req, res) {
  try {
    const cfg = authConfig();
    if (req.method === 'GET') {
      const s = getSession(req, cfg);
      return send(res, 200, { configured: cfg.configured, user: s ? s.user : null, role: s ? s.role : null });
    }
    if (req.method !== 'POST') return fail(res, 405, 'METHOD', 'Método no permitido.');
    if (!isAppRequest(req)) return fail(res, 400, 'BAD_REQUEST', 'Solicitud no válida.');
    const body = await readJson(req) || {};

    if (body.action === 'logout') {
      res.setHeader('Set-Cookie', clearSessionCookie(req));
      return send(res, 200, { ok: true });
    }
    if (body.action === 'login') {
      if (!cfg.configured) return fail(res, 503, 'NOT_CONFIGURED', 'El inicio de sesión no está configurado en el servidor.', { missing: cfg.missing });
      const user = findUser(cfg, body.user);
      // Se verifica siempre una contraseña para no revelar por tiempo de respuesta si el usuario existe.
      const ok = verifyPassword(body.password || '', user ? user.hash : 'pbkdf2$sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      if (!user || !ok) {
        await new Promise(r => setTimeout(r, 600));
        return fail(res, 401, 'BAD_CREDENTIALS', 'Usuario o contraseña incorrectos.');
      }
      res.setHeader('Set-Cookie', createSessionCookie(req, cfg, user));
      return send(res, 200, { user: user.user, role: user.role === 'editor' ? 'editor' : 'lector' });
    }
    return fail(res, 400, 'BAD_REQUEST', 'Acción desconocida.');
  } catch (e) { return handleError(res, e); }
}
