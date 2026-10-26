/* Infraestructura › Kanban de actividades.
   Datos iniciales: assets/data/infra-kanban.json (To-do list del departamento), cargados UNA sola vez.
   Persistencia de esta primera versión: localStorage de este navegador + exportación/importación JSON.
   No sincroniza con Google Sheets, Slack ni otras fuentes. */
import { esc, ICON, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';
import { infraHero } from '../infra-theme.js';

const DATA_URL = '/assets/data/infra-kanban.json';
const STORE_KEY = 'ccs-infra-kanban-v1';
const SCHEMA = 'ccs-kanban-v1';
const BOARD_ID = 'infra-kanban';

const COLS = [
  { id: 'todo', title: 'To do', help: 'Pendiente de iniciar.' },
  { id: 'doing', title: 'Doing', help: 'Trabajo en ejecución.' },
  { id: 'testing', title: 'Testing', help: 'Ejecución terminada; pendiente de prueba, inspección o aceptación.' },
  { id: 'blocked', title: 'Blocked', help: 'No puede continuar por una dependencia identificada.' },
  { id: 'done', title: 'Done', help: 'Objetivo completado y validado.' }
];
const COL_IDS = COLS.map(c => c.id);
const colTitle = id => (COLS.find(c => c.id === id) || {}).title || id;
const PRIOS = [{ id: 'critica', label: 'Crítica' }, { id: 'alta', label: 'Alta' }, { id: 'media', label: 'Media' }, { id: 'baja', label: 'Baja' }];
const prioLabel = p => (PRIOS.find(x => x.id === p) || {}).label || 'Por confirmar';
const PROYECTOS = ['Mantenimiento', 'Taller', 'Oficinas', 'Desarrollo de proyectos', 'Neotropya / transversal', 'Gestión departamental'];

const small = icon => icon.replace('<svg', '<svg width="15" height="15"');
const nowIso = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const parseD = s => { const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const uid = p => p + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const httpsUrl = s => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };

/* ═════════ Modelo ═════════ */
function normCard(c, i = 0) {
  const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const f = c.fechas || {};
  const blk = b => (b && typeof b === 'object' ? { quien: str(b.quien, 160), motivo: str(b.motivo, 600), accion: str(b.accion, 600) } : null);
  return {
    id: str(c.id, 80), titulo: str(c.titulo, 200), objetivo: str(c.objetivo, 600), descripcion: str(c.descripcion), criterio: str(c.criterio, 600),
    estado: COL_IDS.includes(c.estado) ? c.estado : 'todo', estadoPorConfirmar: !!c.estadoPorConfirmar,
    prioridad: PRIOS.some(p => p.id === c.prioridad) ? c.prioridad : '',
    proyecto: str(c.proyecto, 80), equipo: str(c.equipo, 160),
    responsable: str(c.responsable, 120), supervisor: str(c.supervisor, 120), solicitante: str(c.solicitante, 200), dependenciaExterna: str(c.dependenciaExterna, 160),
    proximaAccion: str(c.proximaAccion, 600),
    fechas: { original: date(f.original), reprogramada: date(f.reprogramada),
      condicionadas: (Array.isArray(f.condicionadas) ? f.condicionadas : []).map(x => ({ fecha: date(x && x.fecha), condicion: str(x && x.condicion, 200) })).filter(x => x.fecha || x.condicion).slice(0, 20) },
    subtareas: (Array.isArray(c.subtareas) ? c.subtareas : []).map((s, k) => ({ id: str(s && s.id, 40) || `s${k + 1}`, texto: str(s && s.texto, 300), hecha: !!(s && s.hecha) })).filter(s => s.texto).slice(0, 60),
    notas: str(c.notas, 4000),
    enlaces: (Array.isArray(c.enlaces) ? c.enlaces : []).filter(u => typeof u === 'string' && httpsUrl(u)).slice(0, 20),
    bloqueo: blk(c.bloqueo), testing: c.testing ? { comprobar: str(c.testing.comprobar, 600), esperado: str(c.testing.esperado, 600) } : null,
    cierre: c.cierre ? { nota: str(c.cierre.nota, 1000), fecha: date(c.cierre.fecha) } : null,
    historial: (Array.isArray(c.historial) ? c.historial : []).filter(h => h && typeof h === 'object').map(h => ({ fecha: str(h.fecha, 40), tipo: str(h.tipo, 30), de: str(h.de, 20), a: str(h.a, 20), nota: str(h.nota, 1200) })).slice(-200),
    hito: !!c.hito, transversal: !!c.transversal, archivada: !!c.archivada,
    vinculadas: (Array.isArray(c.vinculadas) ? c.vinculadas : []).filter(x => typeof x === 'string').slice(0, 30),
    orden: Number.isFinite(c.orden) ? c.orden : i, creada: str(c.creada, 40)
  };
}

function validateBoard(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
  if (obj.schema !== SCHEMA || obj.id !== BOARD_ID) return { ok: false, error: `El archivo no es un respaldo de este tablero (se esperaba «${SCHEMA}»).` };
  if (!Array.isArray(obj.tarjetas)) return { ok: false, error: 'Falta la lista de tarjetas.' };
  if (obj.tarjetas.length > 1000) return { ok: false, error: 'El archivo tiene demasiadas tarjetas.' };
  const cards = obj.tarjetas.map(normCard);
  const bad = cards.findIndex(c => !c.id || !c.titulo);
  if (bad >= 0) return { ok: false, error: `La tarjeta n.º ${bad + 1} no tiene identificador o título.` };
  if (new Set(cards.map(c => c.id)).size !== cards.length) return { ok: false, error: 'Hay tarjetas con el mismo identificador.' };
  return { ok: true, value: cards };
}

const storage = {
  read() { try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
  write(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch { return false; } }
};

const targetDate = c => c.fechas.reprogramada || c.fechas.original;
const isOverdue = c => { const d = targetDate(c); return !!d && d < todayStr() && c.estado !== 'done'; };
const depOf = c => (c.estado === 'blocked' && c.bloqueo && c.bloqueo.quien) || c.dependenciaExterna || '';
const progress = c => ({ hechas: c.subtareas.filter(s => s.hecha).length, total: c.subtareas.length });

/* ═════════ Módulo ═════════ */
export function mount(root, ctx) {
  const B = { cards: [], savedAt: null, ready: false, error: '', mobileCol: 'todo',
    f: { q: '', resp: '', prio: '', proy: '', dep: '', vencidas: false, transversal: false, archivadas: false } };
  let alive = true, dragId = null;

  root.innerHTML = `<div class="ik">${infraHero({ compact: true, kicker: 'Infraestructura · Taller', title: 'Kanban', subtitle: 'Mantenimiento, taller, oficinas y desarrollo de proyectos' })}<div class="skeleton" style="height:300px"></div></div>`;

  async function load() {
    const saved = storage.read();
    const check = saved ? validateBoard({ ...saved, schema: SCHEMA, id: BOARD_ID }) : null;
    if (check && check.ok) { B.cards = check.value; B.savedAt = saved.savedAt || null; B.ready = true; render(); return; }
    // Primera visita en este navegador: se cargan los datos iniciales una sola vez y se guardan.
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const seed = await res.json();
      const created = nowIso(), perCol = {};
      B.cards = seed.tarjetas.map(t => {
        const c = normCard(t);
        perCol[c.estado] = (perCol[c.estado] || 0) + 1;
        c.orden = perCol[c.estado]; c.creada = created;
        c.historial = [{ fecha: created, tipo: 'carga', de: '', a: c.estado,
          nota: `Carga inicial desde el To-do list${c.estadoPorConfirmar ? ' · estado por confirmar' : ''}${c.estado === 'blocked' && c.bloqueo ? ` · bloqueo documentado: ${c.bloqueo.motivo}` : ''}` }];
        return c;
      });
      B.ready = true; persist(); render();
    } catch (e) { B.error = 'No se pudieron cargar los datos iniciales del tablero (' + e.message + ').'; render(); }
  }

  function persist() {
    B.savedAt = nowIso();
    if (!storage.write({ schema: SCHEMA, id: BOARD_ID, savedAt: B.savedAt, tarjetas: B.cards }))
      toast('No se pudo guardar en este navegador (almacenamiento no disponible).', 'err', 7000);
  }
  const byId = id => B.cards.find(c => c.id === id);
  const log = (c, tipo, nota, de = c.estado, a = c.estado) => c.historial.push({ fecha: nowIso(), tipo, de, a, nota });
  const reindex = col => B.cards.filter(c => c.estado === col && !c.archivada).sort((a, b) => a.orden - b.orden).forEach((c, i) => { c.orden = i + 1; });

  /* ── Filtros ── */
  function visible(c) {
    const f = B.f;
    if (c.archivada) return false;
    if (!f.transversal && c.transversal) return false;
    const q = f.q.trim().toLowerCase();
    if (q && ![c.titulo, c.descripcion, c.objetivo, c.equipo, c.subtareas.map(s => s.texto).join(' '), c.bloqueo ? c.bloqueo.motivo : ''].join(' ').toLowerCase().includes(q)) return false;
    if (f.resp && (f.resp === '__none' ? c.responsable : c.responsable !== f.resp)) return false;
    if (f.prio && (f.prio === '__none' ? c.prioridad : c.prioridad !== f.prio)) return false;
    if (f.proy && c.proyecto !== f.proy) return false;
    if (f.dep === '__con' && !depOf(c)) return false;
    if (f.dep === '__sin' && depOf(c)) return false;
    if (f.dep && !f.dep.startsWith('__') && depOf(c) !== f.dep) return false;
    if (f.vencidas && !isOverdue(c)) return false;
    return true;
  }

  /* ── Tarjeta compacta ── */
  function cardHtml(c, i, n) {
    const pr = progress(c), d = targetDate(c), od = isOverdue(c);
    return `<li class="ik-card prio-${c.prioridad || 'none'} ${c.hito ? 'is-hito' : ''}" draggable="true" data-id="${esc(c.id)}">
      <div class="ik-card-top">
        <span class="ik-proj">${esc(c.proyecto || 'Sin proyecto')}</span>
        <span class="ik-prio p-${c.prioridad || 'none'}">${c.prioridad ? esc(prioLabel(c.prioridad)) : 'Prioridad por confirmar'}</span>
      </div>
      <button type="button" class="ik-title" data-act="open" data-id="${esc(c.id)}">${esc(c.titulo)}</button>
      <div class="ik-tags">
        ${c.estadoPorConfirmar ? '<span class="ik-tag t-confirm">Estado por confirmar</span>' : ''}
        ${od ? `<span class="ik-tag t-late">${small(ICON.warn)}Vencida · ${fmtD(d)}</span>` : ''}
        ${c.hito ? '<span class="ik-tag t-hito">Hito</span>' : ''}
        ${c.transversal ? '<span class="ik-tag t-trans">Transversal</span>' : ''}
      </div>
      ${c.estado === 'blocked' && c.bloqueo ? `<div class="ik-block"><b>${small(ICON.lock)}Depende de: ${esc(c.bloqueo.quien || 'dependencia por identificar')}</b><span>${esc(c.bloqueo.motivo)}</span></div>` : ''}
      <dl class="ik-meta">
        <div><dt>Responsable</dt><dd>${esc(c.responsable || 'Por asignar')}</dd></div>
        ${d && !od ? `<div><dt>Fecha objetivo</dt><dd>${fmtD(d)}</dd></div>` : ''}
        ${pr.total ? `<div class="ik-prog"><dt>Subtareas</dt><dd><span class="bar"><span style="width:${Math.round(pr.hechas / pr.total * 100)}%"></span></span>${pr.hechas}/${pr.total}</dd></div>` : ''}
      </dl>
      <div class="ik-card-foot">
        <label class="sr-only" for="st-${esc(c.id)}">Estado de «${esc(c.titulo)}»</label>
        <select id="st-${esc(c.id)}" class="select ik-state" data-act="state" data-id="${esc(c.id)}">${COLS.map(col => `<option value="${col.id}" ${col.id === c.estado ? 'selected' : ''}>${col.title}</option>`).join('')}</select>
        <button type="button" class="btn btn-ghost icon-btn ik-mv" data-act="up" data-id="${esc(c.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Subir «${esc(c.titulo)}»">▲</button>
        <button type="button" class="btn btn-ghost icon-btn ik-mv" data-act="down" data-id="${esc(c.id)}" ${i === n - 1 ? 'disabled' : ''} aria-label="Bajar «${esc(c.titulo)}»">▼</button>
      </div>
    </li>`;
  }

  /* ── Tablero ── */
  function render() {
    if (!alive) return;
    const hero = infraHero({ compact: true, kicker: 'Infraestructura · Taller', title: 'Kanban', subtitle: 'Mantenimiento, taller, oficinas y desarrollo de proyectos',
      actions: `<button class="btn btn-primary" data-act="new">${ICON.plus}<span>Nueva tarjeta</span></button>` });
    if (B.error) { root.innerHTML = `<div class="ik">${hero}${alertBox('err', 'No se pudo abrir el tablero', `<p>${esc(B.error)}</p>`, '<button class="btn btn-sm" onclick="location.reload()">Reintentar</button>')}</div>`; return; }
    const f = B.f, active = B.cards.filter(c => !c.archivada);
    const uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'));
    const opt = (arr, v, all, extra = '') => `<option value="">${all}</option>${extra}` + arr.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const sel = (v, val) => (v === val ? 'selected' : '');
    const vis = active.filter(visible);
    const archived = B.cards.filter(c => c.archivada);

    root.innerHTML = `<div class="ik">${hero}
      <section class="panel toolbar ik-tools" aria-label="Búsqueda y filtros">
        <div class="search">${ICON.search}<label class="sr-only" for="ik-q">Buscar por título, descripción o equipo</label>
          <input id="ik-q" type="search" placeholder="Buscar por título, descripción o equipo…" value="${esc(f.q)}"></div>
        <label class="sr-only" for="ik-resp">Responsable</label>
        <select id="ik-resp" class="select" data-f="resp">${opt(uniq(active.map(c => c.responsable)), f.resp, 'Responsable: todos', `<option value="__none" ${sel(f.resp, '__none')}>Por asignar</option>`)}</select>
        <label class="sr-only" for="ik-prio">Prioridad</label>
        <select id="ik-prio" class="select" data-f="prio"><option value="">Prioridad: todas</option>${PRIOS.map(p => `<option value="${p.id}" ${sel(f.prio, p.id)}>${p.label}</option>`).join('')}<option value="__none" ${sel(f.prio, '__none')}>Por confirmar</option></select>
        <label class="sr-only" for="ik-proy">Proyecto</label>
        <select id="ik-proy" class="select" data-f="proy">${opt(uniq(active.map(c => c.proyecto)), f.proy, 'Proyecto: todos')}</select>
        <label class="sr-only" for="ik-dep">Dependencia</label>
        <select id="ik-dep" class="select" data-f="dep"><option value="">Dependencia: todas</option><option value="__con" ${sel(f.dep, '__con')}>Con dependencia</option><option value="__sin" ${sel(f.dep, '__sin')}>Sin dependencia</option>${uniq(active.map(depOf)).map(x => `<option value="${esc(x)}" ${sel(f.dep, x)}>${esc(x)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" data-f="vencidas" ${f.vencidas ? 'checked' : ''}> Solo vencidas</label>
        <label class="check"><input type="checkbox" data-f="transversal" ${f.transversal ? 'checked' : ''}> Mostrar actividades transversales</label>
      </section>
      <div class="ik-bar">
        <p class="count" aria-live="polite">Mostrando ${vis.length} de ${active.filter(c => f.transversal || !c.transversal).length} tarjetas${f.transversal ? '' : ' de Infraestructura'}</p>
        <div class="ik-data">
          <button type="button" class="btn btn-sm" data-act="export">${ICON.download}Exportar JSON</button>
          <button type="button" class="btn btn-sm" data-act="import">${ICON.upload}Importar JSON</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="archived" aria-pressed="${f.archivadas}">Archivadas (${archived.length})</button>
          <input type="file" accept="application/json,.json" data-import hidden>
        </div>
      </div>
      <p class="ik-storage">Los cambios se guardan solo en este navegador y no se comparten entre equipos. Usa «Exportar JSON» para respaldarlos o llevarlos a otro equipo.${B.savedAt ? ` Último guardado: ${esc(fmtDate(B.savedAt))}.` : ''}</p>

      <div class="ik-colpick" role="group" aria-label="Elegir columna">${COLS.map(col => `<button type="button" class="ik-pick c-${col.id}" data-act="pick" data-col="${col.id}" aria-pressed="${B.mobileCol === col.id}">${col.title} <span class="n">${vis.filter(c => c.estado === col.id).length}</span></button>`).join('')}</div>

      <div class="ik-board" data-mobile="${B.mobileCol}">${COLS.map(col => {
        const cards = vis.filter(c => c.estado === col.id).sort((a, b) => a.orden - b.orden);
        const total = active.filter(c => c.estado === col.id && (f.transversal || !c.transversal)).length;
        return `<section class="ik-col c-${col.id}" data-col="${col.id}" aria-labelledby="ik-h-${col.id}">
          <header class="ik-col-head"><div><h2 id="ik-h-${col.id}">${col.title}</h2><p>${col.help}</p></div>
            <span class="n" aria-label="${cards.length} tarjetas">${cards.length === total ? cards.length : `${cards.length}/${total}`}</span></header>
          <ul class="ik-list" data-col="${col.id}">${cards.map((c, i) => cardHtml(c, i, cards.length)).join('') || '<li class="ik-empty">Sin tarjetas.</li>'}</ul>
        </section>`;
      }).join('')}</div>

      ${f.archivadas ? `<section class="panel ik-archived" aria-labelledby="ik-arch-t"><h2 id="ik-arch-t">Tarjetas archivadas</h2>
        ${archived.length ? `<ul>${archived.map(c => `<li><span><b>${esc(c.titulo)}</b> <span class="dim">· ${esc(colTitle(c.estado))}</span></span>
          <span><button type="button" class="btn btn-sm btn-ghost" data-act="open" data-id="${esc(c.id)}">Ver</button>
          <button type="button" class="btn btn-sm" data-act="restore" data-id="${esc(c.id)}">Recuperar</button></span></li>`).join('')}</ul>` : '<p class="none">No hay tarjetas archivadas.</p>'}
      </section>` : ''}
    </div>`;

    root.querySelector('#ik-q').addEventListener('input', e => { B.f.q = e.target.value; const p = e.target.selectionStart; render(); const n = root.querySelector('#ik-q'); n.focus(); n.setSelectionRange(p, p); });
    root.querySelectorAll('[data-f]').forEach(el => el.addEventListener('change', e => {
      const k = e.target.dataset.f; B.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      render(); const n = root.querySelector(`[data-f="${k}"]`); n && n.focus();
    }));
    root.querySelector('[data-import]').addEventListener('change', onImport);
    bindDrag();
  }

  /* ── Arrastrar y soltar (escritorio) ── */
  function bindDrag() {
    root.querySelectorAll('.ik-card').forEach(el => {
      el.addEventListener('dragstart', e => { dragId = el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
      el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); root.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target')); });
    });
    root.querySelectorAll('.ik-list').forEach(list => {
      list.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); list.closest('.ik-col').classList.add('drop-target'); });
      list.addEventListener('dragleave', e => { if (!list.contains(e.relatedTarget)) list.closest('.ik-col').classList.remove('drop-target'); });
      list.addEventListener('drop', e => {
        e.preventDefault();
        const id = dragId || e.dataTransfer.getData('text/plain'); if (!id) return;
        const items = [...list.querySelectorAll('.ik-card')].filter(x => x.dataset.id !== id);
        let index = items.length;
        for (let k = 0; k < items.length; k++) { const r = items[k].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { index = k; break; } }
        const before = items[index] ? items[index].dataset.id : null;
        moveCard(id, list.dataset.col, before);
      });
    });
  }

  /* Coloca la tarjeta delante de «beforeId» (o al final) dentro de la columna «to». */
  function place(c, to, beforeId) {
    const others = B.cards.filter(x => x.estado === to && !x.archivada && x.id !== c.id).sort((a, b) => a.orden - b.orden);
    const idx = beforeId ? others.findIndex(x => x.id === beforeId) : -1;
    others.splice(idx >= 0 ? idx : others.length, 0, c);
    others.forEach((x, i) => { x.orden = i + 1; });
  }

  /* ── Cambio de estado con sus reglas ── */
  async function moveCard(id, to, beforeId = null) {
    const c = byId(id); if (!c || !COL_IDS.includes(to)) return render();
    const from = c.estado;
    if (from === to) { place(c, to, beforeId); persist(); render(); return; }
    const extra = await transitionForm(c, from, to);
    if (!extra) { render(); return; } // cancelado: no cambia nada
    if (from === 'blocked' && c.bloqueo) log(c, 'desbloqueo', `Desbloqueada. Motivo anterior: ${c.bloqueo.motivo}${c.bloqueo.quien ? ` (dependía de ${c.bloqueo.quien})` : ''}. Acción indicada: ${c.bloqueo.accion}`, from, to);
    if (from === 'done') log(c, 'reapertura', `Reabierta${extra.motivo ? `: ${extra.motivo}` : ''}.${c.cierre ? ` Cierre anterior: ${c.cierre.nota}` : ''}`, from, to);
    if (to === 'blocked') { c.bloqueo = { quien: extra.quien, motivo: extra.motivo, accion: extra.accion }; c.proximaAccion = extra.accion; log(c, 'bloqueo', `Bloqueada: ${extra.motivo}${extra.quien ? ` · depende de ${extra.quien}` : ''} · para desbloquear: ${extra.accion}`, from, to); }
    else if (from === 'blocked') c.bloqueo = null;
    if (to === 'testing') { c.testing = { comprobar: extra.comprobar, esperado: extra.esperado }; log(c, 'prueba', `En prueba. Comprobar: ${extra.comprobar} · Resultado esperado: ${extra.esperado}`, from, to); }
    if (to === 'done') { c.cierre = { nota: extra.nota, fecha: todayStr() }; log(c, 'cierre', `Completada. Cierre / evidencia: ${extra.nota}`, from, to); }
    if (!['blocked', 'testing', 'done'].includes(to) && from !== 'blocked' && from !== 'done') log(c, 'estado', `Movida de ${colTitle(from)} a ${colTitle(to)}.`, from, to);
    if (c.estadoPorConfirmar) { c.estadoPorConfirmar = false; log(c, 'confirmacion', `Estado confirmado al moverla a ${colTitle(to)}.`, to, to); }
    c.estado = to;
    place(c, to, beforeId); reindex(from);
    persist(); render();
    toast(`«${c.titulo}» → ${colTitle(to)}.`);
    const nb = root.querySelector(`#st-${CSS.escape(c.id)}`); nb && nb.focus();
  }

  /* Formularios obligatorios al bloquear, probar, cerrar o reabrir. Devuelve los datos o null si se cancela. */
  function transitionForm(c, from, to) {
    const needs = to === 'blocked' || to === 'testing' || to === 'done' || from === 'done';
    if (!needs) return Promise.resolve({});
    return new Promise(resolve => {
      let done = false;
      const field = (id, label, val = '', req = true, area = false, hint = '') => `<div class="field full" data-f="${id}"><label for="tf-${id}">${label}${req ? ' <span class="req">*</span>' : ''}</label>
        ${area ? `<textarea id="tf-${id}" name="${id}" class="input" rows="3">${esc(val)}</textarea>` : `<input id="tf-${id}" name="${id}" class="input" value="${esc(val)}" autocomplete="off">`}${hint ? `<p class="hint">${hint}</p>` : ''}<p class="err"></p></div>`;
      let title, body, fields;
      if (to === 'blocked') {
        title = 'Bloquear tarea'; fields = ['motivo', 'accion'];
        body = field('quien', 'Departamento, proveedor o persona de la que depende', c.dependenciaExterna || '', false) + field('motivo', 'Motivo del bloqueo', '', true, true) + field('accion', 'Acción necesaria para desbloquear', '', true, true);
      } else if (to === 'testing') {
        title = 'Enviar a prueba'; fields = ['comprobar', 'esperado'];
        body = field('comprobar', 'Qué se debe comprobar', (c.testing || {}).comprobar || '', true, true) + field('esperado', 'Resultado esperado', (c.testing || {}).esperado || c.criterio, true, true);
      } else if (to === 'done') {
        title = 'Completar tarea'; fields = ['nota'];
        body = `<p class="muted" style="margin-bottom:10px">Criterio de finalización: ${esc(c.criterio || 'sin definir')}</p>` + field('nota', 'Nota de cierre o evidencia', '', true, true, 'Qué se verificó y cómo (por ejemplo: «mueble revisado, estable»; enlace a foto o informe).');
      } else {
        title = 'Reabrir tarea'; fields = [];
        body = `<p>La tarea vuelve a «${colTitle(to)}». Su historial y el cierre anterior se conservan.</p>` + field('motivo', 'Motivo de la reapertura', '', false, true);
      }
      const m = openModal({ size: 'sm', html: `<form novalidate>
        <div class="modal-head"><div><p class="kicker">${esc(colTitle(from))} → ${esc(colTitle(to))}</p><h2 data-modal-title>${title}</h2></div>
          <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cancelar">${ICON.close}</button></div>
        <div class="modal-body"><p class="ik-ttl">${esc(c.titulo)}</p><div class="form-grid">${body}</div></div>
        <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Confirmar</span></button></div>
      </form>`, onClose: () => { if (!done) resolve(null); } });
      const form = m.el.querySelector('form');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = Object.fromEntries([...new FormData(form).entries()].map(([k, x]) => [k, String(x).trim()]));
        const errs = fields.filter(k => !v[k]);
        form.querySelectorAll('[data-f]').forEach(fl => { const bad = errs.includes(fl.dataset.f); fl.classList.toggle('invalid', bad); fl.querySelector('.err').textContent = bad ? 'Este dato es obligatorio para el cambio de estado.' : ''; });
        if (errs.length) { form.querySelector(`[name="${errs[0]}"]`).focus(); return; }
        done = true; m.close('force'); resolve(v);
      });
    });
  }

  /* ── Detalle / edición ── */
  function openCard(c = null) {
    const isNew = !c;
    const d = normCard(c ? JSON.parse(JSON.stringify(c)) : { id: uid('t'), titulo: '', estado: 'todo', proyecto: 'Mantenimiento' });
    const newLinked = []; // tarjetas creadas desde subtareas (se guardan al confirmar)
    const optP = PRIOS.map(p => `<option value="${p.id}" ${p.id === d.prioridad ? 'selected' : ''}>${p.label}</option>`).join('');
    const proys = [...new Set([...PROYECTOS, ...B.cards.map(x => x.proyecto)].filter(Boolean))];
    const inp = (id, label, val, opts = {}) => `<div class="field ${opts.full ? 'full' : ''}" data-f="${id}"><label for="cf-${id}">${label}${opts.req ? ' <span class="req">*</span>' : ''}</label>
      ${opts.area ? `<textarea id="cf-${id}" name="${id}" class="input" rows="${opts.rows || 3}">${esc(val)}</textarea>`
        : `<input id="cf-${id}" name="${id}" class="input" type="${opts.type || 'text'}" value="${esc(val)}" ${opts.list ? `list="${opts.list}"` : ''} autocomplete="off">`}
      ${opts.hint ? `<p class="hint">${opts.hint}</p>` : ''}<p class="err"></p></div>`;
    const linked = d.vinculadas.map(byId).filter(Boolean);
    const hist = [...d.historial].reverse();
    const m = openModal({ html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${isNew ? 'Nueva tarjeta' : `${esc(colTitle(d.estado))}${d.estadoPorConfirmar ? ' · estado por confirmar' : ''}${d.archivada ? ' · archivada' : ''}`}</p>
        <h2 data-modal-title>${isNew ? 'Nueva tarjeta' : esc(d.titulo)}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        ${d.estado === 'blocked' && d.bloqueo ? `<div style="margin-bottom:14px">${alertBox('err', `Bloqueada · depende de ${esc(d.bloqueo.quien || 'dependencia por identificar')}`, `<p>${esc(d.bloqueo.motivo)}</p><p><b style="display:inline">Para desbloquear:</b> ${esc(d.bloqueo.accion)}</p>`)}</div>` : ''}
        ${d.estado === 'testing' && d.testing ? `<div style="margin-bottom:14px">${alertBox('info', 'En prueba', `<p><b style="display:inline">Comprobar:</b> ${esc(d.testing.comprobar)}</p><p><b style="display:inline">Resultado esperado:</b> ${esc(d.testing.esperado)}</p>`)}</div>` : ''}
        ${d.estado === 'done' && d.cierre ? `<div style="margin-bottom:14px">${alertBox('info', `Completada${d.cierre.fecha ? ' el ' + fmtD(d.cierre.fecha) : ''}`, `<p>${esc(d.cierre.nota)}</p>`)}</div>` : ''}
        <div class="form-grid">
          ${inp('titulo', 'Título (acción)', d.titulo, { req: true, full: true, hint: 'Empieza con un verbo: «Instalar…», «Obtener…», «Revisar…».' })}
          ${inp('objetivo', 'Objetivo o resultado esperado', d.objetivo, { req: true, full: true, area: true, rows: 2 })}
          ${inp('descripcion', 'Descripción y alcance', d.descripcion, { full: true, area: true })}
          ${inp('criterio', 'Criterio de finalización', d.criterio, { full: true, area: true, rows: 2 })}
          <div class="field" data-f="prioridad"><label for="cf-prioridad">Prioridad</label><select id="cf-prioridad" name="prioridad" class="select" style="width:100%"><option value="">Por confirmar</option>${optP}</select></div>
          ${inp('proyecto', 'Proyecto o categoría', d.proyecto, { list: 'cf-proys' })}<datalist id="cf-proys">${proys.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
          ${inp('equipo', 'Equipo o área', d.equipo)}
          ${inp('responsable', 'Responsable de ejecución', d.responsable, { hint: 'Vacío = «Por asignar».' })}
          ${inp('supervisor', 'Supervisión', d.supervisor)}
          ${inp('solicitante', 'Solicitante o interlocutor', d.solicitante, { hint: 'Quien pide o con quien se coordina; no es necesariamente quien ejecuta.' })}
          ${inp('dependenciaExterna', 'Departamento o proveedor del que depende', d.dependenciaExterna)}
          ${inp('proximaAccion', 'Próxima acción', d.proximaAccion, { full: true })}
          ${inp('fOriginal', 'Fecha original', d.fechas.original, { type: 'date' })}
          ${inp('fReprog', 'Fecha reprogramada', d.fechas.reprogramada, { type: 'date', hint: 'La fecha original se conserva.' })}
          ${inp('condicionadas', 'Fechas condicionadas o previstas', d.fechas.condicionadas.map(x => `${fmtD(x.fecha)} — ${x.condicion}`).join('\n'), { full: true, area: true, rows: 2, hint: 'Una por línea con el formato «dd/mm/aaaa — condición». No cambian el estado de la tarea.' })}
          <fieldset class="field full ik-subs"><legend>Subtareas</legend>
            <ul data-subs></ul>
            <div class="ik-subadd"><label class="sr-only" for="cf-newsub">Nueva subtarea</label><input id="cf-newsub" class="input" placeholder="Nueva subtarea…"><button type="button" class="btn btn-sm" data-sub="add">${ICON.plus}Agregar</button></div>
          </fieldset>
          ${inp('notas', 'Notas', d.notas, { full: true, area: true })}
          ${inp('enlaces', 'Enlaces de referencia', d.enlaces.join('\n'), { full: true, area: true, rows: 2, hint: 'Uno por línea (https://…).' })}
          <label class="check full"><input type="checkbox" name="porConfirmar" ${d.estadoPorConfirmar ? 'checked' : ''}> Estado por confirmar</label>
        </div>
        ${linked.length ? `<section class="sec"><h3 class="sec-title">${ICON.list}Tarjetas vinculadas</h3><ul class="ik-links">${linked.map(x => `<li><button type="button" class="btn btn-sm btn-ghost" data-open="${esc(x.id)}">${esc(x.titulo)}</button> <span class="dim">· ${esc(colTitle(x.estado))}</span></li>`).join('')}</ul></section>` : ''}
        ${d.enlaces.length ? `<section class="sec"><h3 class="sec-title">Enlaces</h3><ul class="ik-links">${d.enlaces.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('')}</ul></section>` : ''}
        ${hist.length ? `<section class="sec"><h3 class="sec-title">${ICON.history}Historial</h3><ol class="ik-hist">${hist.map(h => `<li><span class="mono dim">${esc(fmtDate(h.fecha))}</span> ${h.de && h.a && h.de !== h.a ? `<b>${esc(colTitle(h.de))} → ${esc(colTitle(h.a))}</b> · ` : ''}${esc(h.nota)}</li>`).join('')}</ol></section>` : ''}
      </div>
      <div class="modal-foot">
        ${isNew ? '' : `<div class="left">${d.archivada ? `<button type="button" class="btn" data-x="restore">Recuperar</button>` : `<button type="button" class="btn btn-danger" data-x="archive">${ICON.trash}Archivar</button>`}</div>`}
        <button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Guardar</span></button>
      </div>
    </form>`, initialFocus: isNew ? '#cf-titulo' : undefined });

    const form = m.el.querySelector('form');
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    m.setCanClose(() => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'));

    const subsEl = form.querySelector('[data-subs]');
    const drawSubs = () => {
      subsEl.innerHTML = d.subtareas.length ? d.subtareas.map((s, i) => `<li>
        <label class="check"><input type="checkbox" data-sub="toggle" data-i="${i}" ${s.hecha ? 'checked' : ''}> <span class="${s.hecha ? 'ik-done' : ''}">${esc(s.texto)}</span></label>
        <span class="ik-subact"><button type="button" class="btn btn-sm btn-ghost" data-sub="link" data-i="${i}" title="Convertir en tarjeta vinculada">Convertir en tarjeta</button>
        <button type="button" class="btn btn-sm btn-ghost icon-btn" data-sub="del" data-i="${i}" aria-label="Quitar subtarea «${esc(s.texto)}»">${ICON.close}</button></span></li>`).join('')
        : '<li class="none">Sin subtareas.</li>';
    };
    drawSubs();
    form.addEventListener('click', e => {
      const b = e.target.closest('[data-sub]'); if (!b || b.dataset.sub === 'toggle') return; // la casilla se gestiona en «change»
      const i = Number(b.dataset.i), act = b.dataset.sub;
      if (act === 'add') { const n = form.querySelector('#cf-newsub'); const t = n.value.trim(); if (!t) { n.focus(); return; } d.subtareas.push({ id: uid('s'), texto: t, hecha: false }); n.value = ''; n.focus(); }
      if (act === 'del') d.subtareas.splice(i, 1);
      if (act === 'link') {
        const s = d.subtareas[i]; const nc = normCard({ id: uid('t'), titulo: s.texto, objetivo: s.texto, estado: 'todo', proyecto: d.proyecto, equipo: d.equipo, prioridad: d.prioridad, vinculadas: [d.id] });
        nc.creada = nowIso(); nc.historial = [{ fecha: nc.creada, tipo: 'creada', de: '', a: 'todo', nota: `Creada desde una subtarea de «${d.titulo || 'tarjeta'}».` }];
        newLinked.push(nc); d.vinculadas.push(nc.id); d.subtareas.splice(i, 1);
        toast(`Se creará la tarjeta «${s.texto}» al guardar.`);
      }
      dirty = true; drawSubs();
    });
    form.addEventListener('change', e => { if (e.target.dataset.sub === 'toggle') { d.subtareas[Number(e.target.dataset.i)].hecha = e.target.checked; dirty = true; } });
    form.querySelector('#cf-newsub').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-sub="add"]').click(); } });

    m.el.addEventListener('click', async e => {
      const o = e.target.closest('[data-open]'); if (o) { m.close('dismiss'); const x = byId(o.dataset.open); if (x) setTimeout(() => openCard(x), 0); return; }
      const x = e.target.closest('[data-x]'); if (!x) return;
      const real = byId(d.id); if (!real) return;
      if (x.dataset.x === 'archive') {
        const ok = await confirmDialog({ title: 'Archivar tarjeta', confirm: 'Archivar', danger: true, body: `<p>«<b>${esc(real.titulo)}</b>» saldrá del tablero. Podrás recuperarla desde «Archivadas».</p>` });
        if (!ok) return;
        real.archivada = true; log(real, 'archivo', 'Archivada.'); reindex(real.estado); persist(); dirty = false; m.close('force'); render(); toast('Tarjeta archivada.');
      }
      if (x.dataset.x === 'restore') { restore(real); dirty = false; m.close('force'); }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const g = n => (form.elements[n] ? form.elements[n].value.trim() : '');
      const errs = {};
      if (!g('titulo')) errs.titulo = 'Escribe un título orientado a la acción.';
      if (!g('objetivo')) errs.objetivo = 'Indica el objetivo o resultado esperado.';
      const cond = [], badCond = [];
      lines(g('condicionadas')).forEach(l => { const [fd, ...rest] = l.split(/\s+[—–-]\s+/); const iso = parseD(fd); if (!iso) badCond.push(l); else cond.push({ fecha: iso, condicion: rest.join(' — ').trim() }); });
      if (badCond.length) errs.condicionadas = `Revisa el formato «dd/mm/aaaa — condición» en: ${badCond[0]}`;
      const links = lines(g('enlaces')); const badLink = links.find(u => !httpsUrl(u));
      if (badLink) errs.enlaces = `Los enlaces deben empezar por https:// (revisa «${badLink}»).`;
      form.querySelectorAll('.field[data-f]').forEach(fl => { const er = errs[fl.dataset.f]; fl.classList.toggle('invalid', !!er); const el = fl.querySelector('.err'); if (el) el.textContent = er || ''; });
      if (Object.keys(errs).length) { form.querySelector(`[name="${Object.keys(errs)[0]}"]`).focus(); return; }

      const target = isNew ? d : byId(d.id);
      const before = isNew ? null : JSON.stringify([target.fechas, target.responsable, target.prioridad]);
      Object.assign(target, {
        titulo: g('titulo'), objetivo: g('objetivo'), descripcion: g('descripcion'), criterio: g('criterio'), prioridad: g('prioridad'), proyecto: g('proyecto'), equipo: g('equipo'),
        responsable: g('responsable'), supervisor: g('supervisor'), solicitante: g('solicitante'), dependenciaExterna: g('dependenciaExterna'), proximaAccion: g('proximaAccion'),
        fechas: { original: g('fOriginal'), reprogramada: g('fReprog'), condicionadas: cond },
        subtareas: d.subtareas, notas: g('notas'), enlaces: links, vinculadas: d.vinculadas
      });
      const pc = form.elements.porConfirmar.checked;
      if (pc !== target.estadoPorConfirmar) log(target, 'confirmacion', pc ? 'Marcada como «estado por confirmar».' : 'Estado confirmado.');
      target.estadoPorConfirmar = pc;
      if (isNew) {
        target.creada = nowIso(); target.historial = [{ fecha: target.creada, tipo: 'creada', de: '', a: target.estado, nota: 'Tarjeta creada.' }];
        B.cards.push(target); place(target, target.estado, null);
      } else {
        log(target, 'edicion', JSON.stringify([target.fechas, target.responsable, target.prioridad]) !== before ? 'Datos editados (fechas, responsable o prioridad).' : 'Datos editados.');
      }
      newLinked.forEach(nc => { B.cards.push(nc); place(nc, 'todo', null); });
      persist(); dirty = false; m.close('force'); render();
      toast(isNew ? 'Tarjeta creada.' : 'Cambios guardados.');
    });
  }

  function restore(c) {
    c.archivada = false; log(c, 'recuperada', 'Recuperada del archivo.'); place(c, c.estado, null); persist(); render(); toast(`«${c.titulo}» recuperada.`);
  }

  /* ── Exportar / importar ── */
  function exportJson() {
    const blob = new Blob([JSON.stringify({ schema: SCHEMA, id: BOARD_ID, exportado: nowIso(), tarjetas: B.cards }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `kanban-infraestructura-${todayStr()}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Respaldo exportado.');
  }
  async function onImport(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('El archivo es demasiado grande (máximo 5 MB).', 'err'); return; }
    let obj; try { obj = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.', 'err', 7000); return; }
    const r = validateBoard(obj);
    if (!r.ok) { toast('No se importó: ' + r.error, 'err', 8000); return; }
    const ok = await confirmDialog({ title: 'Reemplazar tablero', confirm: 'Reemplazar', body: `<p>Se reemplazarán las ${B.cards.length} tarjetas de este navegador por las ${r.value.length} del archivo «${esc(file.name)}».</p>` });
    if (!ok) return;
    B.cards = r.value; persist(); render(); toast('Tablero importado.');
  }

  /* ── Eventos ── */
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b) || b.tagName === 'SELECT') return;
    const id = b.dataset.id, c = id && byId(id);
    switch (b.dataset.act) {
      case 'open': if (c) openCard(c); break;
      case 'new': openCard(null); break;
      case 'up': case 'down': {
        if (!c) break;
        const col = B.cards.filter(x => x.estado === c.estado && !x.archivada && visible(x)).sort((a, z) => a.orden - z.orden);
        const i = col.indexOf(c), j = b.dataset.act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= col.length) break;
        [c.orden, col[j].orden] = [col[j].orden, c.orden];
        persist(); render();
        const nb = root.querySelector(`[data-act="${b.dataset.act}"][data-id="${CSS.escape(id)}"]`);
        (nb && !nb.disabled ? nb : root.querySelector(`#st-${CSS.escape(id)}`)).focus();
        break;
      }
      case 'pick': B.mobileCol = b.dataset.col; render(); root.querySelector(`[data-act="pick"][data-col="${b.dataset.col}"]`).focus(); break;
      case 'export': exportJson(); break;
      case 'import': root.querySelector('[data-import]').click(); break;
      case 'archived': B.f.archivadas = !B.f.archivadas; render(); break;
      case 'restore': if (c) restore(c); break;
    }
  });
  root.addEventListener('change', e => { if (e.target.dataset.act === 'state') moveCard(e.target.dataset.id, e.target.value); });

  load();
  return () => { alive = false; };
}
