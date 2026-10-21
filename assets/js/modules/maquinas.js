/* Infraestructura › Máquinas de simulación.
   Subventanas: Vendidas, En stock y Referencia del archivo original (solo lectura).
   Los registros viven en la pestaña normalizada App_Maquinas de Google Sheets y se leen/escriben
   a través de /api/machines (nunca directamente desde el navegador). */
import { api } from '../api.js';
import { esc, ICON, store, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';
import { MAQUINAS as CFG } from '../config.js';
import {
  CATEGORIAS, LADOS, CONDICIONES, TAB_APP, validateMachine, findDuplicates, consistencyWarnings,
  normalizeCategoria, normalizeLado, trimSpaces, codeKey, COLUMNS
} from '/shared/machines-core.js';
import { REFERENCE_ROWS, SNAPSHOT_DATE, referenceFromValues } from '/shared/reference-snapshot.js';
import { readPublicSheet } from '../sheets-public.js';

const TABS = [
  { id: 'vendidas', title: 'Máquinas vendidas', short: 'Vendidas', condicion: 'Vendida' },
  { id: 'stock', title: 'Máquinas en stock', short: 'En stock', condicion: 'En stock' },
  { id: 'referencia', title: 'Referencia del archivo', short: 'Referencia del archivo' }
];

/* Estado compartido entre subventanas (se conserva al cambiar de pestaña o de vista). */
const S = {
  records: [], status: 'idle', error: null, fetchedAt: null, loadedAt: 0, source: null, // 'api' | 'public'
  ref: null, refSource: null, refError: null,
  view: store.get('maq-view') === 'table' ? 'table' : 'grid',
  filters: {
    vendidas: { q: '', cat: '', lado: '', warn: false },
    stock: { q: '', cat: '', lado: '', warn: false },
    referencia: { q: '', bloque: '' }
  }
};

const small = icon => icon.replace('<svg', '<svg width="16" height="16"');
const condChip = c => c === 'Vendida' ? `<span class="chip chip-todo"><span class="dot"></span>Vendida</span>`
  : c === 'En stock' ? `<span class="chip chip-ok"><span class="dot"></span>En stock</span>`
  : `<span class="chip chip-other">Sin condición</span>`;
const none = (t = '—') => `<span class="none">${t}</span>`;
const warnsOf = r => consistencyWarnings(r);

/* Enlaces de Google Drive «/file/d/ID/view» no se muestran como imagen; se usa su miniatura pública. */
function imgSrc(url) {
  if (!url) return '';
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url;
}
const imgTag = (url, alt, cls = '') => `<img src="${esc(imgSrc(url))}" alt="${esc(alt)}" class="${cls}" loading="lazy" referrerpolicy="no-referrer"
  onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'No se pudo cargar la imagen'}))">`;

const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ═════════ Carga ═════════ */
let inflight = null;
async function loadRecords(force = false) {
  if (inflight) return inflight;
  // Reutiliza los datos si se leyeron hace menos de 60 s (al cambiar de subventana); si no, vuelve a leer.
  if (!force && S.status === 'ready' && Date.now() - S.loadedAt < 60000) return;
  S.status = 'loading'; S.error = null;
  inflight = (async () => {
    try {
      const d = await api('/api/machines');
      S.records = d.records || []; S.source = 'api';
    } catch (e) {
      // Sin servidor configurado: se lee la hoja pública directamente (solo lectura), como en Nodos.
      if (!SERVER_MISSING.includes(e.code)) throw e;
      S.source = 'public';
      S.records = await readPublicRecords();
    }
    S.fetchedAt = new Date().toISOString(); S.status = 'ready'; S.loadedAt = Date.now();
  })().catch(e => { S.status = 'error'; S.error = e; }).finally(() => { inflight = null; });
  return inflight;
}

const SERVER_MISSING = ['NOT_CONFIGURED', 'NO_API'];

/* Pestaña sencilla que se llena a mano en Google Sheets. Encabezados en la fila 1, en cualquier orden;
   se aceptan con o sin tildes y mayúsculas. Obligatorios: Codificación y Condición. */
export const SIMPLE_HEADERS = ['Codificación', 'Categoría', 'Serial', 'Escalera', 'Condición', 'Imagen'];
const HEADER_ALIASES = {
  id: ['id', 'identificador'],
  codificacion: ['codificacion', 'codigo'],
  categoria: ['categoria'],
  serial: ['serial'],
  escalera: ['escalera', 'lado de la escalera', 'lado escalera', 'lado'],
  condicion: ['condicion', 'condicion comercial', 'estado'],
  imagen_url: ['imagen', 'imagen_url', 'imagen url', 'foto'],
  creado: ['creado'], modificado: ['modificado'], version: ['version'],
  creado_por: ['creado_por'], modificado_por: ['modificado_por'], origen: ['origen'], valor_original: ['valor_original']
};
const headerKey = h => String(h || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const normalizeCondicion = v => {
  const s = headerKey(v);
  if (/^(en )?stock$|^disponible$/.test(s)) return 'En stock';
  if (/^vendid[ao]$/.test(s)) return 'Vendida';
  return '';
};

async function readPublicRecords() {
  // Se prueba cada pestaña configurada. Si una no existe, Google devuelve la primera (Hoja 1);
  // por eso solo se acepta la que tenga las columnas Codificación y Condición.
  let rows = null, col = null, tabName = '';
  for (const tab of CFG.MACHINES_TABS) {
    const data = await readPublicSheet(CFG.SPREADSHEET_ID, { tab });
    const header = (data[0] || []).map(headerKey);
    const c = {};
    for (const [field, names] of Object.entries(HEADER_ALIASES)) {
      const i = header.findIndex(h => names.includes(h));
      if (i >= 0) c[field] = i;
    }
    if (c.codificacion !== undefined && c.condicion !== undefined) { rows = data; col = c; tabName = tab; break; }
  }
  if (!rows)
    throw Object.assign(new Error(`No se encontró una pestaña de máquinas (${CFG.MACHINES_TABS.join(', ')}) con las columnas Codificación y Condición.`), { code: 'TABLE_MISSING_PUBLIC' });
  S.publicTab = tabName;

  const out = [];
  S.unclassified = [];
  rows.slice(1).forEach((row, i) => {
    const get = f => (col[f] === undefined ? '' : String(row[col[f]] ?? ''));
    if (!trimSpaces(get('codificacion'))) return;
    const fila = i + 2;
    const original = {};
    const cat = normalizeCategoria(get('categoria')), lado = normalizeLado(get('escalera')), cond = normalizeCondicion(get('condicion'));
    if (get('categoria') && get('categoria') !== cat) original.categoria = get('categoria');
    if (get('escalera') && get('escalera') !== lado) original.escalera = get('escalera');
    const r = {
      // Sin columna id se usa la fila como referencia (cambia si se insertan filas encima).
      id: trimSpaces(get('id')) || `FILA-${fila}`,
      codificacion: trimSpaces(get('codificacion')), categoria: cat || trimSpaces(get('categoria')), serial: /^[-–—]+$/.test(trimSpaces(get('serial'))) ? '' : trimSpaces(get('serial')), // «-» = sin serial
      escalera: lado || trimSpaces(get('escalera')), condicion: cond, imagen_url: trimSpaces(get('imagen_url')),
      origen: trimSpaces(get('origen')) || `${tabName}!fila ${fila}`,
      valor_original: get('valor_original') || (Object.keys(original).length ? JSON.stringify(original) : ''),
      creado: get('creado'), modificado: get('modificado'), version: Number(get('version')) || 1,
      creado_por: get('creado_por'), modificado_por: get('modificado_por')
    };
    if (!cond) S.unclassified.push({ fila, codificacion: r.codificacion, valor: get('condicion') });
    out.push(r);
  });
  return out;
}

/* Las 14 entradas de Hoja 1, normalizadas y con Condición VACÍA, listas para pegar en la celda A1. */
function referenceAsTsv() {
  const rows = (S.ref || REFERENCE_ROWS).map(r => [trimSpaces(r.codificacion), normalizeCategoria(r.categoria), trimSpaces(r.serial), normalizeLado(r.escalera), '', '']);
  return [SIMPLE_HEADERS, ...rows].map(r => r.join('\t')).join('\n');
}

async function loadReference() {
  try {
    const d = await api('/api/reference');
    S.ref = d.rows; S.refSource = { kind: 'live', at: d.fetchedAt }; S.refError = null;
    return;
  } catch (e) { S.refError = e; }
  try {
    const values = await readPublicSheet(CFG.SPREADSHEET_ID, { tab: CFG.SOURCE_TAB, range: 'A2:J' });
    const head = (values[0] || []).map(v => String(v).trim().toUpperCase());
    if (!head.includes('SERIAL')) throw new Error(`La pestaña «${CFG.SOURCE_TAB}» no tiene los encabezados esperados.`);
    S.ref = referenceFromValues(values); S.refSource = { kind: 'live', at: new Date().toISOString() }; S.refError = null;
  } catch (e) {
    S.ref = REFERENCE_ROWS; S.refSource = { kind: 'snapshot', at: SNAPSHOT_DATE }; S.refError = e;
  }
}

const canWrite = ctx => S.source === 'api' && ctx.canEdit();

/* ═════════ Módulo ═════════ */
export function mount(root, ctx) {
  const tab = TABS.find(t => t.id === ctx.sub[0]);
  if (!tab) { location.replace(ctx.base + '/vendidas'); return null; }
  ctx.setExtraCrumbs([{ title: tab.short }]);
  let alive = true;

  root.innerHTML = `<div class="maquinas">
    <div class="section-head">
      <div><p class="eyebrow">Infraestructura</p><h1>Máquinas de simulación</h1>
        <p>Vendidas y en stock comparten los mismos registros; la condición comercial se asigna al registrar cada máquina.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="chip chip-other" data-src><span class="dot"></span><span>Cargando…</span></span>
        <button class="btn" data-act="reload">${ICON.refresh}<span>Actualizar</span></button>
      </div>
    </div>
    <nav class="tabs" aria-label="Subventanas de máquinas" data-tabs></nav>
    <div data-banner></div>
    <div data-body></div>
  </div>`;
  const $ = s => root.querySelector(s);

  function renderTabs() {
    const n = c => S.status === 'ready' ? S.records.filter(r => r.condicion === c).length : '…';
    $('[data-tabs]').innerHTML = TABS.map(t => `<a href="${ctx.base}/${t.id}" ${t.id === tab.id ? 'aria-current="page"' : ''}>${t.short}
      <span class="n">${t.condicion ? n(t.condicion) : (S.ref ? S.ref.length : REFERENCE_ROWS.length)}</span></a>`).join('');
  }

  function renderSource() {
    const el = $('[data-src]');
    const btn = $('[data-act="reload"]');
    const loading = S.status === 'loading';
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="spinner"></span><span>Actualizando…</span>' : `${ICON.refresh}<span>Actualizar</span>`;
    if (S.status === 'ready') {
      el.className = 'chip chip-ok';
      el.innerHTML = `<span class="dot pulse"></span><span>Sheets · ${S.source === 'public' ? S.publicTab + ' · solo lectura' : TAB_APP}</span>`;
      el.title = 'Última lectura: ' + fmtDate(S.fetchedAt);
    }
    else if (S.status === 'error' && S.error && S.error.code === 'TABLE_MISSING_PUBLIC') { el.className = 'chip chip-upd'; el.innerHTML = `<span class="dot"></span><span>Sheets · solo lectura · sin ${TAB_APP}</span>`; el.title = ''; }
    else if (S.status === 'error') { el.className = 'chip chip-err'; el.innerHTML = `<span class="dot"></span><span>Sin conexión</span>`; el.title = ''; }
    else { el.className = 'chip chip-other'; el.innerHTML = `<span class="dot"></span><span>Cargando…</span>`; }
  }

  /* ── Errores de conexión ── */
  function errorState() {
    const e = S.error, code = e && e.code;
    const retry = `<button class="btn btn-sm" data-act="reload">${ICON.refresh}Reintentar</button>`;
    if (code === 'TABLE_MISSING') {
      return alertBox('info', `La tabla de la aplicación todavía no existe`,
        `<p>La hoja de Google Sheets está conectada, pero falta la pestaña normalizada <b class="mono" style="display:inline">${TAB_APP}</b>.
         Al inicializarla se crea esa pestaña con sus encabezados. <b style="display:inline">No se modifica «Hoja 1» ni se copia ningún registro.</b></p>`,
        ctx.canEdit() ? `<button class="btn btn-sm btn-primary" data-act="init">Inicializar tabla ${TAB_APP}</button>${retry}`
          : `<button class="btn btn-sm" data-act="login">${ICON.lock}Inicia sesión como editor para inicializarla</button>${retry}`);
    }
    if (code === 'TABLE_MISSING_PUBLIC') {
      return alertBox('info', `Falta la pestaña «${TAB_APP}» en la hoja`,
        `<p>«Hoja 1» no dice qué máquinas están vendidas o en stock, por eso las máquinas se anotan en una pestaña aparte. La app la lee sola, igual que Nodos.</p>
         <ol style="margin:8px 0 0;padding-left:20px;display:grid;gap:4px">
           <li>Pulsa <b style="display:inline">Copiar las 14 entradas de Hoja 1</b>.</li>
           <li>En la hoja, crea una pestaña nueva (botón <b style="display:inline">+</b> abajo a la izquierda) y nómbrala exactamente <b class="mono" style="display:inline">${TAB_APP}</b>.</li>
           <li>Haz clic en la celda <b style="display:inline">A1</b> y pega (Ctrl+V).</li>
           <li>En la columna <b style="display:inline">Condición</b> escribe <b style="display:inline">En stock</b> o <b style="display:inline">Vendida</b> en cada máquina, y borra las filas que no correspondan a una máquina real.</li>
           <li>Vuelve aquí y pulsa <b style="display:inline">Reintentar</b>.</li>
         </ol>
         <p class="muted" style="margin-top:8px">Columnas: ${SIMPLE_HEADERS.join(' · ')}. Imagen es opcional (un enlace https). Para agregar o corregir máquinas más adelante, edita esa pestaña.</p>`,
        `<button class="btn btn-sm btn-primary" data-act="copy-ref">Copiar las 14 entradas de Hoja 1</button>
         <button class="btn btn-sm" data-act="copy-headers">Copiar solo encabezados</button>
         <a class="btn btn-sm" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir la hoja</a>${retry}`);
    }
    if (code === 'NOT_PUBLIC') {
      return alertBox('warn', 'La hoja de máquinas no es pública', `<p>${esc(e.message)}</p>`, retry);
    }
    if (code === 'NOT_CONFIGURED') {
      const miss = (e.data && e.data.missing) || [];
      return alertBox('warn', 'La conexión con Google Sheets no está configurada',
        `<p>El servidor no tiene las variables de entorno necesarias${miss.length ? ': ' + miss.map(m => `<code>${esc(m)}</code>`).join(', ') : ''}.
         Consulta la sección «Google Sheets» del README.</p>`, retry);
    }
    if (code === 'AUTH_REQUIRED') {
      return alertBox('info', 'Inicia sesión para consultar las máquinas', `<p>${esc(e.message)}</p>`, `<button class="btn btn-sm btn-primary" data-act="login">${ICON.lock}Iniciar sesión</button>`);
    }
    return alertBox('err', 'No se pudieron leer las máquinas', `<p>${esc(e ? e.message : 'Error desconocido')}</p>`, retry);
  }

  /* ── Subventanas Vendidas / En stock ── */
  function filteredRecords() {
    const f = S.filters[tab.id], q = f.q.trim().toLowerCase();
    return S.records
      .filter(r => r.condicion === tab.condicion)
      .filter(r => (!f.cat || r.categoria === f.cat) && (!f.lado || r.escalera === f.lado) && (!f.warn || warnsOf(r).length)
        && (!q || [r.codificacion, r.serial, r.categoria, r.escalera, r.id].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => a.codificacion.localeCompare(b.codificacion, 'es', { numeric: true }));
  }

  function renderListShell() {
    const f = S.filters[tab.id];
    const opt = (arr, v, all) => `<option value="">${all}</option>` + arr.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
    $('[data-body]').innerHTML = `
      <section class="panel toolbar" aria-label="Búsqueda y filtros">
        <div class="search">${ICON.search}<label class="sr-only" for="mq-q">Buscar máquinas</label>
          <input id="mq-q" type="search" placeholder="Buscar por codificación o serial…" value="${esc(f.q)}"></div>
        <label class="sr-only" for="mq-cat">Categoría</label><select id="mq-cat" class="select">${opt(CATEGORIAS, f.cat, 'Categoría: todas')}</select>
        <label class="sr-only" for="mq-lado">Lado de la escalera</label><select id="mq-lado" class="select">${opt(LADOS, f.lado, 'Escalera: ambos lados')}</select>
        <label class="check"><input type="checkbox" id="mq-warn" ${f.warn ? 'checked' : ''}> Solo con advertencias</label>
        <span class="spacer"></span>
        <div class="seg" role="group" aria-label="Cambiar vista">
          <button data-view="grid" aria-pressed="${S.view === 'grid'}">${ICON.grid}Tarjetas</button>
          <button data-view="table" aria-pressed="${S.view === 'table'}">${ICON.table}Tabla</button>
        </div>
        <span data-add></span>
      </section>
      <p class="count" data-count aria-live="polite"></p>
      <div data-list></div>`;
    renderAddButton();
    const body = $('[data-body]');
    body.querySelector('#mq-q').addEventListener('input', e => { f.q = e.target.value; renderList(); });
    body.querySelector('#mq-cat').addEventListener('change', e => { f.cat = e.target.value; renderList(); });
    body.querySelector('#mq-lado').addEventListener('change', e => { f.lado = e.target.value; renderList(); });
    body.querySelector('#mq-warn').addEventListener('change', e => { f.warn = e.target.checked; renderList(); });
    body.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      S.view = b.dataset.view; store.set('maq-view', S.view);
      body.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === S.view)));
      renderList();
    }));
  }

  function renderAddButton() {
    const el = $('[data-add]'); if (!el) return;
    const disabled = S.status !== 'ready';
    if (S.source === 'public') {
      el.innerHTML = `<a class="btn btn-primary" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener" title="Las máquinas se agregan y editan en la pestaña ${S.publicTab} de Google Sheets">${ICON.plus}<span>Agregar en Google Sheets</span></a>`;
      return;
    }
    el.innerHTML = ctx.canEdit()
      ? `<button class="btn btn-primary" data-act="add" ${disabled ? 'disabled title="Disponible cuando la tabla esté conectada"' : ''}>${ICON.plus}<span>Agregar máquina</span></button>`
      : `<button class="btn" data-act="login" title="Agregar y editar requiere una cuenta de editor">${ICON.lock}<span>Inicia sesión para agregar</span></button>`;
  }

  function renderList() {
    const list = $('[data-list]'), count = $('[data-count]');
    if (!list) return;
    if (S.status === 'loading' || S.status === 'idle') {
      count.textContent = '';
      list.innerHTML = `<div class="card-grid" aria-label="Cargando máquinas">${'<div class="skeleton" style="height:230px"></div>'.repeat(4)}</div>`;
      return;
    }
    if (S.status === 'error') { count.textContent = ''; list.innerHTML = errorState(); return; }
    const all = S.records.filter(r => r.condicion === tab.condicion), rows = filteredRecords();
    count.textContent = `Mostrando ${rows.length} de ${all.length} ${tab.id === 'vendidas' ? 'máquinas vendidas' : 'máquinas en stock'}`;
    if (!all.length) {
      list.innerHTML = `<div class="state"><h3>Todavía no hay ${tab.id === 'vendidas' ? 'máquinas vendidas' : 'máquinas en stock'}</h3>
        <p>Agrega una máquina e indica su condición comercial, o regístrala desde la pestaña «Referencia del archivo».</p>
        <div class="alert-actions">${canWrite(ctx) ? `<button class="btn btn-primary btn-sm" data-act="add">${ICON.plus}Agregar máquina</button>` : ''}
        <a class="btn btn-sm" href="${ctx.base}/referencia">Ver referencia del archivo</a></div></div>`;
      return;
    }
    if (!rows.length) {
      list.innerHTML = `<div class="state"><h3>Sin resultados</h3><p>Ninguna máquina coincide con la búsqueda o los filtros.</p>
        <div class="alert-actions"><button class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`;
      return;
    }
    if (S.view === 'table') {
      list.innerHTML = `<div class="panel table-wrap fade-in"><table class="data">
        <thead><tr><th scope="col">Codificación</th><th scope="col">Categoría</th><th scope="col">Escalera</th><th scope="col">Serial</th>
          <th scope="col">Imagen</th><th scope="col">Revisión</th><th scope="col">Modificado</th></tr></thead>
        <tbody>${rows.map(r => { const w = warnsOf(r); return `<tr class="row" tabindex="0" data-id="${esc(r.id)}" aria-label="Ver ficha de ${esc(r.codificacion)}">
          <td class="cell-id">${esc(r.codificacion)}</td><td>${esc(r.categoria)}</td><td>${esc(r.escalera)}</td>
          <td class="mono">${r.serial ? esc(r.serial) : none('Sin serial')}</td>
          <td>${r.imagen_url ? '<span class="chip chip-ok">Sí</span>' : none('No')}</td>
          <td>${w.length ? `<span class="chip chip-warn" title="${esc(w.join(' '))}">${small(ICON.warn)}${w.length}</span>` : none()}</td>
          <td class="muted" style="white-space:nowrap">${esc(fmtDate(r.modificado))}</td></tr>`; }).join('')}</tbody></table></div>`;
    } else {
      list.innerHTML = `<div class="card-grid fade-in">${rows.map(r => { const w = warnsOf(r); return `
        <button type="button" class="item-card row" data-id="${esc(r.id)}" aria-label="Ver ficha de ${esc(r.codificacion)}">
          <span class="thumb">${r.imagen_url ? imgTag(r.imagen_url, 'Imagen de ' + r.codificacion) : `<span class="ph">${ICON.image}Sin imagen</span>`}</span>
          <span class="top"><span class="cell-id" style="font-size:16px">${esc(r.codificacion)}</span>${condChip(r.condicion)}</span>
          <dl class="kv"><dt>Categoría</dt><dd>${esc(r.categoria)}</dd><dt>Escalera</dt><dd>${esc(r.escalera)}</dd>
            <dt>Serial</dt><dd class="mono">${r.serial ? esc(r.serial) : none('Sin serial')}</dd></dl>
          <span class="foot" style="margin-top:12px"><span>${esc(fmtDate(r.modificado))}</span>
            ${w.length ? `<span class="chip chip-warn">${small(ICON.warn)}Revisar</span>` : ''}</span>
        </button>`; }).join('')}</div>`;
    }
  }

  /* ── Subventana Referencia ── */
  function renderReference() {
    const f = S.filters.referencia;
    const rows = S.ref || REFERENCE_ROWS;
    const src = S.refSource;
    const registered = new Map(S.records.map(r => [codeKey(r.codificacion), r]));
    const q = f.q.trim().toLowerCase();
    const list = rows.filter(r => (!f.bloque || r.bloque === f.bloque) && (!q || [r.codificacion, r.serial, r.categoria, r.escalera].join(' ').toLowerCase().includes(q)));
    const srcNote = !src ? 'Cargando…'
      : src.kind === 'live' ? `Leída en vivo desde «Hoja 1» · ${esc(fmtDate(src.at))}`
      : `Copia incluida en la aplicación (leída el ${esc(src.at)}). No se pudo leer en vivo: ${esc(S.refError ? S.refError.message : '')}`;

    $('[data-body]').innerHTML = `
      <div style="margin-bottom:16px">${alertBox('info', 'Referencia del archivo «Codificación de Máquinas de Simulación» · Hoja 1',
        `<p>Contiene dos bloques paralelos: el izquierdo (7 entradas «Con Chapa», con serial e imágenes incrustadas) y el derecho (7 entradas «Sin Chapa», sin serial ni imagen).
         El archivo <b style="display:inline">no indica</b> si una entrada está vendida o en stock, ni clientes, precios o fechas, y no confirma si las entradas con la misma letra son la misma máquina.
         Por eso aquí nada se clasifica automáticamente: cada entrada se registra a mano eligiendo su condición comercial.</p>
         <p class="muted" style="margin-top:6px">${srcNote} · <a href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir hoja original</a></p>`)}</div>
      <section class="panel toolbar" aria-label="Filtros de referencia">
        <div class="search">${ICON.search}<label class="sr-only" for="rf-q">Buscar en la referencia</label>
          <input id="rf-q" type="search" placeholder="Buscar codificación o serial…" value="${esc(f.q)}"></div>
        <label class="sr-only" for="rf-b">Bloque</label>
        <select id="rf-b" class="select"><option value="">Bloque: ambos</option>
          <option ${f.bloque === 'Izquierdo' ? 'selected' : ''} value="Izquierdo">Bloque izquierdo (C:F)</option>
          <option ${f.bloque === 'Derecho' ? 'selected' : ''} value="Derecho">Bloque derecho (H:J)</option></select>
      </section>
      <p class="count">Mostrando ${list.length} de ${rows.length} entradas del archivo</p>
      ${list.length ? `<div class="panel table-wrap"><table class="data">
        <thead><tr><th scope="col">Origen</th><th scope="col">Codificación</th><th scope="col">Categoría</th><th scope="col">Serial</th>
          <th scope="col">Escalera</th><th scope="col">Imagen</th><th scope="col">En la aplicación</th><th scope="col"><span class="sr-only">Acción</span></th></tr></thead>
        <tbody>${list.map((r, i) => {
          const lado = normalizeLado(r.escalera), cat = normalizeCategoria(r.categoria);
          const reg = registered.get(codeKey(r.codificacion));
          const w = consistencyWarnings({ codificacion: r.codificacion, categoria: cat, escalera: lado });
          // Se anota el valor original solo si difiere de la forma normalizada en algo más que mayúsculas.
          const changed = (orig, normd) => normd && trimSpaces(orig).toLowerCase() !== normd.toLowerCase()
            ? `${esc(normd)}<br><span class="dim" style="font-size:12px">original: «${esc(orig)}»</span>`
            : orig !== trimSpaces(orig) ? `${esc(normd)}<br><span class="dim" style="font-size:12px">original con espacio: «${esc(orig)}»</span>` : esc(normd || orig);
          return `<tr>
            <td class="mono" style="white-space:nowrap;font-size:13px">Hoja 1!${esc(r.celdas)}<br><span class="dim">Bloque ${esc(r.bloque.toLowerCase())}</span></td>
            <td class="cell-id">${esc(trimSpaces(r.codificacion))}${w.length ? ` <span class="chip chip-warn" title="${esc(w.join(' '))}">${small(ICON.warn)}</span>` : ''}</td>
            <td>${changed(r.categoria, cat)}</td>
            <td class="mono">${r.serial ? esc(r.serial) : none('Sin serial en el archivo')}</td>
            <td>${changed(r.escalera, lado)}</td>
            <td class="muted" style="font-size:13px;white-space:nowrap">${r.imagen ? '<span title="Imagen incrustada en la columna A; su asociación con esta fila no está verificada">Incrustada · por verificar</span>' : none('Sin imagen')}</td>
            <td>${reg ? `<a href="${ctx.base}/${reg.condicion === 'Vendida' ? 'vendidas' : 'stock'}" data-open="${esc(reg.id)}">${condChip(reg.condicion)}</a>` : none('Sin registrar')}</td>
            <td>${!reg && canWrite(ctx) && S.status === 'ready' ? `<button class="btn btn-sm" data-ref="${rows.indexOf(r)}">${ICON.plus}Registrar</button>` : ''}</td>
          </tr>`; }).join('')}</tbody></table></div>`
        : `<div class="state"><h3>Sin resultados</h3><p>Ninguna entrada coincide con la búsqueda.</p></div>`}
      ${S.status === 'error' ? `<div style="margin-top:16px">${errorState()}</div>` : ''}
      ${S.source === 'public' ? `<p class="count" style="margin-top:12px">Para registrar una entrada, agrégala en la pestaña ${S.publicTab || CFG.MACHINES_TABS[0]} de la hoja con su condición.</p>` : !ctx.canEdit() ? `<p class="count" style="margin-top:12px">Para registrar entradas en la aplicación inicia sesión con una cuenta de editor.</p>` : ''}`;

    const body = $('[data-body]');
    const qInput = body.querySelector('#rf-q');
    qInput.addEventListener('input', e => { f.q = e.target.value; const pos = e.target.selectionStart; renderReference(); const n = $('#rf-q'); n.focus(); n.setSelectionRange(pos, pos); });
    body.querySelector('#rf-b').addEventListener('change', e => { f.bloque = e.target.value; renderReference(); $('#rf-b').focus(); });
  }

  function render() {
    renderTabs(); renderSource();
    const pend = S.status === 'ready' && S.source === 'public' ? (S.unclassified || []) : [];
    $('[data-banner]').innerHTML = pend.length ? `<div style="margin-bottom:16px">${alertBox('warn', `${pend.length} ${pend.length === 1 ? 'máquina sin condición' : 'máquinas sin condición'} en ${S.publicTab}`,
      `<p>No aparecen en Vendidas ni En stock hasta que su columna Condición diga «En stock» o «Vendida»: ${pend.slice(0, 8).map(p => `<span class="mono">${esc(p.codificacion)}</span> (fila ${p.fila}${p.valor ? `, «${esc(p.valor)}»` : ''})`).join(', ')}${pend.length > 8 ? '…' : ''}.</p>`,
      `<a class="btn btn-sm" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir la hoja</a>`)}</div>` : '';
    if (tab.id === 'referencia') renderReference();
    else { if (!$('[data-list]')) renderListShell(); renderAddButton(); renderList(); }
  }

  /* ── Ficha ── */
  function openDetail(id) {
    const r = S.records.find(x => x.id === id); if (!r) return;
    const w = warnsOf(r);
    let orig = null; try { orig = r.valor_original ? JSON.parse(r.valor_original) : null; } catch { orig = null; }
    const f = (k, v) => `<div class="f"><p class="k">${k}</p><p class="v">${v}</p></div>`;
    const m = openModal({ html: `
      <div class="modal-head"><div><p class="kicker">Máquina de simulación</p>
        <h2 data-modal-title class="mono accent" style="font-size:24px">${esc(r.codificacion)}</h2>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${condChip(r.condicion)}${w.length ? `<span class="chip chip-warn">${small(ICON.warn)}Requiere revisión</span>` : ''}</div></div>
        <button class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        ${w.length ? `<div style="margin-bottom:16px">${alertBox('warn', 'Advertencias para revisión', `<ul style="margin:4px 0 0;padding-left:18px">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted" style="margin-top:6px">El dato se conserva tal como fue registrado.</p>`)}</div>` : ''}
        <section class="sec"><h3 class="sec-title">${ICON.image}Imagen de referencia</h3>
          ${r.imagen_url ? `<a href="${esc(r.imagen_url)}" target="_blank" rel="noopener">${imgTag(r.imagen_url, 'Imagen de ' + r.codificacion, 'detail-img')}</a>` : `<p class="none">Sin imagen asociada.</p>`}</section>
        <section class="sec"><h3 class="sec-title">${ICON.chip}Características</h3><div class="detail-grid">
          ${f('Codificación', `<span class="mono">${esc(r.codificacion)}</span>`)}${f('Categoría', esc(r.categoria))}
          ${f('Lado de la escalera', esc(r.escalera))}${f('Serial', r.serial ? `<span class="mono">${esc(r.serial)}</span>` : none('Sin serial'))}
          ${f('Condición comercial', esc(r.condicion))}</div></section>
        <section class="sec"><h3 class="sec-title">${ICON.history}Registro y trazabilidad</h3><div class="detail-grid">
          ${f('Identificador interno', `<span class="mono" style="font-size:13px">${esc(r.id)}</span>`)}
          ${f('Creado', `${esc(fmtDate(r.creado)) || none('Sin fecha')}${r.creado_por ? `<br><span class="dim">por ${esc(r.creado_por)}</span>` : ''}`)}
          ${f('Última modificación', `${esc(fmtDate(r.modificado)) || none('Sin fecha')}${r.modificado_por ? `<br><span class="dim">por ${esc(r.modificado_por)}</span>` : ''}`)}
          ${f('Versión', esc(r.version))}
          ${f('Origen', r.origen ? `<span class="mono" style="font-size:13px">${esc(r.origen)}</span>` : 'Registro creado en la aplicación')}
          ${orig ? f('Valores originales', Object.entries(orig).map(([k, v]) => `${esc(k)}: «${esc(v)}»`).join('<br>')) : ''}
        </div></section>
      </div>
      <div class="modal-foot">
        ${canWrite(ctx) ? `<div class="left">${r.condicion === 'En stock' ? `<button class="btn btn-mint" data-act="sell">${ICON.tag}Marcar como vendida</button>` : ''}</div>
          <button class="btn" data-close>Cerrar</button><button class="btn btn-primary" data-act="edit">${ICON.edit}Editar</button>`
          : S.source === 'public' ? `<a class="btn" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">${ICON.edit}Editar en Google Sheets</a><button class="btn btn-primary" data-close>Cerrar</button>`
          : `<button class="btn" data-close>Cerrar</button>`}
      </div>` });
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'edit') { m.close('force'); openForm({ record: r }); }
      if (b.dataset.act === 'sell') {
        const ok = await confirmDialog({ title: 'Marcar como vendida', confirm: 'Marcar como vendida',
          body: `<p>La máquina <b class="mono">${esc(r.codificacion)}</b> pasará a «Máquinas vendidas». Conserva su identificador, serial e historial.</p>` });
        if (!ok) return;
        b.disabled = true; b.innerHTML = '<span class="spinner"></span>Guardando…';
        try {
          const d = await api('/api/machines?id=' + encodeURIComponent(r.id), { method: 'PUT', body: { version: r.version, data: { ...pick(r), condicion: 'Vendida' } } });
          upsert(d.record); m.close('force'); toast(`${d.record.codificacion} quedó registrada como vendida.`); render();
        } catch (err) {
          b.disabled = false; b.innerHTML = `${ICON.tag}Marcar como vendida`;
          if (err.code === 'VERSION_CONFLICT') { if (err.data && err.data.current) upsert(err.data.current); m.close('force'); render(); toast('Otro usuario modificó esta máquina. Revisa los datos actuales antes de volver a intentarlo.', 'err', 7000); openDetail(r.id); }
          else toast(err.message, 'err', 7000);
        }
      }
    });
  }

  const pick = r => ({ codificacion: r.codificacion, categoria: r.categoria, serial: r.serial, escalera: r.escalera, condicion: r.condicion, imagen_url: r.imagen_url });
  const upsert = rec => { const i = S.records.findIndex(x => x.id === rec.id); if (i >= 0) S.records[i] = rec; else S.records.push(rec); };

  /* ── Formulario (agregar / editar) ── */
  function openForm({ record = null, prefill = null } = {}) {
    const editing = !!record;
    const v = record ? pick(record) : { codificacion: '', categoria: '', serial: '', escalera: '', condicion: '', imagen_url: '', ...(prefill || {}) };
    const requestId = newRequestId(); // se reutiliza en reintentos del mismo formulario → evita duplicados
    let baseVersion = record ? record.version : null;
    let saving = false, dirty = false;

    const radios = (name, opts, cur) => `<div class="radios" role="radiogroup">${opts.map((o, i) => `<label class="radio"><input type="radio" name="${name}" value="${o}" ${o === cur ? 'checked' : ''} id="mf-${name}-${i}"><span>${o}</span></label>`).join('')}</div>`;
    const m = openModal({ html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${editing ? 'Editar registro' : 'Nuevo registro'}</p>
        <h2 data-modal-title>${editing ? `Editar ${esc(record.codificacion)}` : 'Agregar máquina'}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        ${prefill && prefill.origen ? `<div style="margin-bottom:16px">${alertBox('info', `Desde la referencia: ${esc(prefill.origen)}`, '<p>Se cargaron los valores del archivo (normalizados). Elige la condición comercial; la imagen incrustada del archivo no se importa automáticamente.</p>')}</div>` : ''}
        <div data-form-msg></div>
        <div class="form-grid">
          <div class="field" data-f="codificacion"><label for="mf-cod">Codificación <span class="req">*</span></label>
            <input id="mf-cod" name="codificacion" class="input mono" value="${esc(v.codificacion)}" maxlength="40" autocomplete="off" aria-describedby="mf-cod-h mf-cod-e" placeholder="Ej. A - CC - DER">
            <p class="hint" id="mf-cod-h">Patrón observado (pendiente de confirmar): letra - CC/SC - DER/IZQ. No se genera automáticamente.</p>
            <p class="err" id="mf-cod-e"></p></div>
          <div class="field" data-f="serial"><label for="mf-ser">Serial</label>
            <input id="mf-ser" name="serial" class="input mono" value="${esc(v.serial)}" maxlength="40" autocomplete="off" aria-describedby="mf-ser-h mf-ser-e" placeholder="Opcional">
            <p class="hint" id="mf-ser-h">Opcional: algunos registros originales no tienen serial.</p><p class="err" id="mf-ser-e"></p></div>
          <fieldset class="field" data-f="categoria"><legend>Categoría <span class="req">*</span></legend>${radios('categoria', CATEGORIAS, v.categoria)}<p class="err"></p></fieldset>
          <fieldset class="field" data-f="escalera"><legend>Lado de la escalera <span class="req">*</span></legend>${radios('escalera', LADOS, v.escalera)}<p class="err"></p></fieldset>
          <fieldset class="field full" data-f="condicion"><legend>Condición comercial <span class="req">*</span></legend>${radios('condicion', CONDICIONES, v.condicion)}
            <p class="hint">Independiente de la categoría (con/sin chapa). Debe elegirse explícitamente.</p><p class="err"></p></fieldset>
          <div class="field full" data-f="imagen_url"><label for="mf-img">Imagen de referencia (enlace)</label>
            <input id="mf-img" name="imagen_url" type="url" class="input" value="${esc(v.imagen_url)}" placeholder="https://…" aria-describedby="mf-img-h mf-img-e">
            <p class="hint" id="mf-img-h">Enlace duradero (por ejemplo, un archivo de Google Drive compartido «Cualquier persona con el enlace»). Asocia solo imágenes verificadas de esta máquina.</p>
            <p class="err" id="mf-img-e"></p><img class="img-preview" alt="Vista previa de la imagen" referrerpolicy="no-referrer"></div>
          <div class="full" data-warn aria-live="polite"></div>
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary" data-submit>${ICON.ok}<span>${editing ? 'Guardar cambios' : 'Guardar máquina'}</span></button></div>
    </form>`, initialFocus: '#mf-cod' });

    const form = m.el.querySelector('form'), msg = m.el.querySelector('[data-form-msg]'), btn = m.el.querySelector('[data-submit]');
    const read = () => ({
      codificacion: form.codificacion.value, serial: form.serial.value, imagen_url: form.imagen_url.value,
      categoria: (form.querySelector('[name=categoria]:checked') || {}).value || '',
      escalera: (form.querySelector('[name=escalera]:checked') || {}).value || '',
      condicion: (form.querySelector('[name=condicion]:checked') || {}).value || ''
    });
    const setErrors = errs => {
      form.querySelectorAll('[data-f]').forEach(fl => {
        const e = errs[fl.dataset.f];
        fl.classList.toggle('invalid', !!e);
        fl.querySelector('.err').textContent = e || '';
        const inp = fl.querySelector('input'); if (inp && inp.type !== 'radio') inp.setAttribute('aria-invalid', String(!!e));
      });
      const first = Object.keys(errs)[0];
      if (first) { const fl = form.querySelector(`[data-f="${first}"]`); const inp = fl && fl.querySelector('input'); inp && inp.focus(); }
    };
    const updateWarnings = () => {
      const { value } = validateMachine(read());
      const w = consistencyWarnings(value);
      m.el.querySelector('[data-warn]').innerHTML = w.length ? alertBox('warn', 'Revisa la coherencia de los datos',
        `<ul style="margin:4px 0 0;padding-left:18px">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted" style="margin-top:6px">Puedes guardar igualmente; la advertencia quedará visible para revisión.</p>`) : '';
      const img = m.el.querySelector('.img-preview'), u = trimSpaces(form.imagen_url.value);
      if (/^https:\/\//.test(u)) { img.src = imgSrc(u); img.style.display = 'block'; img.onerror = () => { img.style.display = 'none'; }; } else img.style.display = 'none';
    };
    form.addEventListener('input', () => { dirty = true; updateWarnings(); });
    updateWarnings();
    m.setCanClose(() => saving ? false : (!dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')));

    async function submit(overrideVersion) {
      if (saving) return; // evita doble envío
      msg.innerHTML = '';
      const { value, errors } = validateMachine(read());
      const dup = findDuplicates(S.records, value, record && record.id);
      const errs = { ...errors, ...Object.fromEntries(Object.entries(dup).filter(([k]) => !errors[k])) };
      setErrors(errs);
      if (Object.keys(errs).length) { msg.innerHTML = alertBox('err', 'Revisa los campos marcados', '<p>Corrige los errores para poder guardar.</p>'); return; }

      saving = true; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Guardando…</span>';
      form.querySelectorAll('input').forEach(i => { i.readOnly = true; });
      try {
        const d = editing
          ? await api('/api/machines?id=' + encodeURIComponent(record.id), { method: 'PUT', body: { version: overrideVersion ?? baseVersion, data: value } })
          : await api('/api/machines', { method: 'POST', body: { action: 'create', requestId, data: { ...value, origen: prefill && prefill.origen || '', valor_original: prefill && prefill.valor_original || '' } } });
        upsert(d.record);
        saving = false; dirty = false; m.close('force');
        toast(editing ? `Cambios guardados en ${d.record.codificacion}.` : `${d.record.codificacion} se guardó en «${d.record.condicion === 'Vendida' ? 'Máquinas vendidas' : 'Máquinas en stock'}».`);
        const dest = d.record.condicion === 'Vendida' ? 'vendidas' : 'stock';
        if (dest !== tab.id) location.hash = `${ctx.base}/${dest}`; else render();
      } catch (err) {
        saving = false; btn.disabled = false; btn.innerHTML = `${ICON.ok}<span>${editing ? 'Guardar cambios' : 'Guardar máquina'}</span>`;
        form.querySelectorAll('input').forEach(i => { i.readOnly = false; });
        if (err.code === 'VALIDATION' || err.code === 'DUPLICATE') {
          setErrors((err.data && err.data.fields) || {});
          msg.innerHTML = alertBox('err', 'El servidor rechazó los datos', `<p>${esc(err.message)}</p>`);
        } else if (err.code === 'VERSION_CONFLICT') {
          const cur = err.data && err.data.current;
          if (cur) upsert(cur);
          msg.innerHTML = alertBox('warn', 'Otro usuario modificó esta máquina mientras la editabas',
            cur ? `<p>Versión actual ${esc(cur.version)} · modificada ${esc(fmtDate(cur.modificado))}${cur.modificado_por ? ' por ' + esc(cur.modificado_por) : ''}.</p>
              <p class="muted" style="margin-top:4px">Actual: ${esc(cur.codificacion)} · ${esc(cur.categoria)} · ${esc(cur.escalera)} · ${esc(cur.serial || 'sin serial')} · ${esc(cur.condicion)}</p>` : `<p>${esc(err.message)}</p>`,
            `<button type="button" class="btn btn-sm" data-act="reload-form">Descartar mis cambios y ver los actuales</button>
             ${cur ? `<button type="button" class="btn btn-sm btn-danger" data-act="overwrite" data-v="${esc(cur.version)}">Guardar mis cambios de todos modos</button>` : ''}`);
          render();
        } else if (err.code === 'AUTH_REQUIRED' || err.code === 'FORBIDDEN') {
          msg.innerHTML = alertBox('err', 'No tienes permiso para guardar', `<p>${esc(err.message)}</p>`, `<button type="button" class="btn btn-sm" data-act="login">${ICON.lock}Iniciar sesión</button>`);
        } else {
          msg.innerHTML = alertBox('err', 'No se pudo guardar', `<p>${esc(err.message)}</p><p class="muted" style="margin-top:4px">Tus datos siguen en el formulario. Puedes reintentar sin riesgo de duplicar el registro.</p>`);
        }
        msg.scrollIntoView({ block: 'nearest' });
      }
    }

    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'overwrite') { baseVersion = Number(b.dataset.v); submit(baseVersion); }
      if (b.dataset.act === 'reload-form') { dirty = false; m.close('force'); const cur = S.records.find(x => x.id === record.id); if (cur) openForm({ record: cur }); }
      if (b.dataset.act === 'login') ctx.openLogin('Inicia sesión con una cuenta de editor para guardar.');
    });
  }

  /* ── Eventos ── */
  root.addEventListener('click', async e => {
    const open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); openDetail(open.dataset.open); return; }
    const refBtn = e.target.closest('[data-ref]');
    if (refBtn) {
      const r = (S.ref || REFERENCE_ROWS)[Number(refBtn.dataset.ref)];
      const original = { categoria: r.categoria, codificacion: r.codificacion, escalera: r.escalera };
      if (r.serial) original.serial = r.serial;
      openForm({ prefill: {
        codificacion: trimSpaces(r.codificacion), categoria: normalizeCategoria(r.categoria), serial: trimSpaces(r.serial),
        escalera: normalizeLado(r.escalera), condicion: '', imagen_url: '',
        origen: `Hoja 1!${r.celdas}`, valor_original: JSON.stringify(original)
      } });
      return;
    }
    const b = e.target.closest('[data-act]');
    if (b && root.contains(b) && !b.closest('.modal')) {
      const act = b.dataset.act;
      if (act === 'reload') {
        const jobs = [loadRecords(true)];
        if (tab.id === 'referencia') jobs.push(loadReference());
        render();
        await Promise.all(jobs);
        if (alive) render();
      }
      if (act === 'add') openForm();
      if (act === 'login') ctx.openLogin('Agregar y editar máquinas requiere una cuenta de editor.');
      if (act === 'clear') { Object.assign(S.filters[tab.id], { q: '', cat: '', lado: '', warn: false }); $('[data-body]').innerHTML = ''; render(); }
      if (act === 'init') initTable(b);
      if (act === 'copy-headers' || act === 'copy-ref') {
        if (act === 'copy-ref' && !S.ref) await loadReference();
        const text = act === 'copy-ref' ? referenceAsTsv() : SIMPLE_HEADERS.join('\t');
        try { await navigator.clipboard.writeText(text); toast(`Copiado. Pégalo en la celda A1 de la pestaña ${TAB_APP}.`); }
        catch { toast('No se pudo copiar automáticamente. Inténtalo de nuevo o copia los encabezados a mano.', 'err'); }
      }
      return;
    }
    const row = e.target.closest('.row');
    if (row && row.dataset.id) openDetail(row.dataset.id);
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr.row')) openDetail(e.target.dataset.id); });

  async function initTable(b) {
    const ok = await confirmDialog({ title: `Inicializar ${TAB_APP}`, confirm: 'Crear pestaña',
      body: `<p>Se creará en la hoja de Google Sheets una pestaña nueva llamada <b class="mono">${TAB_APP}</b> con estos encabezados:</p>
        <p class="mono muted" style="font-size:12px;margin-top:8px">${COLUMNS.join(' · ')}</p>
        <p style="margin-top:8px">No se modifica «Hoja 1», no se reorganizan sus bloques y no se copia ningún registro.</p>` });
    if (!ok) return;
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>Creando…';
    try { await api('/api/machines', { method: 'POST', body: { action: 'init' } }); toast(`Pestaña ${TAB_APP} creada.`); await loadRecords(true); }
    catch (err) { toast(err.message, 'err', 7000); }
    if (alive) render();
  }

  const offAuth = ctx.onAuthChange(() => { if (!alive) return; if (S.status === 'error' && S.error && S.error.code === 'AUTH_REQUIRED') loadRecords(true).then(() => alive && render()); render(); });

  render();
  loadRecords().then(() => alive && render());
  if (tab.id === 'referencia' && !S.ref) loadReference().then(() => alive && render());
  else if (tab.id === 'referencia') render();

  return () => { alive = false; offAuth(); };
}
