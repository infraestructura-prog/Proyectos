/* Datos compartidos de Neotropya › Nodos: lectura de Google Sheets, estados y ficha del nodo.
   Lo usan «Control de órdenes de fabricación» y «Tablero de actividades». Solo lectura.
   Se conserva la lógica del panel original «nodo-dashboard.html» (CSV + respaldo JSONP de gviz,
   y el tratamiento de los bloques MALETAS / BOLSOS). */
import { NODOS as CFG } from '../config.js';
import { esc, ICON, openModal, alertBox } from '../ui.js';

export { CFG };

/* ═══════════════ DATOS DE DEMOSTRACIÓN (solo con activación explícita) ═══════════════ */
export const DEMO_DATA = [
  { id:'NO-MO-V2-001', tipo:'Maleta', estado:'Desplegado', specs:['Batería EcoFlow EF4','Repetidora Omada','2 ventiladores Arctic P12 Pro PST con filtros de papel','Módulo de centinela: #09','Maleta Móvil'], pendientes:[], responsable:'', demora:'', observaciones:'' },
  { id:'NO-AN-V3-001', tipo:'Maleta', estado:'Desplegado', specs:['Batería Ecoflow 2 Pro (768 Wh)','Bases plug and play impermeables','Repetidora Omada','PoE Texas','Cigarrera 12V','Entradas para carga solar y AC','Ventiladores Rui Zhan con filtros de nylon-tul','Módulo de centinela: #07','Maleta de doble modalidad (móvil y fijo)'], pendientes:[], responsable:'', demora:'', observaciones:'' },
  { id:'NO-MO-V3-001', tipo:'Maleta', estado:'En actualizaciones', specs:['Batería Ecoflow 2 Pro (512 Wh)','Repetidora Omada','Cigarrera 12V','Entradas para carga solar y AC','Noctua NF-F12 con filtros de nylon','Módulo de centinela: #03','Maleta Móvil'], pendientes:['Instalación de Batería Ecoflow','Instalaciones finales'], responsable:'Dpto. Eléctrica', demora:'La batería Ecoflow de 512Wh está siendo trabajada por el departamento de Eléctrica', observaciones:'' },
  { id:'NO-FI-V3-001', tipo:'Maleta', estado:'Por ejecutar', specs:[], pendientes:[], responsable:'', demora:'', observaciones:'' },
  { id:'NO-FI-V3-002', tipo:'Maleta', estado:'En actualizaciones', specs:['Repetidora Omada','Cigarrera 12V','Entradas para carga solar y AC','Corsair RS120 con filtros de aire','Módulo de centinela: #08','Maleta Móvil'], pendientes:['Actualización de cableado del puerto de carga AC','Instalación de Batería Ecoflow','Instalaciones finales','Placa identificadora','Instalación de antena Starlink'], responsable:'Dpto. Mecánica', demora:'En espera de la impresión de las gomas a prueba protectora del puerto de carga AC', observaciones:'' },
  { id:'BO-V1-001', tipo:'Bolso', estado:'Completado', specs:['Cables DC-Tipo C de 3m'], pendientes:['Instalar powerband y antena Starlink'], responsable:'', demora:'', observaciones:'' },
  { id:'BO-V1-002', tipo:'Bolso', estado:'Por ejecutar', specs:[], pendientes:[], responsable:'', demora:'', observaciones:'' }
];

