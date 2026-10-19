/* Almacén de máquinas con dos conexiones posibles (se elige por variables de entorno):
   1. Apps Script (recomendada): APPS_SCRIPT_URL + APPS_SCRIPT_SECRET. Sin Google Cloud.
   2. Cuenta de servicio: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY + MAQUINAS_SPREADSHEET_ID.
   Ambas exponen las mismas operaciones; la validación de campos se hace antes, en machines.js. */
import { sheetsConfig, listTabs, getValues, updateValues, appendValues, addTab, a1, SheetsError } from './google.js';
import { TAB_APP, COLUMNS, findDuplicates, rowToRecord, recordToRow } from '../../shared/machines-core.js';

export function storeConfig() {
  const url = process.env.APPS_SCRIPT_URL || '', secret = process.env.APPS_SCRIPT_SECRET || '';
  if (url || secret) {
    const missing = [];
    // Cuentas de Google Workspace usan /a/macros/<dominio>/s/<id>/exec.
    if (!/^https:\/\/script\.google\.com\/(a\/macros\/[\w.-]+|macros)\/s\/[\w-]+\/exec$/.test(url)) missing.push('APPS_SCRIPT_URL');
    if (secret.length < 16) missing.push('APPS_SCRIPT_SECRET');
    return { kind: 'apps-script', missing, store: missing.length ? null : appsScriptStore(url, secret) };
  }
  const { cfg, missing } = sheetsConfig();
  if (!missing.length) return { kind: 'service-account', missing, store: serviceAccountStore(cfg) };
  return { kind: 'none', missing: ['APPS_SCRIPT_URL', 'APPS_SCRIPT_SECRET'], store: null };
}

/* ═════════ Apps Script ═════════ */
const STATUS = { TABLE_MISSING: 409, TABLE_MISMATCH: 409, TABLE_EXISTS: 409, DUPLICATE: 409, VERSION_CONFLICT: 409, NOT_FOUND: 404, BUSY: 503 };
const MESSAGES = {
  UNAUTHORIZED: 'El Apps Script rechazó la clave. APPS_SCRIPT_SECRET en Vercel debe ser igual a APP_SECRET en el script.',
  SCRIPT_NOT_CONFIGURED: 'Al Apps Script le falta la propiedad APP_SECRET.'
};

function appsScriptStore(url, secret) {
  async function call(action, payload = {}) {
    let res;
    try {
      // text/plain evita la verificación previa; Google redirige a googleusercontent.com y fetch la sigue.
      res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action, secret }) });
    } catch {
      throw new SheetsError('No se pudo contactar con el Apps Script.', 502, 'SCRIPT_UNREACHABLE');
    }
    const text = await res.text();
    let d;
    try { d = JSON.parse(text); } catch {
      throw new SheetsError('El Apps Script no respondió datos. Revisa que esté implementado como «Aplicación web», ejecutado como «Yo» y con acceso «Cualquier usuario», y que APPS_SCRIPT_URL termine en /exec.', 502, 'SCRIPT_BAD_RESPONSE');
    }
    if (!d.ok) {
      const { ok, code, error, ...extra } = d;
      throw new SheetsError(MESSAGES[code] || error || 'Error del Apps Script.', STATUS[code] || 502, code || 'SCRIPT_ERROR', extra);
    }
    return d;
  }
  return {
    async list() { return (await call('read')).records; },
    async reference() { return (await call('reference')).values; },
    async init() { await call('init'); },
    async create(record) { return call('create', { record }); },
    async update(id, version, changes) { return (await call('update', { id, version, changes })).record; }
  };
}

/* ═════════ Cuenta de servicio (API de Google Sheets) ═════════ */
const lastCol = String.fromCharCode(64 + COLUMNS.length);
const strip = ({ _row, request_id, ...r }) => r;

function serviceAccountStore(cfg) {
  async function table() {
    const values = await getValues(cfg, a1(TAB_APP, `A1:${lastCol}`)).catch(e => {
      if (/Unable to parse range/i.test(e.message)) throw new SheetsError(`La pestaña ${TAB_APP} no existe todavía.`, 409, 'TABLE_MISSING');
      throw e;
    });
    const header = (values[0] || []).map(h => String(h).trim());
    if (!header.length) throw new SheetsError(`La pestaña ${TAB_APP} está vacía: falta la fila de encabezados.`, 409, 'TABLE_MISSING');
    if (COLUMNS.some((c, i) => header[i] !== c))
      throw new SheetsError(`Los encabezados de ${TAB_APP} no coinciden con los esperados (${COLUMNS.join(', ')}). No se escribirá para no dañar datos.`, 409, 'TABLE_MISMATCH');
    const records = [];
    values.slice(1).forEach((row, i) => { const r = rowToRecord(row); r._row = i + 2; if (r.id) records.push(r); });
    return records;
  }
  const dupError = dup => new SheetsError(Object.values(dup).join(' '), 409, 'DUPLICATE', { fields: dup });
  return {
    async list() { return (await table()).map(strip); },
    async reference() { return getValues(cfg, a1(cfg.sourceTab, 'A2:J')); },
    async init() {
      const tabs = await listTabs(cfg);
      if (tabs.includes(TAB_APP)) {
        const head = await getValues(cfg, a1(TAB_APP, `A1:${lastCol}1`));
        if (head.length && head[0].some(c => String(c).trim())) throw new SheetsError(`La pestaña ${TAB_APP} ya existe y tiene contenido; no se modificó.`, 409, 'TABLE_EXISTS');
      } else await addTab(cfg, TAB_APP);
      await updateValues(cfg, a1(TAB_APP, `A1:${lastCol}1`), [COLUMNS]);
    },
    async create(record) {
      const records = await table();
      const repeat = records.find(r => r.request_id === record.request_id);
      if (repeat) return { record: strip(repeat), repeated: true };
      const dup = findDuplicates(records, record);
      if (Object.keys(dup).length) throw dupError(dup);
      await appendValues(cfg, a1(TAB_APP, 'A1'), [recordToRow(record)]);
      return { record: strip(record) };
    },
    async update(id, version, changes) {
      const records = await table();
      const cur = records.find(r => r.id === id);
      if (!cur) throw new SheetsError('La máquina ya no existe en la tabla.', 404, 'NOT_FOUND');
      if (Number(version) !== cur.version) throw new SheetsError('Otro usuario modificó esta máquina después de que la abrieras.', 409, 'VERSION_CONFLICT', { current: strip(cur) });
      const next = { ...cur, ...changes, version: cur.version + 1 };
      const dup = findDuplicates(records, next, id);
      if (Object.keys(dup).length) throw dupError(dup);
      const check = await getValues(cfg, a1(TAB_APP, `A${cur._row}:A${cur._row}`));
      if (!check[0] || check[0][0] !== id) throw new SheetsError('La tabla cambió mientras se guardaba. Vuelve a intentarlo.', 409, 'RETRY');
      await updateValues(cfg, a1(TAB_APP, `A${cur._row}:${lastCol}${cur._row}`), [recordToRow(next)]);
      return strip(next);
    }
  };
}
