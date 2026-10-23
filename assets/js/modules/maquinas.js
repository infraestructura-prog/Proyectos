/* Infraestructura › Máquinas de simulación.
   Lee las máquinas de la hoja pública de Google Sheets (pestaña «Hoja 5»), igual que Nodos.
   Las máquinas se venden en parejas: la letra inicial del código las une (A - CC - DER + A - SC - IZQ).
   Editar y agregar desde la página usa el Apps Script instalado en la hoja (config EDIT_URL) y una
   clave de edición que solo se guarda en memoria mientras la página está abierta. */
import { esc, ICON, store, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';
import { MAQUINAS as CFG } from '../config.js';
import {
  CATEGORIAS, LADOS, CONDICIONES, validateMachine, findDuplicates, consistencyWarnings,
  normalizeCategoria, normalizeLado, trimSpaces, codeKey
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
  records: [], status: 'idle', error: null, fetchedAt: null, loadedAt: 0, tab: '', unclassified: [],
  ref: null, refSource: null, refError: null,
  view: store.get('maq-view') === 'table' ? 'table' : 'grid',
  filters: { vendidas: { q: '', warn: false }, stock: { q: '', warn: false }, referencia: { q: '', bloque: '' } }
};
let editKey = ''; // clave de edición: solo en memoria, se pierde al recargar

const canEdit = () => !!CFG.EDIT_URL;
const small = icon => icon.replace('<svg', '<svg width="16" height="16"');
const condChip = c => c === 'Vendida' ? `<span class="chip chip-todo"><span class="dot"></span>Vendida</span>`
  : c === 'En stock' ? `<span class="chip chip-ok"><span class="dot"></span>En stock</span>`
  : c === 'Mixta' ? `<span class="chip chip-warn">Condición distinta</span>`
  : `<span class="chip chip-other">Sin condición</span>`;
const none = (t = '—') => `<span class="none">${t}</span>`;

/* Enlaces de Google Drive «/file/d/ID/view» no se muestran como imagen; se usa su miniatura pública. */
function imgSrc(url) {
  if (!url) return '';
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url;
}
const imgTag = (url, alt, cls = '') => `<img src="${esc(imgSrc(url))}" alt="${esc(alt)}" class="${cls}" loading="lazy" referrerpolicy="no-referrer"
  onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'No se pudo cargar la imagen'}))">`;

/* ═════════ Lectura de la hoja ═════════ */
const HEADER_ALIASES = {
  codificacion: ['codificacion', 'codigo'],
  categoria: ['categoria'],
  serial: ['serial'],
  escalera: ['escalera', 'lado de la escalera', 'lado escalera', 'lado'],
  condicion: ['condicion', 'condicion comercial', 'estado'],
  imagen: ['imagen', 'imagen_url', 'imagen url', 'foto']
};
const headerKey = h => String(h || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const normalizeCondicion = v => {
  const s = headerKey(v);
  if (/^(en )?stock$|^disponible$/.test(s)) return 'En stock';
  if (/^vendid[ao]$/.test(s)) return 'Vendida';
  return '';
};
const noSerial = s => (/^[-–—]*$/.test(trimSpaces(s)) ? '' : trimSpaces(s));

/* Letra de la pareja: lo que va antes del primer guion del código (A - CC - DER → A). */
export function pairLetter(code) {
  const k = codeKey(code);
  const m = k.match(/^([A-Z0-9]+)-/);
  return m ? m[1] : k.charAt(0) || '?';
}

/* Convierte una fila (valores tal como están en la hoja) en el registro que usa la página. */
function toRecord(raw) {
  const cat = normalizeCategoria(raw.categoria), lado = normalizeLado(raw.escalera);
  return {
    id: `FILA-${raw.fila}`, fila: raw.fila, raw: { ...raw },
    codificacion: trimSpaces(raw.codificacion), categoria: cat || trimSpaces(raw.categoria),
    serial: noSerial(raw.serial), escalera: lado || trimSpaces(raw.escalera),
    condicion: normalizeCondicion(raw.condicion), imagen_url: trimSpaces(raw.imagen),
    letra: pairLetter(raw.codificacion)
  };
}

async function readRecords() {
  // Se prueba cada pestaña configurada. Si una no existe, Google devuelve la primera (Hoja 1);
  // por eso solo se acepta la que tenga las columnas Codificación y Condición.
  for (const tab of CFG.MACHINES_TABS) {
    const rows = await readPublicSheet(CFG.SPREADSHEET_ID, { tab });
    const header = (rows[0] || []).map(headerKey), col = {};
    for (const [field, names] of Object.entries(HEADER_ALIASES)) {
      const i = header.findIndex(h => names.includes(h));
      if (i >= 0) col[field] = i;
    }
    if (col.codificacion === undefined || col.condicion === undefined) continue;
    const out = [];
    rows.slice(1).forEach((row, i) => {
      const raw = { fila: i + 2 };
      Object.keys(HEADER_ALIASES).forEach(f => { raw[f] = col[f] === undefined ? '' : String(row[col[f]] ?? ''); });
      if (trimSpaces(raw.codificacion)) out.push(toRecord(raw));
    });
    return { tab, records: out };
  }
  throw Object.assign(new Error(`No se encontró una pestaña de máquinas (${CFG.MACHINES_TABS.join(', ')}) con las columnas Codificación y Condición.`), { code: 'TABLE_MISSING' });
}

let inflight = null;
async function loadRecords(force = false) {
  if (inflight) return inflight;
  // Reutiliza los datos si se leyeron hace menos de 60 s (al cambiar de subventana).
  if (!force && S.status === 'ready' && Date.now() - S.loadedAt < 60000) return;
  S.status = 'loading'; S.error = null;
  inflight = readRecords().then(({ tab, records }) => {
    Object.assign(S, { tab, records, status: 'ready', fetchedAt: new Date().toISOString(), loadedAt: Date.now() });
    S.unclassified = records.filter(r => !r.condicion);
  }).catch(e => { S.status = 'error'; S.error = e; }).finally(() => { inflight = null; });
  return inflight;
}

async function loadReference() {
  try {
    const values = await readPublicSheet(CFG.SPREADSHEET_ID, { tab: CFG.SOURCE_TAB, range: 'A2:J' });
    const head = (values[0] || []).map(v => String(v).trim().toUpperCase());
    if (!head.includes('SERIAL')) throw new Error(`La pestaña «${CFG.SOURCE_TAB}» no tiene los encabezados esperados.`);
    S.ref = referenceFromValues(values); S.refSource = { kind: 'live', at: new Date().toISOString() }; S.refError = null;
  } catch (e) {
    S.ref = REFERENCE_ROWS; S.refSource = { kind: 'snapshot', at: SNAPSHOT_DATE }; S.refError = e;
  }
}

/* ═════════ Parejas ═════════ */
function buildPairs(records) {
  const map = new Map();
  records.forEach(r => {
    if (!map.has(r.letra)) map.set(r.letra, { letra: r.letra, cc: null, sc: null, extra: [] });
    const p = map.get(r.letra);
    if (r.categoria === 'Con chapa' && !p.cc) p.cc = r;
    else if (r.categoria === 'Sin chapa' && !p.sc) p.sc = r;
    else p.extra.push(r);
  });
  return [...map.values()].sort((a, b) => a.letra.localeCompare(b.letra, 'es', { numeric: true }));
}
const membersOf = p => [p.cc, p.sc, ...p.extra].filter(Boolean);
function pairCondition(p) {
  const c = [...new Set(membersOf(p).map(r => r.condicion))];
  return c.length === 1 ? c[0] : 'Mixta';
}
function pairWarnings(p) {
  const w = [];
  if (!p.cc) w.push('Falta la máquina con chapa de esta pareja.');
  if (!p.sc) w.push('Falta la máquina sin chapa de esta pareja.');
  if (p.extra.length) w.push(`Hay ${p.extra.length} máquina(s) más con la letra ${p.letra}: ${p.extra.map(r => r.codificacion).join(', ')}.`);
  if (pairCondition(p) === 'Mixta') w.push('Las máquinas de la pareja no tienen la misma condición (vendida / en stock).');
  membersOf(p).forEach(r => consistencyWarnings(r).forEach(x => w.push(`${r.codificacion}: ${x}`)));
  return w;
}

/* ═════════ Escritura (Apps Script) ═════════ */
async function callScript(payload) {
  let res;
  try { res = await fetch(CFG.EDIT_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' }); }
  catch { throw Object.assign(new Error('No se pudo contactar con el script de edición. Revisa tu conexión.'), { code: 'NETWORK' }); }
  let d;
  try { d = JSON.parse(await res.text()); }
  catch { throw Object.assign(new Error('El script de edición no respondió bien. Revisa que esté implementado como «Aplicación web» con acceso «Cualquier usuario».'), { code: 'SCRIPT_BAD_RESPONSE' }); }
  if (!d.ok) throw Object.assign(new Error(d.error || 'Error del script de edición.'), { code: d.code, data: d });
  return d;
}

const ORIGINAL_FIELDS = ['codificacion', 'categoria', 'serial', 'escalera', 'condicion', 'imagen'];
const originalOf = r => Object.fromEntries(ORIGINAL_FIELDS.map(f => [f, r.raw[f] ?? '']));
const toScript = v => ({ codificacion: v.codificacion, categoria: v.categoria, serial: v.serial, escalera: v.escalera, condicion: v.condicion, imagen: v.imagen_url });
function applyRaw(raw) {
  const rec = toRecord(raw);
  const i = S.records.findIndex(x => x.fila === rec.fila);
  if (i >= 0) S.records[i] = rec; else S.records.push(rec);
  S.unclassified = S.records.filter(r => !r.condicion);
  return rec;
}

/* ═════════ Módulo ═════════ */
export function mount(root, ctx) {
  const tab = TABS.find(t => t.id === ctx.sub[0]);
  if (!tab) { location.replace(ctx.base + '/vendidas'); return null; }
  ctx.setExtraCrumbs([{ title: tab.short }]);
  let alive = true;

  root.innerHTML = `<div class="maquinas">
    <div class="section-head">
      <div><p class="eyebrow">Infraestructura</p><h1>Máquinas de simulación</h1>
        <p>Las máquinas se venden en parejas (con chapa + sin chapa); la letra del código las une.</p></div>
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

  const pairsFor = cond => buildPairs(S.records.filter(r => r.condicion)).filter(p => membersOf(p).some(r => r.condicion === cond));

  function renderTabs() {
    const n = c => S.status === 'ready' ? pairsFor(c).length : '…';
    $('[data-tabs]').innerHTML = TABS.map(t => `<a href="${ctx.base}/${t.id}" ${t.id === tab.id ? 'aria-current="page"' : ''}>${t.short}
      <span class="n" title="${t.condicion ? 'Parejas' : 'Entradas'}">${t.condicion ? n(t.condicion) : (S.ref ? S.ref.length : REFERENCE_ROWS.length)}</span></a>`).join('');
  }

  function renderSource() {
    const el = $('[data-src]'), btn = $('[data-act="reload"]'), loading = S.status === 'loading';
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="spinner"></span><span>Actualizando…</span>' : `${ICON.refresh}<span>Actualizar</span>`;
    if (S.status === 'ready') {
      el.className = 'chip chip-ok';
      el.innerHTML = `<span class="dot pulse"></span><span>Sheets · ${esc(S.tab)}${canEdit() ? '' : ' · solo lectura'}</span>`;
      el.title = 'Última lectura: ' + fmtDate(S.fetchedAt);
    } else if (S.status === 'error') { el.className = 'chip chip-err'; el.innerHTML = `<span class="dot"></span><span>Sin conexión</span>`; el.title = ''; }
    else { el.className = 'chip chip-other'; el.innerHTML = `<span class="dot"></span><span>Cargando…</span>`; }
  }

  function errorState() {
    const e = S.error, retry = `<button class="btn btn-sm" data-act="reload">${ICON.refresh}Reintentar</button>`;
    if (e && e.code === 'NOT_PUBLIC') return alertBox('warn', 'La hoja de máquinas no es pública', `<p>${esc(e.message)}</p>`, retry);
    if (e && e.code === 'TABLE_MISSING') return alertBox('warn', 'No se encontró la pestaña de máquinas',
      `<p>${esc(e.message)}</p><p class="muted" style="margin-top:4px">Si renombraste la pestaña, hay que actualizar el nombre en la configuración de la página.</p>`,
      `${retry}<a class="btn btn-sm" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir la hoja</a>`);
    return alertBox('err', 'No se pudieron leer las máquinas', `<p>${esc(e ? e.message : 'Error desconocido')}</p>`, retry);
  }

  /* ── Vendidas / En stock ── */
  function filteredPairs() {
    const f = S.filters[tab.id], q = f.q.trim().toLowerCase();
    return pairsFor(tab.condicion).filter(p => (!f.warn || pairWarnings(p).length)
      && (!q || membersOf(p).some(r => [r.codificacion, r.serial, r.categoria, r.escalera, `pareja ${p.letra}`].join(' ').toLowerCase().includes(q))));
  }

  function renderListShell() {
    const f = S.filters[tab.id];
    $('[data-body]').innerHTML = `
      <section class="panel toolbar" aria-label="Búsqueda y filtros">
        <div class="search">${ICON.search}<label class="sr-only" for="mq-q">Buscar máquinas</label>
          <input id="mq-q" type="search" placeholder="Buscar por código, letra o serial…" value="${esc(f.q)}"></div>
        <label class="check"><input type="checkbox" id="mq-warn" ${f.warn ? 'checked' : ''}> Solo parejas para revisar</label>
        <span class="spacer"></span>
        <div class="seg" role="group" aria-label="Cambiar vista">
          <button data-view="grid" aria-pressed="${S.view === 'grid'}">${ICON.grid}Tarjetas</button>
          <button data-view="table" aria-pressed="${S.view === 'table'}">${ICON.table}Tabla</button>
        </div>
        <span data-add></span>
      </section>
      <p class="count" data-count aria-live="polite"></p>
      <div data-list></div>`;
    const body = $('[data-body]');
    body.querySelector('#mq-q').addEventListener('input', e => { f.q = e.target.value; renderList(); });
    body.querySelector('#mq-warn').addEventListener('change', e => { f.warn = e.target.checked; renderList(); });
    body.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      S.view = b.dataset.view; store.set('maq-view', S.view);
      body.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === S.view)));
      renderList();
    }));
  }

  function renderAddButton() {
    const el = $('[data-add]'); if (!el) return;
    el.innerHTML = canEdit()
      ? `<button class="btn btn-primary" data-act="add" ${S.status !== 'ready' ? 'disabled' : ''}>${ICON.plus}<span>Agregar máquina</span></button>`
      : `<a class="btn btn-primary" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener" title="La edición desde la página aún no está activada">${ICON.plus}<span>Agregar en Google Sheets</span></a>`;
  }

  function half(r, p, kind) {
    if (!r) {
      const cat = kind === 'cc' ? 'Con chapa' : 'Sin chapa';
      return `<div class="pair-half missing"><span class="thumb"><span class="ph">${ICON.image}Falta ${cat.toLowerCase()}</span></span>
        <p class="dim" style="font-size:13px">No hay máquina «${cat}» con la letra ${esc(p.letra)}.</p>
        ${canEdit() ? `<button class="btn btn-sm" data-act="add-half" data-letra="${esc(p.letra)}" data-cat="${cat}">${ICON.plus}Agregar</button>` : ''}</div>`;
    }
    const w = consistencyWarnings(r);
    return `<button type="button" class="pair-half" data-fila="${r.fila}" aria-label="Ver ficha de ${esc(r.codificacion)}">
      <span class="thumb">${r.imagen_url ? imgTag(r.imagen_url, 'Imagen de ' + r.codificacion) : `<span class="ph">${ICON.image}Sin imagen</span>`}</span>
      <span class="half-head"><span class="cell-id">${esc(r.codificacion)}</span>${w.length ? `<span class="chip chip-warn" title="${esc(w.join(' '))}">${small(ICON.warn)}</span>` : ''}</span>
      <dl class="kv"><dt>Categoría</dt><dd>${esc(r.categoria)}</dd><dt>Escalera</dt><dd>${esc(r.escalera)}</dd>
        <dt>Serial</dt><dd class="mono">${r.serial ? esc(r.serial) : none('Sin serial')}</dd>
        ${pairCondition(p) === 'Mixta' ? `<dt>Condición</dt><dd>${esc(r.condicion)}</dd>` : ''}</dl>
    </button>`;
  }

  function pairCard(p) {
    const cond = pairCondition(p), w = pairWarnings(p);
    const sellable = canEdit() && membersOf(p).some(r => r.condicion === 'En stock');
    return `<article class="pair-card ${cond === 'Vendida' ? 'sold' : ''}" aria-label="Pareja ${esc(p.letra)}">
      <header class="pair-head">
        <span class="pair-letter" aria-hidden="true">${esc(p.letra)}</span>
        <span class="pair-title"><b>Pareja ${esc(p.letra)}</b><span class="dim">${membersOf(p).length} ${membersOf(p).length === 1 ? 'máquina' : 'máquinas'}</span></span>
        ${condChip(cond)}
      </header>
      <div class="pair-body">${half(p.cc, p, 'cc')}${half(p.sc, p, 'sc')}</div>
      ${p.extra.length ? `<div class="pair-extra">${p.extra.map(r => `<button type="button" class="btn btn-sm" data-fila="${r.fila}">${esc(r.codificacion)}</button>`).join('')}</div>` : ''}
      ${w.length || sellable ? `<footer class="pair-foot">
        ${w.length ? `<span class="chip chip-warn" title="${esc(w.join('\n'))}">${small(ICON.warn)}${w.length} ${w.length === 1 ? 'aviso' : 'avisos'}</span>` : '<span></span>'}
        ${sellable ? `<button class="btn btn-sm btn-mint" data-act="sell-pair" data-letra="${esc(p.letra)}">${ICON.tag}Marcar pareja como vendida</button>` : ''}
      </footer>` : ''}
    </article>`;
  }

  function renderList() {
    const list = $('[data-list]'), count = $('[data-count]');
    if (!list) return;
    if (S.status === 'loading' || S.status === 'idle') {
      count.textContent = '';
      list.innerHTML = `<div class="pair-grid" aria-label="Cargando máquinas">${'<div class="skeleton" style="height:300px"></div>'.repeat(2)}</div>`;
      return;
    }
    if (S.status === 'error') { count.textContent = ''; list.innerHTML = errorState(); return; }
    const all = pairsFor(tab.condicion), pairs = filteredPairs();
    const machines = pairs.reduce((s, p) => s + membersOf(p).length, 0);
    count.textContent = `Mostrando ${pairs.length} de ${all.length} parejas · ${machines} máquinas`;
    if (!all.length) {
      list.innerHTML = `<div class="state"><h3>Todavía no hay ${tab.id === 'vendidas' ? 'máquinas vendidas' : 'máquinas en stock'}</h3>
        <p>Cambia la condición de una máquina a «${tab.condicion}» ${canEdit() ? 'desde su ficha o ' : ''}en la columna Condición de la hoja.</p></div>`;
      return;
    }
    if (!pairs.length) {
      list.innerHTML = `<div class="state"><h3>Sin resultados</h3><p>Ninguna pareja coincide con la búsqueda o el filtro.</p>
        <div class="alert-actions"><button class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`;
      return;
    }
    if (S.view === 'table') {
      list.innerHTML = `<div class="panel table-wrap fade-in"><table class="data pair-table">
        <thead><tr><th scope="col">Pareja</th><th scope="col">Codificación</th><th scope="col">Categoría</th><th scope="col">Escalera</th>
          <th scope="col">Serial</th><th scope="col">Imagen</th><th scope="col">Condición</th><th scope="col">Avisos</th></tr></thead>
        <tbody>${pairs.map(p => { const ms = membersOf(p), w = pairWarnings(p); return ms.map((r, i) => `<tr class="row ${i === 0 ? 'pair-first' : ''}" tabindex="0" data-fila="${r.fila}" aria-label="Ver ficha de ${esc(r.codificacion)}">
          ${i === 0 ? `<th scope="rowgroup" rowspan="${ms.length}" class="pair-cell"><span class="pair-letter sm">${esc(p.letra)}</span></th>` : ''}
          <td class="cell-id">${esc(r.codificacion)}</td><td>${esc(r.categoria)}</td><td>${esc(r.escalera)}</td>
          <td class="mono">${r.serial ? esc(r.serial) : none('Sin serial')}</td>
          <td>${r.imagen_url ? '<span class="chip chip-ok">Sí</span>' : none('No')}</td>
          <td>${condChip(r.condicion)}</td>
          ${i === 0 ? `<td rowspan="${ms.length}">${w.length ? `<span class="chip chip-warn" title="${esc(w.join('\n'))}">${small(ICON.warn)}${w.length}</span>` : none()}</td>` : ''}
        </tr>`).join(''); }).join('')}</tbody></table></div>`;
    } else {
      list.innerHTML = `<div class="pair-grid fade-in">${pairs.map(pairCard).join('')}</div>`;
    }
  }

  /* ── Referencia (Hoja 1, solo lectura) ── */
  function renderReference() {
    const f = S.filters.referencia, rows = S.ref || REFERENCE_ROWS, src = S.refSource;
    const registered = new Map(S.records.map(r => [codeKey(r.codificacion), r]));
    const q = f.q.trim().toLowerCase();
    const list = rows.filter(r => (!f.bloque || r.bloque === f.bloque) && (!q || [r.codificacion, r.serial, r.categoria, r.escalera].join(' ').toLowerCase().includes(q)));
    const srcNote = !src ? 'Cargando…' : src.kind === 'live' ? `Leída en vivo desde «${esc(CFG.SOURCE_TAB)}» · ${esc(fmtDate(src.at))}`
      : `Copia incluida en la aplicación (leída el ${esc(src.at)}). No se pudo leer en vivo: ${esc(S.refError ? S.refError.message : '')}`;
    $('[data-body]').innerHTML = `
      <div style="margin-bottom:16px">${alertBox('info', `Referencia original · ${esc(CFG.SOURCE_TAB)}`,
        `<p>La tabla original de codificación, con el bloque «Con Chapa» (con serial e imágenes incrustadas) y el bloque «Sin Chapa». Solo consulta: las máquinas de la página se leen de «${esc(S.tab || CFG.MACHINES_TABS[0])}».</p>
         <p class="muted" style="margin-top:6px">${srcNote} · <a href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir hoja</a></p>`)}</div>
      <section class="panel toolbar" aria-label="Filtros de referencia">
        <div class="search">${ICON.search}<label class="sr-only" for="rf-q">Buscar en la referencia</label>
          <input id="rf-q" type="search" placeholder="Buscar codificación o serial…" value="${esc(f.q)}"></div>
        <label class="sr-only" for="rf-b">Bloque</label>
        <select id="rf-b" class="select"><option value="">Bloque: ambos</option>
          <option ${f.bloque === 'Izquierdo' ? 'selected' : ''} value="Izquierdo">Con Chapa (C:F)</option>
          <option ${f.bloque === 'Derecho' ? 'selected' : ''} value="Derecho">Sin Chapa (H:J)</option></select>
      </section>
      <p class="count">Mostrando ${list.length} de ${rows.length} entradas</p>
      ${list.length ? `<div class="panel table-wrap"><table class="data">
        <thead><tr><th scope="col">Origen</th><th scope="col">Codificación</th><th scope="col">Categoría</th><th scope="col">Serial</th>
          <th scope="col">Escalera</th><th scope="col">En la página</th></tr></thead>
        <tbody>${list.map(r => { const reg = registered.get(codeKey(r.codificacion)); return `<tr>
          <td class="mono" style="white-space:nowrap;font-size:13px">${esc(CFG.SOURCE_TAB)}!${esc(r.celdas)}</td>
          <td class="cell-id">${esc(trimSpaces(r.codificacion))}</td><td>${esc(normalizeCategoria(r.categoria) || r.categoria)}</td>
          <td class="mono">${r.serial ? esc(r.serial) : none('Sin serial')}</td><td>${esc(normalizeLado(r.escalera) || r.escalera)}</td>
          <td>${reg ? `<button type="button" class="btn btn-sm btn-ghost" data-fila="${reg.fila}">${condChip(reg.condicion)}</button>` : none('No está en ' + esc(S.tab || CFG.MACHINES_TABS[0]))}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="state"><h3>Sin resultados</h3><p>Ninguna entrada coincide con la búsqueda.</p></div>`}`;
    const body = $('[data-body]');
    body.querySelector('#rf-q').addEventListener('input', e => { f.q = e.target.value; const pos = e.target.selectionStart; renderReference(); const n = $('#rf-q'); n.focus(); n.setSelectionRange(pos, pos); });
    body.querySelector('#rf-b').addEventListener('change', e => { f.bloque = e.target.value; renderReference(); $('#rf-b').focus(); });
  }

  function render() {
    renderTabs(); renderSource();
    const pend = S.status === 'ready' ? S.unclassified : [];
    $('[data-banner]').innerHTML = pend.length ? `<div style="margin-bottom:16px">${alertBox('warn', `${pend.length} ${pend.length === 1 ? 'máquina sin condición' : 'máquinas sin condición'} en ${esc(S.tab)}`,
      `<p>No aparecen en Vendidas ni En stock hasta que su condición sea «En stock» o «Vendida»: ${pend.slice(0, 8).map(p => `<button type="button" class="btn btn-sm btn-ghost mono" data-fila="${p.fila}">${esc(p.codificacion)}</button>`).join(' ')}${pend.length > 8 ? '…' : ''}</p>`)}</div>` : '';
    if (tab.id === 'referencia') renderReference();
    else { if (!$('[data-list]')) renderListShell(); renderAddButton(); renderList(); }
  }

  /* ── Ficha de una máquina ── */
  function openDetail(fila) {
    const r = S.records.find(x => x.fila === Number(fila)); if (!r) return;
    const p = buildPairs(S.records).find(x => x.letra === r.letra);
    const partner = p && membersOf(p).find(x => x.fila !== r.fila);
    const w = consistencyWarnings(r);
    const f = (k, v) => `<div class="f"><p class="k">${k}</p><p class="v">${v}</p></div>`;
    const m = openModal({ html: `
      <div class="modal-head"><div><p class="kicker">Pareja ${esc(r.letra)} · ${esc(r.categoria)}</p>
        <h2 data-modal-title class="mono accent" style="font-size:24px">${esc(r.codificacion)}</h2>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${condChip(r.condicion)}${w.length ? `<span class="chip chip-warn">${small(ICON.warn)}Revisar</span>` : ''}</div></div>
        <button class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        ${w.length ? `<div style="margin-bottom:16px">${alertBox('warn', 'Para revisar', `<ul style="margin:4px 0 0;padding-left:18px">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`)}</div>` : ''}
        <section class="sec"><h3 class="sec-title">${ICON.image}Imagen</h3>
          ${r.imagen_url ? `<a href="${esc(r.imagen_url)}" target="_blank" rel="noopener">${imgTag(r.imagen_url, 'Imagen de ' + r.codificacion, 'detail-img')}</a>` : `<p class="none">Sin imagen. ${canEdit() ? 'Pulsa «Editar» para agregar el enlace.' : ''}</p>`}</section>
        <section class="sec"><h3 class="sec-title">${ICON.chip}Características</h3><div class="detail-grid">
          ${f('Codificación', `<span class="mono">${esc(r.codificacion)}</span>`)}${f('Categoría', esc(r.categoria))}
          ${f('Lado de la escalera', esc(r.escalera))}${f('Serial', r.serial ? `<span class="mono">${esc(r.serial)}</span>` : none('Sin serial'))}
          ${f('Condición', esc(r.condicion || 'Sin condición'))}
          ${f('Pareja', partner ? `<button type="button" class="btn btn-sm" data-partner="${partner.fila}">${esc(partner.codificacion)}</button>` : none('Sin pareja registrada'))}
        </div></section>
        <p class="count" style="margin-top:16px">Origen: ${esc(S.tab)}, fila ${r.fila}</p>
      </div>
      <div class="modal-foot">
        <a class="btn" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir en Google Sheets</a>
        ${canEdit() ? `<button class="btn btn-primary" data-act="edit">${ICON.edit}Editar</button>` : `<button class="btn btn-primary" data-act="enable">${ICON.edit}Editar</button>`}
      </div>` });
    m.el.addEventListener('click', e => {
      const pb = e.target.closest('[data-partner]');
      if (pb) { m.close('force'); openDetail(pb.dataset.partner); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'edit') { m.close('force'); openForm({ record: r }); }
      if (b.dataset.act === 'enable') { m.close('force'); openEnableInfo(); }
    });
  }

  /* Explica cómo activar la edición cuando aún no hay script configurado. */
  function openEnableInfo() {
    openModal({ size: 'sm', html: `
      <div class="modal-head"><div><p class="kicker">Edición desde la página</p><h2 data-modal-title>Activar la edición</h2></div>
        <button class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        <p>Google solo permite modificar la hoja con permiso de su dueño. Se hace una vez, con un pequeño script en tu cuenta de Google:</p>
        <ol style="margin:10px 0 0;padding-left:20px;display:grid;gap:6px">
          <li>Entra en <b>script.google.com</b> con la cuenta que edita la hoja y crea un <b>Nuevo proyecto</b>.</li>
          <li>Pega el código (botón de abajo) y escribe tu clave de edición en la primera línea. Guarda.</li>
          <li><b>Implementar → Nueva implementación → Aplicación web</b>, con «Ejecutar como: Yo» y «Cualquier usuario». Autoriza.</li>
          <li>Envía la URL que termina en <span class="mono">/exec</span> para conectarla a la página.</li>
        </ol>
        <p class="muted" style="margin-top:10px">Mientras tanto puedes editar directamente en Google Sheets; la página lo refleja al pulsar «Actualizar».</p>
      </div>
      <div class="modal-foot"><button class="btn" data-copy-script>Copiar código del script</button><button class="btn btn-primary" data-close>Entendido</button></div>` })
      .el.querySelector('[data-copy-script]').addEventListener('click', async () => {
        try { const code = await (await fetch('/apps-script/Code.gs', { cache: 'no-store' })).text(); await navigator.clipboard.writeText(code); toast('Código copiado. Pégalo en Apps Script.'); }
        catch { toast('No se pudo copiar. Abre apps-script/Code.gs en GitHub y cópialo desde allí.', 'err', 7000); }
      });
  }

  /* Campo de clave de edición (solo se pide la primera vez que se guarda en esta visita). */
  const keyField = () => editKey ? '' : `<div class="field full" data-f="clave"><label for="mf-key">Clave de edición <span class="req">*</span></label>
    <input id="mf-key" name="clave" type="password" class="input" autocomplete="off" aria-describedby="mf-key-h mf-key-e">
    <p class="hint" id="mf-key-h">La que se escribió en el Apps Script de la hoja. Se recuerda solo mientras esta página esté abierta.</p><p class="err" id="mf-key-e"></p></div>`;

  /* ── Formulario (editar / agregar) ── */
  function openForm({ record = null, prefill = null } = {}) {
    const editing = !!record;
    const v = record ? { codificacion: record.codificacion, categoria: record.categoria, serial: record.serial, escalera: record.escalera, condicion: record.condicion, imagen_url: record.imagen_url }
      : { codificacion: '', categoria: '', serial: '', escalera: '', condicion: tab.condicion || '', imagen_url: '', ...(prefill || {}) };
    let saving = false, dirty = false, original = record ? originalOf(record) : null;
    const radios = (name, opts, cur) => `<div class="radios" role="radiogroup">${opts.map((o, i) => `<label class="radio"><input type="radio" name="${name}" value="${o}" ${o === cur ? 'checked' : ''} id="mf-${name}-${i}"><span>${o}</span></label>`).join('')}</div>`;
    const m = openModal({ html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${editing ? `Pareja ${esc(record.letra)} · fila ${record.fila}` : 'Nueva máquina'}</p>
        <h2 data-modal-title>${editing ? `Editar ${esc(record.codificacion)}` : 'Agregar máquina'}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        <div data-form-msg></div>
        <div class="form-grid">
          <div class="field" data-f="codificacion"><label for="mf-cod">Codificación <span class="req">*</span></label>
            <input id="mf-cod" name="codificacion" class="input mono" value="${esc(v.codificacion)}" maxlength="40" autocomplete="off" aria-describedby="mf-cod-h mf-cod-e" placeholder="Ej. A - CC - DER">
            <p class="hint" id="mf-cod-h">La letra inicial define la pareja (A - CC… con A - SC…).</p><p class="err" id="mf-cod-e"></p></div>
          <div class="field" data-f="serial"><label for="mf-ser">Serial</label>
            <input id="mf-ser" name="serial" class="input mono" value="${esc(v.serial)}" maxlength="40" autocomplete="off" aria-describedby="mf-ser-e" placeholder="Opcional">
            <p class="err" id="mf-ser-e"></p></div>
          <fieldset class="field" data-f="categoria"><legend>Categoría <span class="req">*</span></legend>${radios('categoria', CATEGORIAS, v.categoria)}<p class="err"></p></fieldset>
          <fieldset class="field" data-f="escalera"><legend>Lado de la escalera <span class="req">*</span></legend>${radios('escalera', LADOS, v.escalera)}<p class="err"></p></fieldset>
          <fieldset class="field full" data-f="condicion"><legend>Condición <span class="req">*</span></legend>${radios('condicion', CONDICIONES, v.condicion)}<p class="err"></p></fieldset>
          <div class="field full" data-f="imagen_url"><label for="mf-img">Imagen (enlace)</label>
            <input id="mf-img" name="imagen_url" type="url" class="input" value="${esc(v.imagen_url)}" placeholder="https://…" aria-describedby="mf-img-h mf-img-e">
            <p class="hint" id="mf-img-h">Enlace https a la foto. De Google Drive sirve el enlace de compartir con acceso «Cualquier persona con el enlace».</p>
            <p class="err" id="mf-img-e"></p><img class="img-preview" alt="Vista previa de la imagen" referrerpolicy="no-referrer"></div>
          <div class="full" data-warn aria-live="polite"></div>
          ${keyField()}
        </div>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary" data-submit>${ICON.ok}<span>${editing ? 'Guardar cambios' : 'Guardar máquina'}</span></button></div>
    </form>`, initialFocus: '#mf-cod' });

    const form = m.el.querySelector('form'), msg = m.el.querySelector('[data-form-msg]'), btn = m.el.querySelector('[data-submit]');
    const label = editing ? 'Guardar cambios' : 'Guardar máquina';
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
        `<ul style="margin:4px 0 0;padding-left:18px">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted" style="margin-top:6px">Puedes guardar igualmente.</p>`) : '';
      const img = m.el.querySelector('.img-preview'), u = trimSpaces(form.imagen_url.value);
      if (/^https:\/\//.test(u)) { img.src = imgSrc(u); img.style.display = 'block'; img.onerror = () => { img.style.display = 'none'; }; } else img.style.display = 'none';
    };
    form.addEventListener('input', () => { dirty = true; updateWarnings(); });
    updateWarnings();
    m.setCanClose(() => saving ? false : (!dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')));

    async function submit() {
      if (saving) return; // evita doble envío
      msg.innerHTML = '';
      const { value, errors } = validateMachine(read());
      const dup = findDuplicates(S.records, value, record && record.id);
      const errs = { ...errors, ...Object.fromEntries(Object.entries(dup).filter(([k]) => !errors[k])) };
      const clave = editKey || (form.clave ? form.clave.value : '');
      if (!clave) errs.clave = 'Escribe la clave de edición.';
      setErrors(errs);
      if (Object.keys(errs).length) { msg.innerHTML = alertBox('err', 'Revisa los campos marcados', '<p>Corrige los errores para poder guardar.</p>'); return; }

      saving = true; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Guardando…</span>';
      form.querySelectorAll('input').forEach(i => { i.readOnly = true; });
      try {
        const d = editing
          ? await callScript({ accion: 'editar', clave, cambios: [{ fila: record.fila, original, datos: toScript(value) }] })
          : await callScript({ accion: 'agregar', clave, datos: toScript(value) });
        editKey = clave;
        const rec = applyRaw(editing ? d.registros[0] : d.registro);
        saving = false; dirty = false; m.close('force');
        toast(editing ? `Cambios guardados en ${rec.codificacion} (hoja y página).` : `${rec.codificacion} se agregó a la hoja (fila ${rec.fila}).`);
        const dest = rec.condicion === 'Vendida' ? 'vendidas' : 'stock';
        if (dest !== tab.id) location.hash = `${ctx.base}/${dest}`; else render();
      } catch (err) {
        saving = false; btn.disabled = false; btn.innerHTML = `${ICON.ok}<span>${label}</span>`;
        form.querySelectorAll('input').forEach(i => { i.readOnly = false; });
        if (err.code === 'UNAUTHORIZED') {
          editKey = '';
          if (!form.clave) { m.el.querySelector('.form-grid').insertAdjacentHTML('beforeend', keyField()); }
          setErrors({ clave: err.message });
        } else if (err.code === 'VALIDATION' || err.code === 'DUPLICATE') {
          const map = { imagen: 'imagen_url' };
          setErrors(Object.fromEntries(Object.entries((err.data && err.data.fields) || {}).map(([k, x]) => [map[k] || k, x])));
          msg.innerHTML = alertBox('err', 'La hoja rechazó los datos', `<p>${esc(err.message)}</p>`);
        } else if (err.code === 'CONFLICT') {
          const cur = err.data && err.data.actual;
          msg.innerHTML = alertBox('warn', 'Esta máquina cambió en la hoja mientras la editabas',
            cur ? `<p class="mono" style="font-size:13px">Ahora en la hoja: ${esc(cur.codificacion)} · ${esc(cur.categoria)} · ${esc(cur.escalera)} · ${esc(noSerial(cur.serial) || 'sin serial')} · ${esc(cur.condicion)}</p>` : `<p>${esc(err.message)}</p>`,
            `<button type="button" class="btn btn-sm" data-act="reload-form">Descartar mis cambios y ver lo actual</button>
             ${cur ? `<button type="button" class="btn btn-sm btn-danger" data-act="overwrite">Guardar mis cambios de todos modos</button>` : ''}`);
          if (cur) m.el.dataset.current = JSON.stringify(cur);
        } else {
          msg.innerHTML = alertBox('err', 'No se pudo guardar', `<p>${esc(err.message)}</p><p class="muted" style="margin-top:4px">Tus datos siguen en el formulario.</p>`);
        }
        msg.scrollIntoView({ block: 'nearest' });
      }
    }

    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const cur = m.el.dataset.current ? JSON.parse(m.el.dataset.current) : null;
      if (b.dataset.act === 'overwrite' && cur) { original = Object.fromEntries(ORIGINAL_FIELDS.map(f => [f, cur[f] ?? ''])); record.fila = cur.fila; submit(); }
      if (b.dataset.act === 'reload-form' && cur) { dirty = false; m.close('force'); openForm({ record: applyRaw(cur) }); render(); }
    });
  }

  /* ── Vender una pareja completa (ambas filas en una sola operación) ── */
  async function sellPair(letra, b) {
    const p = buildPairs(S.records).find(x => x.letra === letra); if (!p) return;
    const targets = membersOf(p).filter(r => r.condicion !== 'Vendida');
    const ok = await confirmDialog({ title: `Vender pareja ${esc(letra)}`, confirm: 'Marcar como vendida',
      body: `<p>Se cambiará a «Vendida» en la hoja: ${targets.map(r => `<b class="mono">${esc(r.codificacion)}</b>`).join(' y ')}.</p>
        ${!p.cc || !p.sc ? `<p class="muted" style="margin-top:6px">Atención: esta pareja está incompleta.</p>` : ''}
        ${editKey ? '' : `<div class="field" style="margin-top:12px"><label for="sp-key">Clave de edición</label><input id="sp-key" type="password" class="input" autocomplete="off"></div>`}` });
    if (!ok) return;
    const clave = editKey || lastKeyInput;
    if (!clave) { toast('Escribe la clave de edición para guardar.', 'err'); return; }
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>Guardando…';
    try {
      const d = await callScript({ accion: 'editar', clave, cambios: targets.map(r => ({ fila: r.fila, original: originalOf(r), datos: { condicion: 'Vendida' } })) });
      editKey = clave;
      d.registros.forEach(applyRaw);
      toast(`Pareja ${letra} marcada como vendida.`);
      location.hash = `${ctx.base}/vendidas`;
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') editKey = '';
      toast(err.code === 'CONFLICT' ? 'La pareja cambió en la hoja. Pulsa «Actualizar» y vuelve a intentarlo.' : err.message, 'err', 7000);
      b.disabled = false; b.innerHTML = `${ICON.tag}Marcar pareja como vendida`;
    }
  }
  // La clave escrita en el diálogo de confirmación se lee antes de que el diálogo se cierre.
  let lastKeyInput = '';
  document.addEventListener('input', onKeyInput, true);
  function onKeyInput(e) { if (e.target && e.target.id === 'sp-key') lastKeyInput = e.target.value; }

  /* ── Eventos ── */
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (b && root.contains(b)) {
      const act = b.dataset.act;
      if (act === 'reload') {
        const jobs = [loadRecords(true)];
        if (tab.id === 'referencia') jobs.push(loadReference());
        render(); await Promise.all(jobs); if (alive) render();
      }
      if (act === 'add') canEdit() ? openForm() : openEnableInfo();
      if (act === 'add-half') openForm({ prefill: { codificacion: `${b.dataset.letra} - ${b.dataset.cat === 'Con chapa' ? 'CC' : 'SC'} - `, categoria: b.dataset.cat } });
      if (act === 'sell-pair') { lastKeyInput = ''; sellPair(b.dataset.letra, b); }
      if (act === 'clear') { Object.assign(S.filters[tab.id], { q: '', warn: false }); $('[data-body]').innerHTML = ''; render(); }
      return;
    }
    const el = e.target.closest('[data-fila]');
    if (el && root.contains(el)) openDetail(el.dataset.fila);
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr.row')) openDetail(e.target.dataset.fila); });

  render();
  loadRecords().then(() => alive && render());
  if (tab.id === 'referencia') (S.ref ? Promise.resolve() : loadReference()).then(() => alive && render());

  return () => { alive = false; document.removeEventListener('input', onKeyInput, true); };
}