/* ═══════════════ LECTURA DE GOOGLE SHEETS (sin Apps Script) ═══════════════ */
function buildCsvUrl() {
  if (CFG.CSV_URL_OVERRIDE) return CFG.CSV_URL_OVERRIDE;
  const base = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:csv`;
  return CFG.SHEET_TAB ? `${base}&sheet=${encodeURIComponent(CFG.SHEET_TAB)}` : base;
}
export const sheetUrl = () => `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/edit`;

// Parser CSV completo (soporta comillas, comas y saltos de línea dentro de celdas)
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const isNR = s => !s || /^\s*(nr|n\/a|-)?\s*$/i.test(s);
const splitList = s => isNR(s) ? [] : s.split(/\r?\n|\s{3,}/).map(x => x.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean);
const clean = s => isNR(s) ? '' : s.replace(/\s+/g, ' ').trim();

/* La hoja tiene dos bloques (MALETAS / BOLSOS) con cabeceras dobles y celdas combinadas.
   Se detectan las filas de datos por el patrón del ID (ej. NO-MO-V3-001, BO-V1-001) y se
   localizan las columnas por posición relativa a la columna del ID. */
function rowsToNodes(rows) {
  const out = []; let tipo = 'Maleta';
  const idRe = /^[A-Z]{2,3}(-[A-Z0-9]+){1,4}$/;
  for (const r of rows) {
    const cells = r.map(x => (x || '').trim());
    const joined = cells.join(' ').toUpperCase();
    if (cells.filter(Boolean).length && cells.filter(Boolean).every(x => x.toUpperCase() === cells.find(Boolean).toUpperCase())) {
      if (/BOLSO/.test(joined)) tipo = 'Bolso'; else if (/MALETA/.test(joined)) tipo = 'Maleta';
    }
    const i = cells.findIndex(x => idRe.test(x));
    if (i === -1) continue;
    const [id, estado, specs, pend, resp, demora, obs] = cells.slice(i, i + 7);
    const esBolso = /^BO/.test(id) || tipo === 'Bolso';
    // En la sección BOLSOS no hay columna "Motivo de demora"; la última es "Responsable / Observaciones"
    out.push({
      id, tipo: esBolso ? 'Bolso' : 'Maleta',
      estado: clean(estado) || 'Por ejecutar',
      specs: splitList(specs), pendientes: splitList(pend),
      responsable: clean(resp), demora: esBolso ? '' : clean(demora),
      observaciones: clean(esBolso ? [demora, obs].filter(x => !isNR(x)).join(' · ') : obs)
    });
  }
  return out;
}

// Método 1: CSV con fetch (necesita que Google envíe cabeceras CORS)
async function fetchCsvRows() {
  const res = await fetch(buildCsvUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('La hoja no es pública (respuesta de inicio de sesión)');
  return parseCSV(text);
}

// Método 2: JSONP de gviz mediante <script> (no depende de CORS)
function fetchGvizRows() {
  return new Promise((resolve, reject) => {
    const cb = '__nodoCb' + Date.now() + Math.floor(Math.random() * 1e4);
    const s = document.createElement('script');
    const done = () => { delete window[cb]; s.remove(); clearTimeout(t); };
    const t = setTimeout(() => { done(); reject(new Error('Tiempo agotado')); }, 15000);
    window[cb] = resp => {
      done();
      if (!resp || resp.status !== 'ok' || !resp.table) return reject(new Error('Respuesta inválida (¿hoja no pública?)'));
      resolve(resp.table.rows.map(r => (r.c || []).map(c => c && c.v != null ? String(c.v) : '')));
    };
    s.onerror = () => { done(); reject(new Error('No se pudo cargar el script de Google')); };
    s.src = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?headers=0&tqx=out:json;responseHandler:${cb}` +
            (CFG.SHEET_TAB ? `&sheet=${encodeURIComponent(CFG.SHEET_TAB)}` : '');
    document.head.appendChild(s);
  });
}

export async function loadData() {
  let rows, errs = [];
  for (const method of [fetchCsvRows, fetchGvizRows]) {
    try { rows = await method(); break; } catch (e) { errs.push(e.message); }
  }
  if (!rows) throw new Error(errs.join(' | '));
  const nodes = rowsToNodes(rows);
  if (!nodes.length) throw new Error('No se encontraron filas con ID válido');
  return nodes;
}

/* ═══════════════ ESTADOS ═══════════════ */
export const norm = s => (s || '').toLowerCase();
export const statusKind = s => {
  const v = norm(s);
  if (/desplegad|completad/.test(v)) return 'ok';
  if (/actualiz/.test(v)) return 'upd';
  if (/ejecutar/.test(v)) return 'todo';
  return 'other';
};
export const badge = s => `<span class="chip chip-${statusKind(s)}"><span class="dot ${statusKind(s) === 'upd' ? 'pulse' : ''}"></span>${esc(s)}</span>`;
export const small = icon => icon.replace('<svg', '<svg width="16" height="16"');

/* Número del módulo de centinela tomado de las especificaciones (ej. «Módulo de centinela: #03» → «#03»). */
export function sentinelOf(node) {
  const spec = node.specs.find(s => /centinela/i.test(s));
  if (!spec) return '';
  const m = spec.match(/centinela\s*:?\s*(.+)$/i);
  return (m ? m[1] : spec).trim();
}

