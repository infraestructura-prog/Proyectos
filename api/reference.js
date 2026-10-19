/* GET /api/reference → entradas de «Hoja 1» (solo lectura, sin modificar la hoja original). */
import { sheetsConfig, getValues, a1 } from './_lib/google.js';
import { authConfig, getSession } from './_lib/auth.js';
import { send, fail, handleError } from './_lib/http.js';
import { referenceFromValues } from '../shared/reference-snapshot.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return fail(res, 405, 'METHOD', 'Método no permitido.');
    if (process.env.READ_REQUIRES_LOGIN === 'true' && !getSession(req, authConfig()))
      return fail(res, 401, 'AUTH_REQUIRED', 'Inicia sesión para consultar la referencia.');
    const { cfg, missing } = sheetsConfig();
    if (missing.length) return fail(res, 503, 'NOT_CONFIGURED', 'La conexión con Google Sheets no está configurada.', { missing });
    const values = await getValues(cfg, a1(cfg.sourceTab, 'A2:J'));
    return send(res, 200, { rows: referenceFromValues(values), fetchedAt: new Date().toISOString(), tab: cfg.sourceTab });
  } catch (e) { return handleError(res, e); }
}
