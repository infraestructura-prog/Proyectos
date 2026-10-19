/* Utilidades HTTP comunes para las funciones de servidor. */

export function send(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(data));
}

export const fail = (res, status, code, error, extra = {}) => send(res, status, { error, code, ...extra });

/* Las escrituras deben venir de la propia aplicación (cabecera personalizada + JSON).
   Junto con la cookie SameSite=Strict, esto bloquea envíos desde otros sitios (CSRF). */
export function isAppRequest(req) {
  return req.headers['x-ccs-request'] === '1' && String(req.headers['content-type'] || '').includes('application/json');
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  return null;
}

export function handleError(res, e) {
  console.error('[api]', e);
  if (e && e.code && e.status) return fail(res, e.status, e.code, e.message);
  return fail(res, 500, 'SERVER_ERROR', 'Error interno del servidor. Inténtalo de nuevo.');
}
