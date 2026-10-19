/* Neotropya › Nodos › Control de órdenes de fabricación.
   Integración del panel original «nodo-dashboard.html». Se conserva su lógica de lectura de Google Sheets
   (CSV + respaldo JSONP de gviz) y el tratamiento de los bloques MALETAS / BOLSOS. Solo lectura. */
import { NODOS as CFG } from '../config.js';
import { esc, ICON, store, openModal, alertBox } from '../ui.js';

/* ═══════════════ DATOS DE DEMOSTRACIÓN (solo con activación explícita) ═══════════════ */
const DEMO_DATA = [
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
const sheetUrl = () => `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/edit`;

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

async function loadData() {
  let rows, errs = [];
  for (const method of [fetchCsvRows, fetchGvizRows]) {
    try { rows = await method(); break; } catch (e) { errs.push(e.message); }
  }
  if (!rows) throw new Error(errs.join(' | '));
  const nodes = rowsToNodes(rows);
  if (!nodes.length) throw new Error('No se encontraron filas con ID válido');
  return nodes;
}

/* ═══════════════ ESTILOS DE ESTADO ═══════════════ */
const norm = s => (s || '').toLowerCase();
const statusKind = s => {
  const v = norm(s);
  if (/desplegad|completad/.test(v)) return 'ok';
  if (/actualiz/.test(v)) return 'upd';
  if (/ejecutar/.test(v)) return 'todo';
  return 'other';
};
const badge = s => `<span class="chip chip-${statusKind(s)}"><span class="dot ${statusKind(s) === 'upd' ? 'pulse' : ''}"></span>${esc(s)}</span>`;
const small = icon => icon.replace('<svg', '<svg width="16" height="16"');

/* ═══════════════ MÓDULO ═══════════════ */
export function mount(root, ctx) {
  // mode: 'live' | 'demo' | 'error' | 'loading'
  const state = { data: [], mode: 'loading', error: '', updated: null, q: '', status: '', dept: '', type: '',
    view: store.get('nodo-view') || 'table', auto: CFG.AUTO_REFRESH_SECONDS > 0, busy: false };
  let timer = null, alive = true;

  root.innerHTML = `<div class="nodos">
    <div class="section-head">
      <div><p class="eyebrow">Proyecto Nodo</p><h1>Control de órdenes de fabricación</h1>
        <p>Maletas y bolsos en desarrollo y desarrollados · solo consulta</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="chip chip-other" data-src><span class="dot"></span><span>Cargando…</span></span>
        ${CFG.AUTO_REFRESH_SECONDS > 0 ? `<button class="btn btn-sm" data-auto aria-pressed="true"></button>` : ''}
        <button class="btn" data-refresh>${ICON.refresh}<span>Actualizar</span></button>
      </div>
    </div>
    <div data-banner></div>
    <section class="kpis" data-kpis aria-label="Resumen"></section>
    <section class="panel toolbar" aria-label="Búsqueda y filtros">
      <div class="search">${ICON.search}<label class="sr-only" for="nd-q">Buscar</label>
        <input id="nd-q" type="search" placeholder="Buscar por ID o componente (ej. Ecoflow, NO-FI…)"></div>
      <label class="sr-only" for="nd-status">Estado</label><select id="nd-status" class="select"></select>
      <label class="sr-only" for="nd-dept">Responsable</label><select id="nd-dept" class="select"></select>
      <label class="sr-only" for="nd-type">Tipo</label><select id="nd-type" class="select"></select>
      <span class="spacer"></span>
      <div class="seg" role="group" aria-label="Cambiar vista">
        <button data-view="table">${ICON.table}Tabla</button><button data-view="grid">${ICON.grid}Tarjetas</button>
      </div>
    </section>
    <p class="count" data-count aria-live="polite"></p>
    <div data-view-root></div>
    <p class="count" style="text-align:center;margin-top:24px" data-foot></p>
  </div>`;

  const $ = s => root.querySelector(s);
  const els = { src: $('[data-src]'), banner: $('[data-banner]'), kpis: $('[data-kpis]'), count: $('[data-count]'), view: $('[data-view-root]'),
    foot: $('[data-foot]'), q: $('#nd-q'), status: $('#nd-status'), dept: $('#nd-dept'), type: $('#nd-type'), refresh: $('[data-refresh]'), auto: $('[data-auto]') };

  function renderSource() {
    const map = {
      live: ['chip-ok', 'Sheets en vivo', true], demo: ['chip-demo', 'DATOS DE DEMOSTRACIÓN', false],
      error: ['chip-err', 'Sin conexión', false], loading: ['chip-other', 'Cargando…', false]
    };
    const [cls, txt, pulse] = map[state.mode];
    els.src.className = 'chip ' + cls;
    els.src.innerHTML = `<span class="dot ${pulse ? 'pulse' : ''}"></span><span>${txt}</span>`;
    els.src.title = state.mode === 'live' ? `Fuente: Google Sheets ${CFG.SHEET_ID}${CFG.SHEET_TAB ? ' · ' + CFG.SHEET_TAB : ''}` : '';
    els.refresh.disabled = state.busy;
    els.refresh.innerHTML = state.busy ? '<span class="spinner"></span><span>Actualizando…</span>' : `${ICON.refresh}<span>Actualizar</span>`;
    if (els.auto) {
      els.auto.setAttribute('aria-pressed', String(state.auto));
      els.auto.textContent = state.auto ? `Auto: cada ${CFG.AUTO_REFRESH_SECONDS} s` : 'Auto: en pausa';
      els.auto.title = state.auto ? 'Pulsa para pausar la actualización automática' : 'Pulsa para reanudar la actualización automática';
    }
    const srcLink = `<a href="${esc(sheetUrl())}" target="_blank" rel="noopener">hoja de Google Sheets</a>`;
    els.foot.innerHTML = state.mode === 'demo'
      ? 'Mostrando datos de demostración incluidos en la aplicación — no reflejan el estado real.'
      : `Fuente: ${srcLink}${CFG.SHEET_TAB ? ' · pestaña ' + esc(CFG.SHEET_TAB) : ''} · ${state.updated ? 'Última actualización ' + state.updated.toLocaleString('es') : 'sin datos aún'}`;

    if (state.mode === 'demo') {
      els.banner.innerHTML = `<div style="margin-bottom:16px">${alertBox('demo', 'Estás viendo DATOS DE DEMOSTRACIÓN',
        `<p>No provienen de Google Sheets y pueden estar desactualizados. La actualización automática está detenida.</p>`,
        `<button class="btn btn-sm" data-act="retry">${ICON.refresh}Volver a conectar con Sheets</button>`)}</div>`;
    } else if (state.error) {
      const hasData = state.data.length > 0;
      els.banner.innerHTML = `<div style="margin-bottom:16px">${alertBox(hasData ? 'warn' : 'err',
        hasData ? 'No se pudo actualizar desde Google Sheets' : 'No se pudo leer Google Sheets',
        `<p>${esc(state.error)}</p><p class="muted" style="margin-top:4px">${hasData ? 'Se muestran los últimos datos leídos correctamente.' : 'Verifica que la hoja esté compartida como «Cualquier persona con el enlace · Lector» y que tengas conexión.'}</p>`,
        `<button class="btn btn-sm" data-act="retry">${ICON.refresh}Reintentar</button>` +
        (!hasData && CFG.ALLOW_DEMO ? `<button class="btn btn-sm" data-act="demo">Ver datos de demostración</button>` : ''))}</div>`;
    } else els.banner.innerHTML = '';
  }

  function renderCards() {
    const d = state.data, n = k => d.filter(x => statusKind(x.estado) === k).length;
    const items = [
      { label:'Total registrados', val:d.length, sub:`${d.filter(x=>x.tipo==='Maleta').length} maletas · ${d.filter(x=>x.tipo==='Bolso').length} bolsos`, c:'var(--text)', bar:'linear-gradient(90deg,#94a3b8,#475569)', k:'' },
      { label:'Desplegados / Completados', val:n('ok'), sub:'Operativos', c:'var(--mint)', bar:'linear-gradient(90deg,var(--mint),#059669)', k:'ok' },
      { label:'En actualizaciones', val:n('upd'), sub:'Trabajo en curso', c:'var(--amber)', bar:'linear-gradient(90deg,var(--amber),#f97316)', k:'upd' },
      { label:'Por ejecutar', val:n('todo'), sub:'Pendientes de iniciar', c:'var(--neon)', bar:'linear-gradient(90deg,var(--neon),#2563eb)', k:'todo' }
    ];
    els.kpis.innerHTML = items.map(i => {
      const pct = d.length ? Math.round(i.val / d.length * 100) : 0;
      return `<div class="panel kpi"><p class="lbl">${i.label}</p><p class="val" style="color:${i.c}">${state.mode === 'loading' && !d.length ? '—' : i.val}</p>
        <p class="sub">${i.sub}</p><div class="bar"><span style="width:${i.k === '' ? (d.length ? 100 : 0) : pct}%;background:${i.bar}"></span></div></div>`;
    }).join('');
  }

  function fillFilters() {
    const uniq = a => [...new Set(a.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const opt = (arr, all) => `<option value="">${all}</option>` + arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    const keep = (el, html) => { const v = el.value; el.innerHTML = html; el.value = v; if (el.value !== v) el.value = ''; };
    keep(els.status, opt(uniq(state.data.map(x => x.estado)), 'Estado: todos'));
    keep(els.dept, opt(uniq(state.data.map(x => x.responsable)), 'Responsable: todos'));
    keep(els.type, opt(['Maleta', 'Bolso'], 'Tipo: todos'));
    state.status = els.status.value; state.dept = els.dept.value; state.type = els.type.value;
  }

  function filtered() {
    const q = norm(state.q);
    return state.data.filter(x =>
      (!state.status || x.estado === state.status) &&
      (!state.dept || x.responsable === state.dept) &&
      (!state.type || x.tipo === state.type) &&
      (!q || norm([x.id, x.estado, x.responsable, x.specs.join(' '), x.pendientes.join(' '), x.demora, x.observaciones].join(' ')).includes(q))
    );
  }

  function renderView() {
    root.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    if (state.mode === 'loading' && !state.data.length) {
      els.count.textContent = '';
      els.view.innerHTML = `<div class="skeleton" style="height:260px" aria-label="Cargando datos"></div>`;
      return;
    }
    if (!state.data.length) {
      els.count.textContent = '';
      els.view.innerHTML = state.mode === 'error' ? '' : `<div class="state"><h3>No hay órdenes registradas</h3><p>La hoja no contiene filas con un ID válido.</p></div>`;
      return;
    }
    const list = filtered();
    els.count.textContent = `Mostrando ${list.length} de ${state.data.length} registros`;
    if (!list.length) {
      els.view.innerHTML = `<div class="state"><h3>Sin resultados</h3><p>Ninguna orden coincide con la búsqueda o los filtros actuales.</p>
        <div class="alert-actions"><button class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`;
      return;
    }
    const delay = x => x.demora ? `<span class="chip chip-warn" title="${esc(x.demora)}">${small(ICON.warn)}Demora</span>` : '<span class="none">—</span>';
    if (state.view === 'table') {
      els.view.innerHTML = `<div class="panel table-wrap fade-in"><table class="data">
        <thead><tr><th scope="col">ID</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Responsable</th><th scope="col">Pendientes</th><th scope="col">Demora</th></tr></thead>
        <tbody>${list.map(x => `<tr class="row" data-id="${esc(x.id)}" tabindex="0" aria-label="Ver ficha de ${esc(x.id)}">
          <td class="cell-id">${esc(x.id)}</td><td>${x.tipo}</td><td>${badge(x.estado)}</td>
          <td>${esc(x.responsable) || '<span class="none">—</span>'}</td>
          <td class="muted">${x.pendientes.length ? x.pendientes.length + ' act.' : '<span class="none">—</span>'}</td>
          <td>${delay(x)}</td></tr>`).join('')}</tbody></table></div>`;
    } else {
      els.view.innerHTML = `<div class="card-grid fade-in">${list.map(x => `<button type="button" class="item-card row ring-${statusKind(x.estado)}" data-id="${esc(x.id)}" aria-label="Ver ficha de ${esc(x.id)}">
        <span class="top"><span><span class="cell-id" style="display:block">${esc(x.id)}</span><span class="dim" style="font-size:12px">${x.tipo}</span></span>${badge(x.estado)}</span>
        <span class="desc">${x.specs.length ? esc(x.specs.slice(0, 3).join(' · ')) : '<span class="none">Sin especificaciones registradas</span>'}</span>
        <span class="foot"><span style="display:flex;align-items:center;gap:6px">${small(ICON.user)}${esc(x.responsable) || '—'}</span>
          <span>${x.pendientes.length ? `${x.pendientes.length} pendientes` : ''} ${x.demora ? '<span style="color:var(--orange);margin-left:6px">⚠ demora</span>' : ''}</span></span>
      </button>`).join('')}</div>`;
    }
  }

  function openDetail(id) {
    const x = state.data.find(n => n.id === id); if (!x) return;
    const sec = (icon, title, body) => `<section class="sec"><h3 class="sec-title">${icon}${title}</h3>${body}</section>`;
    const empty = t => `<p class="none" style="font-size:14px">${t}</p>`;
    openModal({ html: `
      <div class="modal-head"><div><p class="kicker">${x.tipo}${state.mode === 'demo' ? ' · <span style="color:var(--orange)">DEMOSTRACIÓN</span>' : ''}</p>
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

  function renderAll() { renderSource(); renderCards(); fillFilters(); renderView(); }

  async function refresh() {
    if (state.busy) return;
    state.busy = true; if (!state.data.length) state.mode = 'loading';
    renderSource(); if (!state.data.length) { renderCards(); renderView(); }
    try {
      const data = await loadData();
      if (!alive) return;
      state.data = data; state.mode = 'live'; state.error = ''; state.updated = new Date();
    } catch (e) {
      if (!alive) return;
      console.error('[NODO] Error al leer Sheets:', e);
      state.error = e.message;
      // Si hay datos en vivo anteriores se conservan; nunca se sustituyen por la demostración automáticamente.
      state.mode = state.data.length && state.mode !== 'demo' ? 'live' : 'error';
      if (state.mode === 'error') state.data = [];
    }
    state.busy = false;
    renderAll();
  }

  function startDemo() {
    state.data = DEMO_DATA.map(x => ({ ...x })); state.mode = 'demo'; state.error = ''; state.updated = null;
    renderAll();
  }

  function schedule() {
    clearInterval(timer); timer = null;
    if (state.auto && CFG.AUTO_REFRESH_SECONDS > 0)
      timer = setInterval(() => { if (state.mode !== 'demo' && !document.hidden) refresh(); }, CFG.AUTO_REFRESH_SECONDS * 1000);
  }

  els.q.addEventListener('input', e => { state.q = e.target.value; renderView(); });
  els.status.addEventListener('change', e => { state.status = e.target.value; renderView(); });
  els.dept.addEventListener('change', e => { state.dept = e.target.value; renderView(); });
  els.type.addEventListener('change', e => { state.type = e.target.value; renderView(); });
  root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; store.set('nodo-view', state.view); renderView(); }));
  els.refresh.addEventListener('click', () => {
    if (state.mode === 'demo') { state.data = []; state.mode = 'loading'; }
    refresh();
  });
  if (els.auto) els.auto.addEventListener('click', () => { state.auto = !state.auto; renderSource(); schedule(); });
  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'retry') { if (state.mode === 'demo') { state.data = []; state.mode = 'loading'; } refresh(); }
      if (act.dataset.act === 'demo') startDemo();
      if (act.dataset.act === 'clear') { state.q = ''; els.q.value = ''; els.status.value = els.dept.value = els.type.value = ''; state.status = state.dept = state.type = ''; renderView(); }
      return;
    }
    const r = e.target.closest('.row'); if (r && els.view.contains(r)) openDetail(r.dataset.id);
  });
  els.view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr.row')) openDetail(e.target.dataset.id); });

  renderAll();
  refresh();
  schedule();

  return () => { alive = false; clearInterval(timer); };
}