/* ═══════════════ FICHA DEL NODO ═══════════════ */
export function openNodeDetail(x, { demo = false } = {}) {
  const sec = (icon, title, body) => `<section class="sec"><h3 class="sec-title">${icon}${title}</h3>${body}</section>`;
  const empty = t => `<p class="none" style="font-size:14px">${t}</p>`;
  openModal({ html: `
    <div class="modal-head"><div><p class="kicker">${x.tipo}${demo ? ' · <span style="color:var(--orange)">DEMOSTRACIÓN</span>' : ''}</p>
      <h2 data-modal-title class="mono accent" style="font-size:24px">${esc(x.id)}</h2><div style="margin-top:8px">${badge(x.estado)}</div></div>
      <button class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
    <div class="modal-body">
      ${x.demora ? `<div style="margin-bottom:20px">${alertBox('warn', 'Motivo de demora', `<p>${esc(x.demora)}</p>`)}</div>` : ''}
      ${sec(ICON.chip, 'Ficha técnica', x.specs.length ? `<ul class="spec-list two">${x.specs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : empty('Sin especificaciones registradas.'))}
      ${sec(ICON.list, 'Actividades pendientes', x.pendientes.length ? `<ul class="todo-list">${x.pendientes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : empty('Sin actividades pendientes.'))}
      <div class="cols-2">
        ${sec(ICON.user, 'Responsable', x.responsable ? `<p>${esc(x.responsable)}</p>` : empty('No asignado.'))}
        ${sec(ICON.note, 'Observaciones', x.observaciones ? `<p>${esc(x.observaciones)}</p>` : empty('Sin observaciones.'))}
      </div>
    </div>` });
}

/* ═══════════════ ESTADO COMPARTIDO ENTRE VISTAS ═══════════════
   Ambas vistas leen la misma hoja; los datos se reutilizan durante 60 s al cambiar de vista.
   mode: 'live' | 'demo' | 'error' | 'loading' */
export const shared = { data: [], mode: 'loading', error: '', updated: null, loadedAt: 0 };
let inflight = null;

export async function refreshShared({ force = false } = {}) {
  if (inflight) return inflight;
  if (!force && shared.mode === 'live' && Date.now() - shared.loadedAt < 60000) return;
  if (!shared.data.length) shared.mode = 'loading';
  inflight = (async () => {
    try {
      const data = await loadData();
      Object.assign(shared, { data, mode: 'live', error: '', updated: new Date(), loadedAt: Date.now() });
    } catch (e) {
      console.error('[NODO] Error al leer Sheets:', e);
      shared.error = e.message;
      // Se conservan los últimos datos en vivo; nunca se sustituyen por la demostración automáticamente.
      shared.mode = shared.data.length && shared.mode !== 'demo' ? 'live' : 'error';
      if (shared.mode === 'error') shared.data = [];
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

export function startDemo() {
  Object.assign(shared, { data: DEMO_DATA.map(x => ({ ...x })), mode: 'demo', error: '', updated: null, loadedAt: 0 });
}

export function leaveDemo() {
  if (shared.mode === 'demo') Object.assign(shared, { data: [], mode: 'loading' });
}

/* Aviso de origen de datos (demostración o error) común a las dos vistas. */
export function sourceBanner() {
  if (shared.mode === 'demo') {
    return `<div style="margin-bottom:16px">${alertBox('demo', 'Estás viendo DATOS DE DEMOSTRACIÓN',
      `<p>No provienen de Google Sheets y pueden estar desactualizados. La actualización automática está detenida.</p>`,
      `<button class="btn btn-sm" data-act="retry">${ICON.refresh}Volver a conectar con Sheets</button>`)}</div>`;
  }
  if (shared.error) {
    const hasData = shared.data.length > 0;
    return `<div style="margin-bottom:16px">${alertBox(hasData ? 'warn' : 'err',
      hasData ? 'No se pudo actualizar desde Google Sheets' : 'No se pudo leer Google Sheets',
      `<p>${esc(shared.error)}</p><p class="muted" style="margin-top:4px">${hasData ? 'Se muestran los últimos datos leídos correctamente.' : 'Verifica que la hoja esté compartida como «Cualquier persona con el enlace · Lector» y que tengas conexión.'}</p>`,
      `<button class="btn btn-sm" data-act="retry">${ICON.refresh}Reintentar</button>` +
      (!hasData && CFG.ALLOW_DEMO ? `<button class="btn btn-sm" data-act="demo">Ver datos de demostración</button>` : ''))}</div>`;
  }
  return '';
}

export function sourceChip(el, busy) {
  const map = {
    live: ['chip-ok', 'Sheets en vivo', true], demo: ['chip-demo', 'DATOS DE DEMOSTRACIÓN', false],
    error: ['chip-err', 'Sin conexión', false], loading: ['chip-other', 'Cargando…', false]
  };
  const [cls, txt, pulse] = map[shared.mode];
  el.className = 'chip ' + cls;
  el.innerHTML = `<span class="dot ${pulse ? 'pulse' : ''}"></span><span>${busy && shared.mode !== 'loading' ? 'Actualizando…' : txt}</span>`;
  el.title = shared.mode === 'live' ? `Fuente: Google Sheets ${CFG.SHEET_ID}${CFG.SHEET_TAB ? ' · ' + CFG.SHEET_TAB : ''}` : '';
}

export function sourceFoot() {
  const srcLink = `<a href="${esc(sheetUrl())}" target="_blank" rel="noopener">hoja de Google Sheets</a>`;
  return shared.mode === 'demo'
    ? 'Mostrando datos de demostración incluidos en la aplicación — no reflejan el estado real.'
    : `Fuente: ${srcLink}${CFG.SHEET_TAB ? ' · pestaña ' + esc(CFG.SHEET_TAB) : ''} · ${shared.updated ? 'Última actualización ' + shared.updated.toLocaleString('es') : 'sin datos aún'}`;
}
