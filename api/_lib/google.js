/* Acceso a la API de Google Sheets con una cuenta de servicio, sin dependencias externas.
   Las credenciales se leen de variables de entorno y nunca se envían al navegador. */
import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export function sheetsConfig() {
  const cfg = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    spreadsheetId: process.env.MAQUINAS_SPREADSHEET_ID || '',
    sourceTab: process.env.MAQUINAS_SOURCE_TAB || 'Hoja 1'
  };
  const missing = [];
  if (!cfg.email) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!cfg.key.includes('PRIVATE KEY')) missing.push('GOOGLE_PRIVATE_KEY');
  if (!cfg.spreadsheetId) missing.push('MAQUINAS_SPREADSHEET_ID');
  return { cfg, missing };
}

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

let cached = { token: '', exp: 0 };
async function accessToken(cfg) {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: cfg.email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signature = b64url(crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(cfg.key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${signature}` })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SheetsError(`No se pudo autenticar con Google (${data.error_description || data.error || res.status}).`, res.status);
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export class SheetsError extends Error {
  // extra: datos adicionales que se envían al navegador (p. ej. fields o current).
  constructor(message, status = 502, code = 'SHEETS_ERROR', extra = null) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

async function call(cfg, path, { method = 'GET', body } = {}) {
  const token = await accessToken(cfg);
  const res = await fetch(`${API}/${encodeURIComponent(cfg.spreadsheetId)}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
    if (res.status === 403) throw new SheetsError(`La cuenta de servicio no tiene acceso a la hoja. Compártela con ${cfg.email} como Editor. (${msg})`, 502, 'SHEETS_FORBIDDEN');
    if (res.status === 404) throw new SheetsError('No se encontró la hoja de cálculo. Revisa MAQUINAS_SPREADSHEET_ID.', 502, 'SHEETS_NOT_FOUND');
    throw new SheetsError(`Google Sheets respondió con un error: ${msg}`, 502);
  }
  return data;
}

export const a1 = (tab, range) => `'${tab.replace(/'/g, "''")}'!${range}`;

export async function listTabs(cfg) {
  const d = await call(cfg, '?fields=sheets.properties(title,sheetId)');
  return (d.sheets || []).map(s => s.properties.title);
}

export async function getValues(cfg, range) {
  const d = await call(cfg, `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
  return d.values || [];
}

export async function updateValues(cfg, range, values) {
  return call(cfg, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { method: 'PUT', body: { range, majorDimension: 'ROWS', values } });
}

export async function appendValues(cfg, range, values) {
  return call(cfg, `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: { majorDimension: 'ROWS', values } });
}

export async function addTab(cfg, title) {
  return call(cfg, ':batchUpdate', { method: 'POST', body: { requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }] } });
}
