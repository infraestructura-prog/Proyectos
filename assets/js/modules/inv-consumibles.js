/* Neotropya › Nodos › Inventarios › Consumibles — consulta de solo lectura (Google Sheets → página).
   Lee la pestaña «Inventario Ensamblaje» en cada apertura, al pulsar «Actualizar» y cada 120 s.
   No modifica la hoja ni guarda el inventario: localStorage solo recuerda vista, filtros y orden. */
import { esc, ICON, store } from '../ui.js';
import { CONSUMIBLES as CFG } from '../config.js';
import { parseCSV } from '../sheets-public.js';

const PREFS_KEY = 'ccs-consumibles-prefs';
const small = icon => icon.replace('<svg', '<svg width="16" height="16"');
const spaces = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const key = s => spaces(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ═════════ Lectura de la hoja ═════════ */
// 1) Exportación CSV por gid: conserva el texto mostrado en cada celda (incluidos errores como #REF!).
// 2) Respaldo por nombre de pestaña (gviz): Google puede vaciar textos en columnas numéricas.
async function fetchCsv(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw Object.assign(new Error('La hoja no es pública (Google pide iniciar sesión).'), { code: 'NOT_PUBLIC' });
  return parseCSV(text);
}
async function readSheet() {
  const t = Date.now(); // evita respuestas guardadas en caché intermedias
  const errors = [];
  if (CFG.GID) {
    try {
      const rows = await fetchCsv(`https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/export?format=csv&gid=${encodeURIComponent(CFG.GID)}&t=${t}`);
      const parsed = parseInventory(rows);
      if (parsed) return { ...parsed, method: 'export' };
      errors.push('la pestaña indicada por su gid no tiene los encabezados esperados');
    } catch (e) { errors.push(e.message); }
  }
  try {
    const rows = await fetchCsv(`https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(CFG.TAB)}&t=${t}`);
    const parsed = parseInventory(rows, { gviz: true });
    if (parsed) return { ...parsed, method: 'gviz' };
    errors.push(`la pestaña «${CFG.TAB}» no tiene los encabezados esperados`);
  } catch (e) { errors.push(e.message); }
  throw Object.assign(new Error('No se pudo leer el inventario: ' + [...new Set(errors)].join(' · ')), { code: errors.some(x => /no es pública/.test(x)) ? 'NOT_PUBLIC' : 'READ' });
}

const HEADERS = {
  foto: ['foto', 'imagen'],
  nombre: ['numero de elemento', 'nombre del elemento', 'elemento', 'nombre'],
  codigo: ['codificacion', 'codigo'],
  descripcion: ['descripcion del elemento', 'descripcion'],
  cantidad: ['cantidad', 'existencia', 'existencias'],
  fotoUrl: ['url de foto', 'foto url', 'url foto', 'imagen url', 'url de imagen']
};

/* Detecta la fila de encabezados (no la limita a la fila 2) y lee todas las filas con contenido debajo. */
function parseInventory(rows, { gviz = false } = {}) {
  let h = -1, col = {};
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const head = rows[i].map(key), c = {};
    for (const [f, names] of Object.entries(HEADERS)) { const j = head.findIndex(x => names.includes(x)); if (j >= 0) c[f] = j; }
    if (c.codigo !== undefined && (c.nombre !== undefined || c.descripcion !== undefined)) { h = i; col = c; break; }
  }
  if (h < 0) return null;
  // La lectura gviz puede vaciar el texto «Cantidad» en una columna numérica: se toma la columna siguiente a la descripción.
  if (col.cantidad === undefined && gviz && col.descripcion !== undefined) col.cantidad = col.descripcion + 1;
  if (col.cantidad === undefined) return null;
  const items = [];
  rows.slice(h + 1).forEach((r, k) => {
    const cell = f => (col[f] === undefined ? '' : String(r[col[f]] ?? ''));
    const nombre = spaces(cell('nombre')), codigo = spaces(cell('codigo')), descripcion = spaces(cell('descripcion')), raw = spaces(cell('cantidad'));
    if (!nombre && !codigo && !descripcion && !raw) return; // fila vacía
    const urlCandidate = spaces(cell('fotoUrl')) || spaces(cell('foto'));
    items.push({ fila: h + 2 + k, nombre, codigo, descripcion, ...parseQty(raw), foto: /^https:\/\/\S+$/i.test(urlCandidate) ? urlCandidate : '' });
  });
  return { items, headerRow: h + 1 };
}

