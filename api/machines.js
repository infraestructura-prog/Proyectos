/* Máquinas de simulación — tabla normalizada «App_Maquinas» en Google Sheets.
   GET  /api/machines                                   → { records, fetchedAt }
   POST /api/machines { action:'init' }                 → crea la pestaña con encabezados (editor)
   POST /api/machines { action:'create', requestId, data } → nueva máquina (editor)
   PUT  /api/machines?id=<id> { version, data }         → edita por identificador estable (editor)
   Nunca escribe en «Hoja 1». */
import crypto from 'node:crypto';
import { sheetsConfig, listTabs, getValues, updateValues, appendValues, addTab, a1, SheetsError } from './_lib/google.js';
import { authConfig, getSession } from './_lib/auth.js';
import { send, fail, isAppRequest, readJson, handleError } from './_lib/http.js';
import { TAB_APP, COLUMNS, validateMachine, findDuplicates, rowToRecord, recordToRow, trimSpaces } from '../shared/machines-core.js';

const lastCol = String.fromCharCode(64 + COLUMNS.length); // 15 columnas → O

async function readTable(cfg) {
  const values = await getValues(cfg, a1(TAB_APP, `A1:${lastCol}`)).catch(e => {
    if (/Unable to parse range/i.test(e.message)) throw new SheetsError(`La pestaña ${TAB_APP} no existe todavía.`, 409, 'TABLE_MISSING');
    throw e;
  });
  const header = (values[0] || []).map(h => String(h).trim());
  if (!header.length) throw new SheetsError(`La pestaña ${TAB_APP} está vacía: falta la fila de encabezados.`, 409, 'TABLE_MISSING');
  if (COLUMNS.some((c, i) => header[i] !== c))
    throw new SheetsError(`Los encabezados de ${TAB_APP} no coinciden con los esperados (${COLUMNS.join(', ')}). No se escribirá para no dañar datos.`, 409, 'TABLE_MISMATCH');
  const records = [];
  values.slice(1).forEach((row, i) => {
    if (!row.some(c => String(c).trim())) return;
    const r = rowToRecord(row); r._row = i + 2; // fila real en la hoja (solo uso interno)
    if (r.id) records.push(r);
  });
  return records;
}

const publicRecord = r => { const { _row, request_id, ...rest } = r; return rest; };

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
    const { cfg, missing } = sheetsConfig();

    if (req.method === 'GET') {
      if (process.env.READ_REQUIRES_LOGIN === 'true' && !getSession(req, authConfig()))
        return fail(res, 401, 'AUTH_REQUIRED', 'Inicia sesión para consultar las máquinas.');
      if (missing.length) return fail(res, 503, 'NOT_CONFIGURED', 'La conexión con Google Sheets no está configurada.', { missing });
      const records = await readTable(cfg);
      return send(res, 200, { records: records.map(publicRecord), fetchedAt: new Date().toISOString() });
    }

    if (req.method !== 'POST' && req.method !== 'PUT') return fail(res, 405, 'METHOD', 'Método no permitido.');
    if (!isAppRequest(req)) return fail(res, 400, 'BAD_REQUEST', 'Solicitud no válida.');
    const session = requireEditor(req, res); if (!session) return;
    if (missing.length) return fail(res, 503, 'NOT_CONFIGURED', 'La conexión con Google Sheets no está configurada.', { missing });
    const body = await readJson(req);
    if (!body) return fail(res, 400, 'BAD_REQUEST', 'El cuerpo de la solicitud no es JSON válido.');
    const now = new Date().toISOString();

    /* ── Inicializar la tabla (crea solo una pestaña nueva) ── */
    if (req.method === 'POST' && body.action === 'init') {
      const tabs = await listTabs(cfg);
      if (tabs.includes(TAB_APP)) {
        const head = await getValues(cfg, a1(TAB_APP, `A1:${lastCol}1`));
        if (head.length && head[0].some(c => String(c).trim())) return fail(res, 409, 'TABLE_EXISTS', `La pestaña ${TAB_APP} ya existe y tiene contenido; no se modificó.`);
      } else {
        await addTab(cfg, TAB_APP);
      }
      await updateValues(cfg, a1(TAB_APP, `A1:${lastCol}1`), [COLUMNS]);
      return send(res, 201, { ok: true, tab: TAB_APP });
    }

    /* ── Crear ── */
    if (req.method === 'POST' && body.action === 'create') {
      const requestId = cleanMeta(body.requestId, 64);
      if (!requestId) return fail(res, 400, 'BAD_REQUEST', 'Falta el identificador de la solicitud.');
      const { value, errors } = validateMachine(body.data || {});
      if (Object.keys(errors).length) return fail(res, 400, 'VALIDATION', 'Hay campos con errores.', { fields: errors });

      const records = await readTable(cfg);
      // Idempotencia: si esta misma solicitud ya se guardó (reintento, doble clic), se devuelve el registro existente.
      const repeat = records.find(r => r.request_id === requestId);
      if (repeat) return send(res, 200, { record: publicRecord(repeat), repeated: true });

      const dup = findDuplicates(records, value);
      if (Object.keys(dup).length) return fail(res, 409, 'DUPLICATE', Object.values(dup).join(' '), { fields: dup });

      const record = {
        id: 'MQ-' + crypto.randomUUID(), ...value,
        origen: cleanMeta(body.data.origen, 60), valor_original: cleanMeta(body.data.valor_original, 500),
        creado: now, modificado: now, version: 1, creado_por: session.user, modificado_por: session.user, request_id: requestId
      };
      await appendValues(cfg, a1(TAB_APP, 'A1'), [recordToRow(record)]);
      return send(res, 201, { record: publicRecord(record) });
    }

    /* ── Editar por identificador estable con control de versión ── */
    if (req.method === 'PUT') {
      const id = cleanMeta(req.query && req.query.id, 80);
      if (!id) return fail(res, 400, 'BAD_REQUEST', 'Falta el identificador de la máquina.');
      const { value, errors } = validateMachine(body.data || {});
      if (Object.keys(errors).length) return fail(res, 400, 'VALIDATION', 'Hay campos con errores.', { fields: errors });

      const records = await readTable(cfg);
      const current = records.find(r => r.id === id);
      if (!current) return fail(res, 404, 'NOT_FOUND', 'La máquina ya no existe en la tabla.');
      if (Number(body.version) !== current.version)
        return fail(res, 409, 'VERSION_CONFLICT', 'Otro usuario modificó esta máquina después de que la abrieras.', { current: publicRecord(current) });

      const dup = findDuplicates(records, value, id);
      if (Object.keys(dup).length) return fail(res, 409, 'DUPLICATE', Object.values(dup).join(' '), { fields: dup });

      const updated = { ...current, ...value, modificado: now, version: current.version + 1, modificado_por: session.user };
      // Se vuelve a comprobar que la fila sigue siendo la del mismo id justo antes de escribir.
      const check = await getValues(cfg, a1(TAB_APP, `A${current._row}:A${current._row}`));
      if (!check[0] || check[0][0] !== id) throw new SheetsError('La tabla cambió mientras se guardaba. Vuelve a intentarlo.', 409, 'RETRY');
      await updateValues(cfg, a1(TAB_APP, `A${current._row}:${lastCol}${current._row}`), [recordToRow(updated)]);
      return send(res, 200, { record: publicRecord(updated) });
    }

    return fail(res, 400, 'BAD_REQUEST', 'Acción desconocida.');
  } catch (e) { return handleError(res, e); }
}
