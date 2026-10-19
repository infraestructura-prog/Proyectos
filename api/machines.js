/* Máquinas de simulación — tabla normalizada «App_Maquinas».
   GET  /api/machines                                       → { records, fetchedAt }
   POST /api/machines { action:'init' }                     → crea la pestaña con encabezados (editor)
   POST /api/machines { action:'create', requestId, data }  → nueva máquina (editor)
   PUT  /api/machines?id=<id> { version, data }             → edita por identificador estable (editor)
   La conexión con la hoja (Apps Script o cuenta de servicio) está en _lib/store.js. Nunca escribe en «Hoja 1». */
import crypto from 'node:crypto';
import { storeConfig } from './_lib/store.js';
import { authConfig, getSession } from './_lib/auth.js';
import { send, fail, isAppRequest, readJson, handleError } from './_lib/http.js';
import { validateMachine, findDuplicates, trimSpaces } from '../shared/machines-core.js';

function requireEditor(req, res) {
  const acfg = authConfig();
  if (!acfg.configured) { fail(res, 503, 'NOT_CONFIGURED', 'La autenticación no está configurada en el servidor.', { missing: acfg.missing }); return null; }
  const s = getSession(req, acfg);
  if (!s) { fail(res, 401, 'AUTH_REQUIRED', 'Tu sesión no está iniciada o expiró. Inicia sesión para guardar.'); return null; }
  if (s.role !== 'editor') { fail(res, 403, 'FORBIDDEN', 'Tu cuenta es de solo lectura. Pide a un administrador el rol de editor.'); return null; }
  return s;
}

const cleanMeta = (s, max) => trimSpaces(s).slice(0, max);

export default async function handler(req, res) {
  try {
    const { store, missing } = storeConfig();

    if (req.method === 'GET') {
      if (process.env.READ_REQUIRES_LOGIN === 'true' && !getSession(req, authConfig()))
        return fail(res, 401, 'AUTH_REQUIRED', 'Inicia sesión para consultar las máquinas.');
      if (!store) return fail(res, 503, 'NOT_CONFIGURED', 'La conexión de escritura con Google Sheets no está configurada.', { missing });
      return send(res, 200, { records: await store.list(), fetchedAt: new Date().toISOString() });
    }

    if (req.method !== 'POST' && req.method !== 'PUT') return fail(res, 405, 'METHOD', 'Método no permitido.');
    if (!isAppRequest(req)) return fail(res, 400, 'BAD_REQUEST', 'Solicitud no válida.');
    const session = requireEditor(req, res); if (!session) return;
    if (!store) return fail(res, 503, 'NOT_CONFIGURED', 'La conexión de escritura con Google Sheets no está configurada.', { missing });
    const body = await readJson(req);
    if (!body) return fail(res, 400, 'BAD_REQUEST', 'El cuerpo de la solicitud no es JSON válido.');
    const now = new Date().toISOString();

    if (req.method === 'POST' && body.action === 'init') {
      await store.init();
      return send(res, 201, { ok: true });
    }

    if (req.method === 'POST' && body.action === 'create') {
      const requestId = cleanMeta(body.requestId, 64);
      if (!requestId) return fail(res, 400, 'BAD_REQUEST', 'Falta el identificador de la solicitud.');
      const { value, errors } = validateMachine(body.data || {});
      if (Object.keys(errors).length) return fail(res, 400, 'VALIDATION', 'Hay campos con errores.', { fields: errors });
      // Comprobación previa para dar errores claros; el almacén la repite de forma atómica al escribir.
      const dup = findDuplicates(await store.list(), value);
      if (Object.keys(dup).length) return fail(res, 409, 'DUPLICATE', Object.values(dup).join(' '), { fields: dup });
      const record = {
        id: 'MQ-' + crypto.randomUUID(), ...value,
        origen: cleanMeta(body.data.origen, 60), valor_original: cleanMeta(body.data.valor_original, 500),
        creado: now, modificado: now, version: 1, creado_por: session.user, modificado_por: session.user, request_id: requestId
      };
      const out = await store.create(record);
      return send(res, out.repeated ? 200 : 201, { record: out.record, repeated: !!out.repeated });
    }

    if (req.method === 'PUT') {
      const id = cleanMeta(req.query && req.query.id, 80);
      if (!id) return fail(res, 400, 'BAD_REQUEST', 'Falta el identificador de la máquina.');
      const { value, errors } = validateMachine(body.data || {});
      if (Object.keys(errors).length) return fail(res, 400, 'VALIDATION', 'Hay campos con errores.', { fields: errors });
      const record = await store.update(id, Number(body.version), { ...value, modificado: now, modificado_por: session.user });
      return send(res, 200, { record });
    }

    return fail(res, 400, 'BAD_REQUEST', 'Acción desconocida.');
  } catch (e) { return handleError(res, e); }
}