/* Cero ≠ vacío ≠ error. Nunca se convierte un vacío o un error en 0. */
function parseQty(raw) {
  if (raw === '') return { raw, qty: null, estado: 'vacio' };
  if (/^#[A-Z0-9/!?]+/i.test(raw) || /^(#?error|#n\/a|loading)/i.test(raw)) return { raw, qty: null, estado: 'error' };
  const s = raw.replace(/\s/g, '');
  if (/^-?\d+([.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return { raw, qty: n, estado: n < 0 ? 'negativo' : n === 0 ? 'cero' : 'positivo' };
  }
  return { raw, qty: null, estado: 'invalido' };
}

const ESTADOS = {
  positivo: { label: 'Con existencias', chip: 'chip-ok' },
  cero: { label: 'Sin existencias', chip: 'chip-err' },
  vacio: { label: 'Sin cantidad informada', chip: 'chip-other' },
  error: { label: 'Cantidad no disponible', chip: 'chip-warn' },
  invalido: { label: 'Cantidad no disponible', chip: 'chip-warn' },
  negativo: { label: 'Dato por revisar', chip: 'chip-warn' }
};
const FILTROS = [
  { id: '', label: 'Disponibilidad: todas' },
  { id: 'positivo', label: 'Con existencias' },
  { id: 'cero', label: 'Sin existencias' },
  { id: 'vacio', label: 'Sin cantidad informada' },
  { id: 'nodisp', label: 'Cantidad no disponible' },
  { id: 'negativo', label: 'Dato por revisar (negativo)' }
];
const ORDENES = [
  { id: 'fila', label: 'Orden de la hoja' }, { id: 'nombre', label: 'Nombre (A–Z)' }, { id: 'codigo', label: 'Código (A–Z)' },
  { id: 'cant-desc', label: 'Cantidad (mayor a menor)' }, { id: 'cant-asc', label: 'Cantidad (menor a mayor)' }
];
const chip = it => { const e = ESTADOS[it.estado]; return `<span class="chip ${e.chip}"><span class="dot"></span>${e.label}</span>`; };
const qtyHtml = it => it.qty !== null
  ? `<b class="cons-qty-n">${esc(it.qty.toLocaleString('es'))}</b>`
  : `<span class="cons-qty-na" title="${esc(it.raw ? 'Valor en la hoja: ' + it.raw : 'Celda vacía en la hoja')}">${it.estado === 'vacio' ? '—' : esc(it.raw || '—')}</span>`;
const photo = (it, cls) => it.foto
  ? `<img class="${cls}" src="${esc(it.foto)}" alt="Foto de ${esc(it.nombre || it.codigo)}" loading="lazy" referrerpolicy="no-referrer" data-photo>`
  : `<span class="${cls} cons-ph" aria-hidden="true">${ICON.box}</span>`;

/* ═════════ Módulo ═════════ */
export function mount(root, ctx) {
  let prefs = {}; try { prefs = JSON.parse(store.get(PREFS_KEY) || '{}'); } catch { prefs = {}; }
  const S = {
    items: [], method: '', loadedAt: null, loading: false, error: null, reqSeq: 0, open: new Set(),
    view: prefs.view === 'table' ? 'table' : 'cards', q: prefs.q || '', disp: prefs.disp || '', orden: prefs.orden || 'fila'
  };
  let alive = true, timer = null;
  const savePrefs = () => store.set(PREFS_KEY, JSON.stringify({ view: S.view, q: S.q, disp: S.disp, orden: S.orden }));

  root.innerHTML = `<div class="cons">
    <header class="inv-head cons-head">
      <div>
        <p class="neo-hero-kicker"><span class="dot" aria-hidden="true"></span>Inventario · Nodos</p>
        <h1>Inventario de consumibles</h1>
        <p class="inv-desc">Disponibilidad de piezas, accesorios y materiales para el ensamblaje de nodos.</p>
        <p class="inv-source">Consulta de solo lectura de la hoja «${esc(CFG.TAB)}» en Google Sheets. Los datos se consultan al abrir esta sección y cada ${CFG.REFRESH_SECONDS} s; no es una sincronización instantánea.
          <a href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener">Abrir la hoja</a></p>
      </div>
      <div class="cons-actions">
        <span class="chip chip-other" data-status aria-live="polite"><span class="dot"></span><span>Conectando…</span></span>
        <button type="button" class="btn btn-primary" data-act="refresh">${ICON.refresh}<span>Actualizar</span></button>
        <a class="btn btn-sm btn-ghost" href="${ctx.base.replace(/\/[^/]+$/, '')}">${ICON.back}<span>Volver a Inventarios</span></a>
      </div>
    </header>
    <div data-banner></div>
    <section class="kpis cons-kpis" data-kpis aria-label="Resumen del inventario"></section>
    <section class="panel toolbar" aria-label="Búsqueda, filtros y orden">
      <div class="search">${ICON.search}<label class="sr-only" for="cs-q">Buscar por nombre, código o descripción</label>
        <input id="cs-q" type="search" placeholder="Buscar por nombre, código o descripción…" value="${esc(S.q)}"></div>
      <label class="sr-only" for="cs-disp">Disponibilidad</label>
      <select id="cs-disp" class="select">${FILTROS.map(f => `<option value="${f.id}" ${f.id === S.disp ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
      <label class="sr-only" for="cs-ord">Ordenar</label>
      <select id="cs-ord" class="select">${ORDENES.map(o => `<option value="${o.id}" ${o.id === S.orden ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
      <span class="spacer"></span>
      <div class="seg" role="group" aria-label="Cambiar vista">
        <button type="button" data-view="cards">${ICON.grid}Tarjetas</button><button type="button" data-view="table">${ICON.table}Tabla</button>
      </div>
    </section>
    <p class="count" data-count aria-live="polite"></p>
    <div data-list></div>
    <p class="count cons-foot" data-foot></p>
  </div>`;
  const $ = s => root.querySelector(s);

  /* ── Lectura con protección de concurrencia ── */
  async function refresh() {
    if (S.loading) return;            // sin solicitudes simultáneas
    const seq = ++S.reqSeq;
    S.loading = true; renderStatus();
    try {
      const data = await readSheet();
      if (!alive || seq !== S.reqSeq) return; // descarta respuestas antiguas
      S.items = data.items; S.method = data.method; S.loadedAt = new Date(); S.error = null;
    } catch (e) {
      if (!alive || seq !== S.reqSeq) return;
      S.error = e; // si ya había datos, se conservan
    } finally {
      if (alive && seq === S.reqSeq) { S.loading = false; render(); }
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) refresh(); }, CFG.REFRESH_SECONDS * 1000);
  }
  const onVisible = () => { if (!document.hidden && S.loadedAt && Date.now() - S.loadedAt > CFG.REFRESH_SECONDS * 1000) refresh(); };
  document.addEventListener('visibilitychange', onVisible);

  function renderStatus() {
    const el = $('[data-status]'), btn = $('[data-act="refresh"]');
    btn.disabled = S.loading;
    btn.innerHTML = S.loading ? '<span class="spinner"></span><span>Actualizando…</span>' : `${ICON.refresh}<span>Actualizar</span>`;
    if (S.loading && !S.loadedAt) { el.className = 'chip chip-other'; el.innerHTML = '<span class="dot pulse"></span><span>Consultando Google Sheets…</span>'; }
    else if (S.error && !S.loadedAt) { el.className = 'chip chip-err'; el.innerHTML = '<span class="dot"></span><span>Sin conexión</span>'; }
    else if (S.error) { el.className = 'chip chip-warn'; el.innerHTML = '<span class="dot"></span><span>No se pudo actualizar</span>'; }
    else if (S.loadedAt) { el.className = 'chip chip-ok'; el.innerHTML = `<span class="dot ${S.loading ? 'pulse' : ''}"></span><span>${S.loading ? 'Actualizando…' : 'Conectado a Google Sheets'}</span>`; }
  }

  /* ── Filtrado y orden ── */
  function list() {
    const q = key(S.q);
    // «Cantidad no disponible» agrupa errores de fórmula y datos inválidos; los demás filtros son exactos.
    const matchDisp = it => !S.disp || (S.disp === 'nodisp' ? ['error', 'invalido'].includes(it.estado) : it.estado === S.disp);
    const arr = S.items.filter(it => matchDisp(it) && (!q || key([it.nombre, it.codigo, it.descripcion].join(' ')).includes(q)));
    const byText = f => (a, b) => (a[f] || '￿').localeCompare(b[f] || '￿', 'es', { numeric: true, sensitivity: 'base' });
    const byQty = dir => (a, b) => (a.qty === null) - (b.qty === null) || (a.qty === null ? 0 : dir * (a.qty - b.qty)) || a.fila - b.fila;
    const sorters = { fila: (a, b) => a.fila - b.fila, nombre: byText('nombre'), codigo: byText('codigo'), 'cant-desc': byQty(-1), 'cant-asc': byQty(1) };
    return arr.sort(sorters[S.orden] || sorters.fila);
  }

  /* ── Pintado ── */
  function render() {
    if (!alive) return;
    renderStatus();
    root.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
    const banner = $('[data-banner]'), listEl = $('[data-list]'), count = $('[data-count]'), kpis = $('[data-kpis]');
    $('[data-foot]').innerHTML = S.loadedAt
      ? `Última consulta correcta: ${esc(S.loadedAt.toLocaleString('es'))} · se vuelve a consultar cada ${CFG.REFRESH_SECONDS} s mientras esta sección esté abierta${S.method === 'gviz' ? ' · lectura de respaldo por nombre de pestaña' : ''}.`
      : '';

    if (S.error && !S.loadedAt) {
      banner.innerHTML = ''; kpis.innerHTML = ''; count.textContent = '';
      listEl.innerHTML = `<div class="state"><h3>No se pudo leer el inventario</h3><p>${esc(S.error.message)}</p>
        ${S.error.code === 'NOT_PUBLIC' ? '<p class="muted" style="margin-top:6px">La hoja debe estar compartida como «Cualquier persona con el enlace · Lector», o configurarse una lectura por servidor (ver README).</p>' : ''}
        <div class="alert-actions"><button type="button" class="btn btn-primary btn-sm" data-act="refresh">${ICON.refresh}Reintentar</button></div></div>`;
      return;
    }
    banner.innerHTML = S.error ? `<div class="alert alert-warn" role="status" style="margin-bottom:14px">${ICON.warn}<div class="alert-body"><b>No se pudo actualizar desde Google Sheets</b>
      <p>${esc(S.error.message)}. Se muestran los datos de la última consulta correcta (${esc(S.loadedAt.toLocaleTimeString('es'))}).</p></div></div>` : '';
    if (!S.loadedAt) {
      kpis.innerHTML = ''; count.textContent = '';
      listEl.innerHTML = `<div class="cons-grid" aria-label="Cargando inventario">${'<div class="skeleton" style="height:230px"></div>'.repeat(4)}</div>`;
      return;
    }

    const n = k => S.items.filter(it => k.includes(it.estado)).length;
    const k = [
      { label: 'Referencias registradas', val: S.items.length, sub: 'Filas con datos en la hoja', c: 'var(--text)' },
      { label: 'Con existencias', val: n(['positivo']), sub: 'Cantidad mayor que cero', c: 'var(--mint)' },
      { label: 'Sin existencias', val: n(['cero']), sub: 'Cantidad igual a cero', c: 'var(--red)' },
      { label: 'Cantidad no disponible', val: n(['error', 'invalido']), sub: [
        'Error de fórmula o dato inválido',
        n(['vacio']) ? `${n(['vacio'])} sin cantidad informada` : '',
        n(['negativo']) ? `${n(['negativo'])} por revisar (negativas)` : ''
      ].filter(Boolean).join(' · '), c: 'var(--amber)' }
    ];
    kpis.innerHTML = k.map(i => `<div class="panel kpi"><p class="lbl">${i.label}</p><p class="val" style="color:${i.c}">${i.val}</p><p class="sub">${i.sub}</p></div>`).join('');

    const items = list();
    count.textContent = `Mostrando ${items.length} de ${S.items.length} referencias`;
    if (!S.items.length) { listEl.innerHTML = '<div class="state"><h3>La hoja no tiene elementos</h3><p>No se encontraron filas con datos debajo de los encabezados.</p></div>'; return; }
    if (!items.length) { listEl.innerHTML = `<div class="state"><h3>Sin resultados</h3><p>Ninguna referencia coincide con la búsqueda o el filtro.</p><div class="alert-actions"><button type="button" class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`; return; }

    const warn = it => it.estado === 'negativo' ? `<span class="cons-warn">${small(ICON.warn)}Valor negativo: dato por revisar en la hoja</span>` : '';
    if (S.view === 'table') {
      listEl.innerHTML = `<div class="panel table-wrap fade-in"><table class="data cons-table">
        <thead><tr><th scope="col"><span class="sr-only">Imagen</span></th><th scope="col">Nombre</th><th scope="col">Código</th><th scope="col">Descripción</th><th scope="col" class="num">Cantidad</th><th scope="col">Disponibilidad</th></tr></thead>
        <tbody>${items.map(it => `<tr>
          <td class="cons-thumb-cell">${photo(it, 'cons-thumb')}</td>
          <td><b>${esc(it.nombre || 'Sin nombre')}</b></td>
          <td class="mono cons-code">${esc(it.codigo || '—')}</td>
          <td>${it.descripcion ? esc(it.descripcion) : '<span class="none">Sin descripción</span>'}</td>
          <td class="num">${qtyHtml(it)}</td>
          <td>${chip(it)}${warn(it)}</td></tr>`).join('')}</tbody></table></div>`;
    } else {
      listEl.innerHTML = `<div class="cons-grid fade-in">${items.map(it => {
        const id = `cs-d-${it.fila}`, open = S.open.has(it.fila);
        return `<article class="cons-card cons-${it.estado}" aria-label="${esc(it.nombre || it.codigo)}">
          <div class="cons-img">${photo(it, 'cons-photo')}</div>
          <div class="cons-body">
            <h3>${esc(it.nombre || 'Sin nombre')}</h3>
            <p class="mono cons-code">${esc(it.codigo || 'Sin código')}</p>
            <div class="cons-qty"><span class="lbl">Existencia registrada</span>${qtyHtml(it)}</div>
            <div>${chip(it)}</div>${warn(it)}
            <button type="button" class="btn btn-sm cons-more" data-act="desc" data-fila="${it.fila}" aria-expanded="${open}" aria-controls="${id}">${open ? 'Ocultar descripción' : 'Ver descripción'}</button>
            <p class="cons-desc" id="${id}" ${open ? '' : 'hidden'}>${it.descripcion ? esc(it.descripcion) : '<span class="none">Sin descripción</span>'}</p>
          </div>
        </article>`; }).join('')}</div>`;
    }
    // Si una URL de foto falla, vuelve el marcador.
    listEl.querySelectorAll('img[data-photo]').forEach(img => img.addEventListener('error', () => {
      const ph = document.createElement('span'); ph.className = img.className + ' cons-ph'; ph.innerHTML = ICON.box; img.replaceWith(ph);
    }, { once: true }));
  }

  /* ── Eventos ── */
  $('#cs-q').addEventListener('input', e => { S.q = e.target.value; savePrefs(); render(); });
  $('#cs-disp').addEventListener('change', e => { S.disp = e.target.value; savePrefs(); render(); });
  $('#cs-ord').addEventListener('change', e => { S.orden = e.target.value; savePrefs(); render(); });
  root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { S.view = b.dataset.view; savePrefs(); render(); }));
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
    if (b.dataset.act === 'refresh') refresh();
    if (b.dataset.act === 'clear') { S.q = ''; S.disp = ''; $('#cs-q').value = ''; $('#cs-disp').value = ''; savePrefs(); render(); }
    if (b.dataset.act === 'desc') {
      const f = Number(b.dataset.fila); S.open.has(f) ? S.open.delete(f) : S.open.add(f); render();
      const nb = root.querySelector(`[data-act="desc"][data-fila="${f}"]`); nb && nb.focus();
    }
  });

  render();
  refresh();
  schedule();
  return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}

export { parseInventory, parseQty };
