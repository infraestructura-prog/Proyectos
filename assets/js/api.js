/* Cliente de las funciones de servidor (/api/*). Las credenciales nunca pasan por aquí:
   la sesión viaja en una cookie HttpOnly que el navegador no puede leer. */

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', data = null } = {}) {
    super(message); this.status = status; this.code = code; this.data = data;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'X-CCS-Request': '1', Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', cache: 'no-store', signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('No se pudo contactar con el servidor. Revisa tu conexión a internet.', { code: 'NETWORK' });
  }
  let data = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  }
  if (!res.ok) {
    let msg = data && data.error;
    if (!msg) msg = res.status === 404
      ? 'Las funciones de servidor no están disponibles. La aplicación debe ejecutarse en Vercel (o con «vercel dev»).'
      : `El servidor respondió con un error (HTTP ${res.status}).`;
    throw new ApiError(msg, { status: res.status, code: (data && data.code) || (res.status === 404 ? 'NO_API' : ''), data });
  }
  return data;
}
