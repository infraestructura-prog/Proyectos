/* Neotropya › Nodos › Tablero de actividades.
   Vista kanban de las actividades pendientes de cada nodo (columna «Pendientes › Actividades» de la hoja).
   Solo lectura: las tarjetas no se arrastran, el estado sale de Google Sheets. */
import { esc, ICON, store } from '../ui.js';
import {
  CFG, shared, refreshShared, startDemo, leaveDemo, sourceBanner, sourceChip, sourceFoot,
  statusKind, badge, small, norm, openNodeDetail
} from './nodos-data.js';

/* Columnas según el estado del nodo al que pertenece cada actividad. */
const STATUS_COLUMNS = [
  { key: 'todo', title: 'Por ejecutar', tone: 'neon' },
  { key: 'upd', title: 'En actualizaciones', tone: 'amber' },
  { key: 'ok', title: 'Desplegados / Completados', tone: 'mint' },
  { key: 'other', title: 'Otros estados', tone: 'dim' }
];

export function mount(root, ctx) {
  const state = { q: '', dept: '', type: '', group: store.get('kanban-group') === 'responsable' ? 'responsable' : 'estado', busy: false };
  let timer = null, alive = true;

  root.innerHTML = `<div class="kanban-page">
    <div class="section-head">
      <div><p class="eyebrow">Proyecto Nodo</p><h1>Tablero de actividades</h1>
        <p>Actividades pendientes de cada maleta y bolso · solo consulta</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="chip chip-other" data-src><span class="dot"></span><span>Cargando…</span></span>
        <button class="btn" data-refresh>${ICON.refresh}<span>Actualizar</span></button>
      </div>
    </div>
    <div data-banner></div>
    <section class="panel toolbar" aria-label="Búsqueda y filtros">
      <div class="search">${ICON.search}<label class="sr-only" for="kb-q">Buscar actividad</label>
        <input id="kb-q" type="search" placeholder="Buscar actividad o nodo (ej. Ecoflow, NO-FI…)"></div>
      <label class="sr-only" for="kb-dept">Responsable</label><select id="kb-dept" class="select"></select>
      <label class="sr-only" for="kb-type">Tipo</label><select id="kb-type" class="select"></select>
      <span class="spacer"></span>
      <div class="seg" role="group" aria-label="Agrupar columnas por">
        <button data-group="estado">Por estado del nodo</button><button data-group="responsable">Por responsable</button>
      </div>
    </section>
    <p class="count" data-count aria-live="polite"></p>
    <div data-board></div>
    <p class="count" style="text-align:center;margin-top:24px" data-foot></p>
  </div>`;

  const $ = s => root.querySelector(s);
  const els = { src: $('[data-src]'), banner: $('[data-banner]'), count: $('[data-count]'), board: $('[data-board]'), foot: $('[data-foot]'),
    q: $('#kb-q'), dept: $('#kb-dept'), type: $('#kb-type'), refresh: $('[data-refresh]') };

  function renderSource() {
    sourceChip(els.src, state.busy);
    els.refresh.disabled = state.busy;
    els.refresh.innerHTML = state.busy ? '<span class="spinner"></span><span>Actualizando…</span>' : `${ICON.refresh}<span>Actualizar</span>`;
    els.banner.innerHTML = sourceBanner();
    els.foot.innerHTML = sourceFoot();
  }

  function fillFilters() {
    const uniq = a => [...new Set(a.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const opt = (arr, all) => `<option value="">${all}</option>` + arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    const keep = (el, html) => { const v = el.value; el.innerHTML = html; el.value = v; if (el.value !== v) el.value = ''; };
    keep(els.dept, opt(uniq(shared.data.map(x => x.responsable)), 'Responsable: todos'));
    keep(els.type, opt(['Maleta', 'Bolso'], 'Tipo: todos'));
    state.dept = els.dept.value; state.type = els.type.value;
  }

  /* Una tarjeta por actividad pendiente, con los datos de su nodo. */
  function activities() {
    const q = norm(state.q);
    const nodes = shared.data.filter(x => (!state.dept || x.responsable === state.dept) && (!state.type || x.tipo === state.type));
    const acts = [];
    nodes.forEach(n => n.pendientes.forEach((texto, i) => acts.push({ key: `${n.id}#${i}`, texto, node: n })));
    const list = q ? acts.filter(a => norm([a.texto, a.node.id, a.node.responsable, a.node.estado].join(' ')).includes(q)) : acts;
    return { list, nodes };
  }

  function columns(list, nodes) {
    if (state.group === 'responsable') {
      const names = [...new Set(nodes.map(n => n.responsable || ''))].sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'es'));
      return names.map(name => ({
        title: name || 'Sin responsable', tone: name ? 'neon' : 'dim',
        items: list.filter(a => (a.node.responsable || '') === name),
        idle: nodes.filter(n => (n.responsable || '') === name && !n.pendientes.length)
      }));
    }
    return STATUS_COLUMNS.map(c => ({
      title: c.title, tone: c.tone,
      items: list.filter(a => statusKind(a.node.estado) === c.key),
      idle: nodes.filter(n => statusKind(n.estado) === c.key && !n.pendientes.length)
    })).filter(c => c.items.length || c.idle.length || c.title !== 'Otros estados');
  }

  function cardHtml(a) {
    const n = a.node;
    return `<li><button type="button" class="kb-card ring-${statusKind(n.estado)}" data-id="${esc(n.id)}" aria-label="${esc(a.texto)} · nodo ${esc(n.id)}. Ver ficha del nodo">
      <span class="kb-text">${esc(a.texto)}</span>
      <span class="kb-meta">
        <span class="cell-id" style="font-size:12px">${esc(n.id)}</span>
        <span class="dim">${n.tipo}</span>
        ${state.group === 'responsable' ? badge(n.estado) : (n.responsable ? `<span class="kb-resp">${small(ICON.user)}${esc(n.responsable)}</span>` : '')}
        ${n.demora ? `<span class="chip chip-warn" title="${esc(n.demora)}">${small(ICON.warn)}Demora</span>` : ''}
      </span>
    </button></li>`;
  }

  function renderBoard() {
    root.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === state.group)));
    if (shared.mode === 'loading' && !shared.data.length) {
      els.count.textContent = '';
      els.board.innerHTML = `<div class="kanban">${'<div class="skeleton kb-col" style="height:320px"></div>'.repeat(3)}</div>`;
      return;
    }
    if (!shared.data.length) { els.count.textContent = ''; els.board.innerHTML = ''; return; }
    const { list, nodes } = activities();
    const total = shared.data.reduce((s, n) => s + n.pendientes.length, 0);
    els.count.textContent = `Mostrando ${list.length} de ${total} actividades pendientes · ${nodes.length} nodos`;
    if (!total) {
      els.board.innerHTML = `<div class="state"><h3>No hay actividades pendientes</h3><p>Ningún nodo tiene actividades en la columna «Pendientes» de la hoja.</p></div>`;
      return;
    }
    if (!list.length) {
      els.board.innerHTML = `<div class="state"><h3>Sin resultados</h3><p>Ninguna actividad coincide con la búsqueda o los filtros.</p>
        <div class="alert-actions"><button class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`;
      return;
    }
    els.board.innerHTML = `<div class="kanban fade-in" role="list" aria-label="Columnas del tablero">${columns(list, nodes).map(c => `
      <section class="kb-col tone-${c.tone}" role="listitem" aria-label="${esc(c.title)}: ${c.items.length} actividades">
        <header class="kb-head"><h2>${esc(c.title)}</h2><span class="n">${c.items.length}</span></header>
        ${c.items.length ? `<ul class="kb-list">${c.items.map(cardHtml).join('')}</ul>` : `<p class="kb-empty">Sin actividades pendientes.</p>`}
        ${c.idle.length ? `<p class="kb-idle" title="${esc(c.idle.map(n => n.id).join(', '))}">${c.idle.length} ${c.idle.length === 1 ? 'nodo' : 'nodos'} sin actividades: ${c.idle.map(n => `<span class="mono">${esc(n.id)}</span>`).join(', ')}</p>` : ''}
      </section>`).join('')}</div>`;
  }

  function renderAll() { renderSource(); fillFilters(); renderBoard(); }

  async function refresh(force = true) {
    if (state.busy) return;
    state.busy = true; renderSource();
    if (!shared.data.length) renderBoard();
    await refreshShared({ force });
    if (!alive) return;
    state.busy = false;
    renderAll();
  }

  els.q.addEventListener('input', e => { state.q = e.target.value; renderBoard(); });
  els.dept.addEventListener('change', e => { state.dept = e.target.value; renderBoard(); });
  els.type.addEventListener('change', e => { state.type = e.target.value; renderBoard(); });
  root.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => { state.group = b.dataset.group; store.set('kanban-group', state.group); renderBoard(); }));
  els.refresh.addEventListener('click', () => { leaveDemo(); refresh(); });
  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'retry') { leaveDemo(); refresh(); }
      if (act.dataset.act === 'demo') { startDemo(); renderAll(); }
      if (act.dataset.act === 'clear') { state.q = ''; els.q.value = ''; els.dept.value = els.type.value = ''; state.dept = state.type = ''; renderBoard(); }
      return;
    }
    const card = e.target.closest('.kb-card');
    if (card) { const n = shared.data.find(x => x.id === card.dataset.id); if (n) openNodeDetail(n, { demo: shared.mode === 'demo' }); }
  });

  renderAll();
  refresh(false);
  if (CFG.AUTO_REFRESH_SECONDS > 0)
    timer = setInterval(() => { if (shared.mode !== 'demo' && !document.hidden) refresh(); }, CFG.AUTO_REFRESH_SECONDS * 1000);

  return () => { alive = false; clearInterval(timer); };
}
