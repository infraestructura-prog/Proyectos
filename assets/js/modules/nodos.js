/* Neotropya › Nodos › Control de órdenes de fabricación.
   Integración del panel original «nodo-dashboard.html». La lectura de Google Sheets y la ficha del nodo
   están en nodos-data.js (compartidas con el Tablero de actividades). Solo lectura. */
import { esc, ICON, store } from '../ui.js';
import {
  CFG, shared, refreshShared, startDemo, leaveDemo, sourceBanner, sourceChip, sourceFoot,
  statusKind, badge, small, norm, sentinelOf, openNodeDetail
} from './nodos-data.js';

export function mount(root, ctx) {
  const state = { q: '', status: '', dept: '', type: '', view: store.get('nodo-view') || 'table', auto: CFG.AUTO_REFRESH_SECONDS > 0, busy: false };
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
    sourceChip(els.src, state.busy);
    els.refresh.disabled = state.busy;
    els.refresh.innerHTML = state.busy ? '<span class="spinner"></span><span>Actualizando…</span>' : `${ICON.refresh}<span>Actualizar</span>`;
    if (els.auto) {
      els.auto.setAttribute('aria-pressed', String(state.auto));
      els.auto.textContent = state.auto ? `Auto: cada ${CFG.AUTO_REFRESH_SECONDS} s` : 'Auto: en pausa';
      els.auto.title = state.auto ? 'Pulsa para pausar la actualización automática' : 'Pulsa para reanudar la actualización automática';
    }
    els.foot.innerHTML = sourceFoot();
    els.banner.innerHTML = sourceBanner();
  }

  function renderCards() {
    const d = shared.data, n = k => d.filter(x => statusKind(x.estado) === k).length;
    const items = [
      { label:'Total registrados', val:d.length, sub:`${d.filter(x=>x.tipo==='Maleta').length} maletas · ${d.filter(x=>x.tipo==='Bolso').length} bolsos`, c:'var(--text)', bar:'linear-gradient(90deg,#94a3b8,#475569)', k:'' },
      { label:'Desplegados / Completados', val:n('ok'), sub:'Operativos', c:'var(--mint)', bar:'linear-gradient(90deg,var(--mint),#059669)', k:'ok' },
      { label:'En actualizaciones', val:n('upd'), sub:'Trabajo en curso', c:'var(--amber)', bar:'linear-gradient(90deg,var(--amber),#f97316)', k:'upd' },
      { label:'Por ejecutar', val:n('todo'), sub:'Pendientes de iniciar', c:'var(--neon)', bar:'linear-gradient(90deg,var(--neon),#2563eb)', k:'todo' }
    ];
    els.kpis.innerHTML = items.map(i => {
      const pct = d.length ? Math.round(i.val / d.length * 100) : 0;
      return `<div class="panel kpi"><p class="lbl">${i.label}</p><p class="val" style="color:${i.c}">${shared.mode === 'loading' && !d.length ? '—' : i.val}</p>
        <p class="sub">${i.sub}</p><div class="bar"><span style="width:${i.k === '' ? (d.length ? 100 : 0) : pct}%;background:${i.bar}"></span></div></div>`;
    }).join('');
  }

  function fillFilters() {
    const uniq = a => [...new Set(a.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const opt = (arr, all) => `<option value="">${all}</option>` + arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    const keep = (el, html) => { const v = el.value; el.innerHTML = html; el.value = v; if (el.value !== v) el.value = ''; };
    keep(els.status, opt(uniq(shared.data.map(x => x.estado)), 'Estado: todos'));
    keep(els.dept, opt(uniq(shared.data.map(x => x.responsable)), 'Responsable: todos'));
    keep(els.type, opt(['Maleta', 'Bolso'], 'Tipo: todos'));
    state.status = els.status.value; state.dept = els.dept.value; state.type = els.type.value;
  }

  function filtered() {
    const q = norm(state.q);
    return shared.data.filter(x =>
      (!state.status || x.estado === state.status) &&
      (!state.dept || x.responsable === state.dept) &&
      (!state.type || x.tipo === state.type) &&
      (!q || norm([x.id, x.estado, x.responsable, x.specs.join(' '), x.pendientes.join(' '), x.demora, x.observaciones].join(' ')).includes(q))
    );
  }

  function renderView() {
    root.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    if (shared.mode === 'loading' && !shared.data.length) {
      els.count.textContent = '';
      els.view.innerHTML = `<div class="skeleton" style="height:260px" aria-label="Cargando datos"></div>`;
      return;
    }
    if (!shared.data.length) {
      els.count.textContent = '';
      els.view.innerHTML = shared.mode === 'error' ? '' : `<div class="state"><h3>No hay órdenes registradas</h3><p>La hoja no contiene filas con un ID válido.</p></div>`;
      return;
    }
    const list = filtered();
    els.count.textContent = `Mostrando ${list.length} de ${shared.data.length} registros`;
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
      // En la tarjeta solo se ve el número de centinela; las especificaciones completas están en la ficha.
      els.view.innerHTML = `<div class="card-grid fade-in">${list.map(x => { const sent = sentinelOf(x); return `<button type="button" class="item-card row ring-${statusKind(x.estado)}" data-id="${esc(x.id)}" aria-label="Ver ficha de ${esc(x.id)}">
        <span class="top"><span class="id-block"><span class="cell-id" style="display:block">${esc(x.id)}</span><span class="dim" style="font-size:12px">${x.tipo}</span></span>${badge(x.estado)}</span>
        <span class="sentinel">${sent ? `<span class="dim">Centinela</span> <span class="mono">${esc(sent)}</span>` : '<span class="none">Sin número de centinela</span>'}</span>
        <span class="foot"><span style="display:flex;align-items:center;gap:6px">${small(ICON.user)}${esc(x.responsable) || '—'}</span>
          <span>${x.pendientes.length ? `${x.pendientes.length} pendientes` : ''} ${x.demora ? '<span style="color:var(--orange);margin-left:6px">⚠ demora</span>' : ''}</span></span>
      </button>`; }).join('')}</div>`;
    }
  }

  const openDetail = id => { const x = shared.data.find(n => n.id === id); if (x) openNodeDetail(x, { demo: shared.mode === 'demo' }); };

  function renderAll() { renderSource(); renderCards(); fillFilters(); renderView(); }

  async function refresh(force = true) {
    if (state.busy) return;
    state.busy = true; renderSource();
    if (!shared.data.length) { renderCards(); renderView(); }
    await refreshShared({ force });
    if (!alive) return;
    state.busy = false;
    renderAll();
  }

  function schedule() {
    clearInterval(timer); timer = null;
    if (state.auto && CFG.AUTO_REFRESH_SECONDS > 0)
      timer = setInterval(() => { if (shared.mode !== 'demo' && !document.hidden) refresh(); }, CFG.AUTO_REFRESH_SECONDS * 1000);
  }

  els.q.addEventListener('input', e => { state.q = e.target.value; renderView(); });
  els.status.addEventListener('change', e => { state.status = e.target.value; renderView(); });
  els.dept.addEventListener('change', e => { state.dept = e.target.value; renderView(); });
  els.type.addEventListener('change', e => { state.type = e.target.value; renderView(); });
  root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; store.set('nodo-view', state.view); renderView(); }));
  els.refresh.addEventListener('click', () => { leaveDemo(); refresh(); });
  if (els.auto) els.auto.addEventListener('click', () => { state.auto = !state.auto; renderSource(); schedule(); });
  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'retry') { leaveDemo(); refresh(); }
      if (act.dataset.act === 'demo') { startDemo(); renderAll(); }
      if (act.dataset.act === 'clear') { state.q = ''; els.q.value = ''; els.status.value = els.dept.value = els.type.value = ''; state.status = state.dept = state.type = ''; renderView(); }
      return;
    }
    const r = e.target.closest('.row'); if (r && els.view.contains(r)) openDetail(r.dataset.id);
  });
  els.view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr.row')) openDetail(e.target.dataset.id); });

  renderAll();
  refresh(false);
  schedule();

  return () => { alive = false; clearInterval(timer); };
}
