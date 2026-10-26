/* Neotropya › Nodos › Investigaciones › Pinturas y recubrimientos para la maleta.
   Fuente inicial: assets/data/investigaciones/pinturas-maleta.json (extraído de «Cuadro comparativo de pinturas - VF»).
   Independiente de Google Sheets: los cambios se guardan solo en localStorage de este navegador
   y se pueden respaldar con exportación/importación de JSON. Nunca modifica la hoja original. */
import { esc, ICON, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';

const DATA_URL = '/assets/data/investigaciones/pinturas-maleta.json';
const STORE_KEY = 'ccs-inv-pinturas-maleta-v1';
const SCHEMA = 'ccs-investigacion-v1';
const STUDY_ID = 'pinturas-maleta';
const MUESTRAS = ['satinado', 'brillo', 'frio', 'poroso', 'neutro'];

const NIVELES = ['Bajo', 'Medio', 'Alto'];
const small = icon => icon.replace('<svg', '<svg width="16" height="16"');
const httpsUrl = s => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };
/* Los enlaces de Google Drive «/file/d/ID/view» no son imágenes; se usa su miniatura pública. */
function imgSrc(url) {
  const m = String(url || '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url;
}
const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const uid = () => 'alt-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));

/* ═════════ Validación y normalización (también para importar) ═════════ */
function normAlt(a) {
  const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 500)).filter(Boolean).slice(0, 30) : []);
  const rate = v => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
  const out = {
    id: str(a.id, 60), categoria: str(a.categoria, 120), producto: str(a.producto, 160), alias: str(a.alias, 300),
    sri: str(a.sri, 40), durabilidad: rate(a.durabilidad), ambiental: rate(a.ambiental), viabilidad: rate(a.viabilidad),
    modalidad: str(a.modalidad, 80), tiempo: str(a.tiempo, 80), vidaUtil: str(a.vidaUtil, 80),
    ventajas: arr(a.ventajas), limitaciones: arr(a.limitaciones), materiales: arr(a.materiales),
    costoNivel: NIVELES.includes(a.costoNivel) ? a.costoNivel : '',
    imagenUrl: httpsUrl(str(a.imagenUrl, 1000)) ? str(a.imagenUrl, 1000) : '',
    costoTotal: str(a.costoTotal, 80), costoExclusiones: str(a.costoExclusiones, 160), costoDesglose: str(a.costoDesglose, 3000),
    rendimiento: str(a.rendimiento, 80), observaciones: arr(a.observaciones),
    muestra: MUESTRAS.includes(a.muestra) ? a.muestra : 'neutro'
  };
  if (a.original && typeof a.original === 'object') {
    out.original = {};
    for (const [k, v] of Object.entries(a.original)) if (typeof v === 'string') out.original[k.slice(0, 40)] = v.slice(0, 3000);
  }
  return out;
}

/* Devuelve { ok, value, error }. Se usa antes de reemplazar datos al importar. */
export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
  if (obj.schema !== SCHEMA) return { ok: false, error: `El archivo no es un respaldo de investigación (se esperaba «${SCHEMA}»).` };
  if (obj.id !== STUDY_ID) return { ok: false, error: 'El respaldo pertenece a otra investigación.' };
  if (!Array.isArray(obj.alternativas)) return { ok: false, error: 'Falta la lista de alternativas.' };
  if (obj.alternativas.length > 60) return { ok: false, error: 'El archivo tiene demasiadas alternativas (máximo 60).' };
  const alts = obj.alternativas.map(normAlt);
  const bad = alts.findIndex(a => !a.id || !a.categoria || !a.producto || !a.durabilidad || !a.ambiental || !a.viabilidad);
  if (bad >= 0) return { ok: false, error: `La alternativa n.º ${bad + 1} está incompleta (id, categoría, producto y las tres valoraciones de 1 a 5 son obligatorias).` };
  if (new Set(alts.map(a => a.id)).size !== alts.length) return { ok: false, error: 'Hay alternativas con el mismo identificador.' };
  const recId = obj.recomendadaId == null ? null : String(obj.recomendadaId);
  if (recId && !alts.some(a => a.id === recId)) return { ok: false, error: 'La opción recomendada no corresponde a ninguna alternativa.' };
  return { ok: true, value: { alternativas: alts, recomendadaId: recId } };
}

/* ═════════ Almacenamiento local (solo esta investigación) ═════════ */
const storage = {
  read() { try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } },
  write(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch { /* sin almacenamiento */ } }
};

/* ═════════ Muestra gráfica ilustrativa ═════════ */
function sampleSvg(a) {
  const name = a.producto.length > 38 ? a.producto.slice(0, 36) + '…' : a.producto;
  const finishes = {
    satinado: `<rect x="70" y="26" width="180" height="92" rx="14" fill="url(#gSat-${a.id})" stroke="#C9D4C6"/>`,
    brillo: `<rect x="70" y="26" width="180" height="92" rx="14" fill="#FFFFFF" stroke="#C9D4C6"/><path d="M96 26 L150 26 L104 118 L70 118 L70 70 Z" fill="#EEF3FA" opacity=".9"/><path d="M168 26 L186 26 L140 118 L122 118 Z" fill="#F3F7FC"/>`,
    frio: `<rect x="70" y="26" width="180" height="92" rx="14" fill="#F7FBFD" stroke="#BFD8E3"/><g stroke="#7FA8BC" stroke-width="2" fill="none" stroke-linecap="round"><path d="M118 8 L138 30 L158 8"/><path d="M188 8 L208 30 L228 8"/></g>`,
    poroso: `<rect x="70" y="26" width="180" height="92" rx="14" fill="#FBFBF8" stroke="#C9D4C6"/><g fill="#D9DED6">${Array.from({ length: 34 }, (_, i) => `<circle cx="${84 + (i * 37) % 156}" cy="${38 + (i * 23) % 72}" r="${1.4 + (i % 3) * .6}"/>`).join('')}</g>`,
    neutro: `<rect x="70" y="26" width="180" height="92" rx="14" fill="#EAF1E8" stroke="#C9D4C6"/>`
  };
  return `<svg viewBox="0 0 320 150" aria-hidden="true" focusable="false">
    <defs><linearGradient id="gSat-${esc(a.id)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EEF1EC"/></linearGradient></defs>
    <rect width="320" height="150" fill="#F6F8F3"/>
    <circle cx="30" cy="132" r="46" fill="#EAF1E8"/><circle cx="300" cy="18" r="40" fill="#FFE6D4"/>
    ${finishes[a.muestra] || finishes.neutro}
    <rect x="118" y="20" width="84" height="10" rx="5" fill="#C9D4C6"/>
    <text x="160" y="140" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-size="12" font-weight="700" fill="#4C5F54">${esc(name)}</text>
  </svg>`;
}

/* Nivel de costo con texto + barras (no depende solo del color). */
const costLevel = nivel => {
  const n = NIVELES.indexOf(nivel) + 1;
  if (!n) return '<b class="inv-level none-level">Sin clasificar</b>';
  return `<span class="inv-level lvl-${n}"><span class="bars" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span><b>${nivel}</b></span>`;
};

const stars = (n, label) => `<span class="inv-stars" role="img" aria-label="${esc(label)}: ${n} de 5">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= n ? 'on' : ''}" aria-hidden="true">${ICON.star}</span>`).join('')}</span>`;

/* ═════════ Módulo ═════════ */
export function mount(root, ctx) {
  const S = { seed: null, alts: [], recId: null, savedAt: null, q: '', cat: '', mod: '', open: new Set(), error: null };
  let alive = true;

  root.innerHTML = `<div class="inv"><div class="skeleton" style="height:220px" aria-label="Cargando investigación"></div></div>`;

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      S.seed = await res.json();
    } catch (e) {
      S.error = 'No se pudo cargar el archivo de datos de la investigación (' + e.message + ').';
      render(); return;
    }
    // Los datos iniciales solo se usan si no hay una versión guardada en este navegador.
    const saved = storage.read();
    // Versiones guardadas antes de existir los campos nuevos: se completan con los valores del estudio.
    if (saved && Array.isArray(saved.alternativas)) {
      const seedById = new Map((S.seed.alternativas || []).map(x => [x.id, x]));
      saved.alternativas.forEach(x => {
        const s = x && seedById.get(x.id);
        if (!s) return;
        if (x.costoNivel === undefined) x.costoNivel = s.costoNivel;
        if (x.imagenUrl === undefined) x.imagenUrl = s.imagenUrl;
      });
    }
    const check = saved ? validateImport({ ...saved, schema: SCHEMA, id: STUDY_ID }) : null;
    if (check && check.ok) {
      S.alts = check.value.alternativas; S.recId = check.value.recomendadaId; S.savedAt = saved.savedAt || null;
    } else {
      const seed = validateImport(S.seed);
      S.alts = seed.ok ? seed.value.alternativas : []; S.recId = seed.ok ? seed.value.recomendadaId : null; S.savedAt = null;
    }
    if (alive) render();
  }

  function persist() {
    S.savedAt = new Date().toISOString();
    const ok = storage.write({ schema: SCHEMA, id: STUDY_ID, savedAt: S.savedAt, recomendadaId: S.recId, alternativas: S.alts });
    if (!ok) toast('No se pudo guardar en este navegador (almacenamiento no disponible).', 'err', 7000);
  }

  const filtered = () => {
    const q = S.q.trim().toLowerCase();
    return S.alts.filter(a => (!S.cat || a.categoria === S.cat) && (!S.mod || a.modalidad === S.mod)
      && (!q || [a.producto, a.categoria, a.alias].join(' ').toLowerCase().includes(q)));
  };

  /* ── Tarjeta ── */
  function card(a) {
    const rec = a.id === S.recId, open = S.open.has(a.id), pend = a.observaciones.length > 0;
    const detId = `inv-det-${a.id}`, titleId = `inv-t-${a.id}`;
    return `<article class="inv-card ${rec ? 'is-rec' : ''}" aria-labelledby="${titleId}">
      <div class="inv-sample">
        ${sampleSvg(a)}
        ${a.imagenUrl ? `<img class="inv-photo" src="${esc(imgSrc(a.imagenUrl))}" alt="Foto de ${esc(a.producto)}" loading="lazy" referrerpolicy="no-referrer">` : ''}
        <span class="inv-sample-note">${a.imagenUrl ? 'Cargando imagen…' : 'Muestra ilustrativa'}</span>
        ${a.imagenUrl ? '<span class="inv-sample-note inv-photo-failed">Imagen no disponible · muestra ilustrativa</span>' : ''}
        ${rec ? `<span class="inv-rec-badge">${small(ICON.star)}Opción recomendada según el estudio</span>` : ''}
      </div>
      <div class="inv-body">
        <p class="inv-cat">${esc(a.categoria)}</p>
        <h3 id="${titleId}">${esc(a.producto)}</h3>
        ${a.alias ? `<p class="inv-alias">${esc(a.alias)}</p>` : ''}
        <dl class="inv-metrics">
          <div class="m"><dt>SRI</dt><dd><b class="big">${esc(a.sri || '—')}</b><small>Índice de reflectancia solar</small></dd></div>
          <div class="m"><dt>Durabilidad mecánica</dt><dd>${stars(a.durabilidad, 'Durabilidad mecánica')}<b>${a.durabilidad}/5</b></dd></div>
          <div class="m"><dt>Costo</dt><dd>${costLevel(a.costoNivel)}<small>Relativo entre las alternativas</small>
            ${pend ? `<span class="chip chip-warn inv-pend">${small(ICON.warn)}Pendiente de validar</span>` : ''}</dd></div>
          <div class="m"><dt>Aplicación</dt><dd><b>${esc(a.modalidad || '—')}</b>${a.tiempo ? `<small>${esc(a.tiempo)}</small>` : ''}</dd></div>
        </dl>
        <button type="button" class="btn btn-sm inv-more" data-act="toggle" data-id="${esc(a.id)}" aria-expanded="${open}" aria-controls="${detId}">
          ${open ? 'Ocultar detalles' : 'Ver más detalles'}</button>
        <div class="inv-details" id="${detId}" ${open ? '' : 'hidden'}>${open ? details(a) : ''}</div>
      </div>
      <footer class="inv-foot">
        <button type="button" class="btn btn-sm btn-ghost" data-act="edit" data-id="${esc(a.id)}" aria-label="Editar ${esc(a.producto)}">${ICON.edit}Editar</button>
        <button type="button" class="btn btn-sm btn-ghost inv-del" data-act="delete" data-id="${esc(a.id)}" aria-label="Eliminar ${esc(a.producto)}">${ICON.trash}Eliminar</button>
        ${rec ? `<span class="inv-rec-mark">${small(ICON.ok)}Recomendada</span>`
          : `<button type="button" class="btn btn-sm" data-act="recommend" data-id="${esc(a.id)}">${small(ICON.star)}Marcar como recomendada</button>`}
      </footer>
    </article>`;
  }

  function details(a) {
    const list = (items, empty) => items.length ? `<ul class="inv-list">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="none">${empty}</p>`;
    const orig = a.original ? Object.entries(a.original) : [];
    const labels = { categoria: 'Categoría', sri: 'Respuesta solar (SRI)', durabilidad: 'Durabilidad mecánica', ambiental: 'Resistencia ambiental', viabilidad: 'Viabilidad de aplicación', materiales: 'Materiales requeridos', costo: 'Costo total', rendimiento: 'Rendimiento' };
    return `
      <div class="inv-dgrid">
        <div><p class="k">Resistencia ambiental</p><p class="v">${stars(a.ambiental, 'Resistencia ambiental')} <b>${a.ambiental}/5</b></p></div>
        <div><p class="k">Viabilidad de aplicación</p><p class="v">${stars(a.viabilidad, 'Viabilidad de aplicación')} <b>${a.viabilidad}/5</b></p></div>
        <div><p class="k">Vida útil esperada (según el estudio)</p><p class="v">${esc(a.vidaUtil || '—')}</p></div>
        <div><p class="k">Rendimiento por lote</p><p class="v">${esc(a.rendimiento || '—')}</p></div>
      </div>
      <div class="inv-cols">
        <section><h4>Ventajas</h4>${list(a.ventajas, 'Sin ventajas registradas.')}</section>
        <section><h4>Limitaciones</h4>${list(a.limitaciones, 'Sin limitaciones registradas.')}</section>
      </div>
      <section><h4>Materiales requeridos</h4>${a.materiales.length ? `<ul class="inv-tags">${a.materiales.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="none">Sin materiales registrados.</p>'}</section>
      <section class="inv-cost">
        <h4>Costo</h4>
        <p>${costLevel(a.costoNivel)}${a.costoExclusiones ? ` <span class="k">· ${esc(a.costoExclusiones)}</span>` : ''}</p>
        <p class="k" style="margin-top:4px">${esc(S.seed.costoNivelCriterio || 'Clasificación relativa entre las alternativas del estudio.')}</p>
      </section>
      <section><h4>Observaciones y datos pendientes de validar</h4>
        ${a.observaciones.length ? `<ul class="inv-list inv-warn">${a.observaciones.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="none">Sin observaciones.</p>'}</section>
      ${orig.length ? `<details class="inv-orig"><summary>Texto original del Excel</summary>
        <dl>${orig.map(([k, v]) => `<dt>${esc(labels[k] || k)}</dt><dd><pre class="inv-pre">${esc(v)}</pre></dd>`).join('')}</dl></details>` : ''}`;
  }

  /* ── Página ── */
  function render() {
    if (!alive) return;
    if (S.error) { root.innerHTML = `<div class="inv">${alertBox('err', 'No se pudo abrir la investigación', `<p>${esc(S.error)}</p>`, `<button class="btn btn-sm" onclick="location.reload()">Reintentar</button>`)}</div>`; return; }
    const d = S.seed, rec = S.alts.find(a => a.id === S.recId);
    const studyRec = rec && rec.id === d.recomendadaId;
    const cats = [...new Set(S.alts.map(a => a.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
    const mods = [...new Set(S.alts.map(a => a.modalidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    if (S.cat && !cats.includes(S.cat)) S.cat = '';
    if (S.mod && !mods.includes(S.mod)) S.mod = '';
    const list = filtered();
    const opt = (arr, v, all) => `<option value="">${all}</option>` + arr.map(x => `<option ${x === v ? 'selected' : ''} value="${esc(x)}">${esc(x)}</option>`).join('');

    root.innerHTML = `<div class="inv">
      <header class="inv-head">
        <div>
          <p class="neo-hero-kicker"><span class="dot" aria-hidden="true"></span>Investigación · Proyecto NODO</p>
          <h1>${esc(d.titulo)}</h1>
          <p class="inv-desc">${esc(d.descripcion)}.</p>
          <p class="inv-source">Fuente: «${esc(d.fuente.archivo)}» (extraído el ${esc(d.fuente.extraido)}). ${esc(d.fuente.nota)}</p>
        </div>
        <a class="btn" href="${ctx.base.replace(/\/[^/]+$/, '')}">${ICON.back}<span>Volver a Investigaciones</span></a>
      </header>

      ${rec ? `<section class="inv-rec" aria-labelledby="inv-rec-t">
        <div class="inv-rec-ic" aria-hidden="true">${ICON.star}</div>
        <div>
          <h2 id="inv-rec-t">${studyRec ? 'Opción recomendada según el estudio' : 'Opción marcada como recomendada'}: ${esc(rec.producto)}</h2>
          ${studyRec ? `<p>La recomendación se fundamenta en:</p><ul class="inv-list">${d.motivosRecomendacion.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
            <p class="inv-note">La recomendación considera la viabilidad global. Las alternativas con pigmentos fríos y con microesferas presentan rangos SRI superiores en la tabla (100–105).</p>`
            : `<p class="inv-note">Esta recomendación se cambió en este navegador y no corresponde a la del estudio original (${esc((S.alts.find(a => a.id === d.recomendadaId) || {}).producto || 'vinilo 3M 2080')}).</p>`}
        </div>
      </section>` : `<div style="margin-bottom:16px">${alertBox('info', 'No hay ninguna opción marcada como recomendada', '<p>Usa «Marcar como recomendada» en una tarjeta.</p>')}</div>`}

      <section class="panel toolbar" aria-label="Búsqueda y filtros">
        <div class="search">${ICON.search}<label class="sr-only" for="inv-q">Buscar por producto o categoría</label>
          <input id="inv-q" type="search" placeholder="Buscar por producto o categoría…" value="${esc(S.q)}"></div>
        <label class="sr-only" for="inv-cat">Categoría</label><select id="inv-cat" class="select">${opt(cats, S.cat, 'Categoría: todas')}</select>
        <label class="sr-only" for="inv-mod">Modalidad de aplicación</label><select id="inv-mod" class="select">${opt(mods, S.mod, 'Aplicación: todas')}</select>
        <span class="spacer"></span>
        <button type="button" class="btn btn-primary" data-act="add">${ICON.plus}<span>Agregar alternativa</span></button>
      </section>
      <div class="inv-bar">
        <p class="count" aria-live="polite">Mostrando ${list.length} de ${S.alts.length} alternativas</p>
        <div class="inv-data-actions">
          <button type="button" class="btn btn-sm" data-act="export">${ICON.download}Exportar JSON</button>
          <button type="button" class="btn btn-sm" data-act="import">${ICON.upload}Importar JSON</button>
          ${S.savedAt ? `<button type="button" class="btn btn-sm btn-ghost" data-act="reset">Restaurar datos del estudio</button>` : ''}
          <input type="file" accept="application/json,.json" data-import hidden>
        </div>
      </div>
      <p class="inv-storage">${S.savedAt ? `Con cambios guardados en este navegador (${esc(fmtDate(S.savedAt))}).` : 'Datos originales del estudio.'}
        Los cambios se conservan solo en este navegador y no se comparten automáticamente con otros usuarios; usa «Exportar JSON» para respaldarlos o trasladarlos.</p>

      ${list.length ? `<div class="inv-grid">${list.map(card).join('')}</div>`
        : S.alts.length ? `<div class="state"><h3>Sin resultados</h3><p>Ninguna alternativa coincide con la búsqueda o los filtros.</p><div class="alert-actions"><button class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`
        : `<div class="state"><h3>No hay alternativas</h3><p>Agrega una alternativa o restaura los datos del estudio.</p></div>`}

      <section class="inv-concl panel" aria-labelledby="inv-concl-t">
        <h2 id="inv-concl-t">Conclusiones del estudio</h2>
        <p>Según la investigación, el vinilo de fundición 3M 2080 (Gloss White) es la opción óptima para el proyecto NODO por su viabilidad de aplicación interna, su rapidez y una relación costo–resultado favorable. Los sistemas de pintura en taller ofrecen mayor durabilidad y, con pigmentos fríos o microesferas, rangos SRI superiores, pero dependen de talleres externos y de un proceso manual de alta complejidad.</p>
        <h3>Observaciones pendientes de validar</h3>
        <ul class="inv-list inv-warn">${d.observacionesGenerales.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <details class="inv-orig"><summary>Texto original de las conclusiones</summary><p class="inv-quote">${esc(d.conclusiones).replace(/\n\n/g, '</p><p class="inv-quote">')}</p></details>
        <details class="inv-orig"><summary>Criterios y leyenda del cuadro</summary>
          <div class="table-wrap"><table class="data"><thead><tr><th scope="col">Criterio</th><th scope="col">Descripción</th></tr></thead>
            <tbody>${d.criterios.map(c => `<tr><td><b>${esc(c.nombre)}</b></td><td>${esc(c.descripcion)}</td></tr>`).join('')}</tbody></table></div>
          <div class="table-wrap" style="margin-top:10px"><table class="data"><thead><tr><th scope="col">SRI</th><th scope="col">Durabilidad</th><th scope="col">Ambiental</th><th scope="col">Viabilidad</th></tr></thead>
            <tbody>${d.leyenda.map(l => `<tr><td>${esc(l.sri)}</td><td>${esc(l.durabilidad)}</td><td>${esc(l.ambiental)}</td><td>${esc(l.viabilidad)}</td></tr>`).join('')}</tbody></table></div>
        </details>
      </section>
    </div>`;

    // Fotos de producto: al cargar ocultan la muestra; si fallan, vuelve la muestra ilustrativa.
    root.querySelectorAll('img.inv-photo').forEach(img => {
      const box = img.parentNode;
      const ok = () => box.classList.add('has-photo');
      const bad = () => { box.classList.add('photo-failed'); img.remove(); };
      if (img.complete) { img.naturalWidth ? ok() : bad(); }
      else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', bad, { once: true }); }
    });

    const q = root.querySelector('#inv-q');
    q.addEventListener('input', e => { S.q = e.target.value; const pos = e.target.selectionStart; render(); const n = root.querySelector('#inv-q'); n.focus(); n.setSelectionRange(pos, pos); });
    root.querySelector('#inv-cat').addEventListener('change', e => { S.cat = e.target.value; render(); root.querySelector('#inv-cat').focus(); });
    root.querySelector('#inv-mod').addEventListener('change', e => { S.mod = e.target.value; render(); root.querySelector('#inv-mod').focus(); });
    root.querySelector('[data-import]').addEventListener('change', onImportFile);
  }

  /* ── Formulario ── */
  function openForm(a = null) {
    const v = a || { id: '', categoria: '', producto: '', alias: '', sri: '', durabilidad: 3, ambiental: 3, viabilidad: 3, modalidad: '', tiempo: '', vidaUtil: '',
      ventajas: [], limitaciones: [], materiales: [], costoTotal: '', costoExclusiones: '', costoDesglose: '', rendimiento: '', observaciones: [], muestra: 'neutro' };
    const sel = (name, cur) => `<select id="if-${name}" name="${name}" class="select" style="width:100%">${[1, 2, 3, 4, 5].map(n => `<option ${n === cur ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const mods = [...new Set(S.alts.map(x => x.modalidad).filter(Boolean))];
    const field = (id, label, input, hint = '', full = false, req = false) => `<div class="field ${full ? 'full' : ''}" data-f="${id}"><label for="if-${id}">${label}${req ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<p class="hint">${hint}</p>` : ''}<p class="err"></p></div>`;
    const text = (id, val, ph = '') => `<input id="if-${id}" name="${id}" class="input" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off">`;
    const area = (id, val, rows = 3) => `<textarea id="if-${id}" name="${id}" class="input" rows="${rows}">${esc(val)}</textarea>`;
    const m = openModal({ html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${a ? 'Editar alternativa' : 'Nueva alternativa'}</p><h2 data-modal-title>${a ? esc(a.producto) : 'Agregar alternativa'}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body"><div data-msg></div><div class="form-grid">
        ${field('categoria', 'Categoría', text('categoria', v.categoria, 'Ej. Vinilo de fundición'), '', false, true)}
        ${field('producto', 'Producto', text('producto', v.producto, 'Nombre comercial'), '', false, true)}
        ${field('sri', 'SRI', text('sri', v.sri, 'Ej. 75–80'))}
        ${field('modalidad', 'Modalidad de aplicación', `<input id="if-modalidad" name="modalidad" class="input" list="if-mods" value="${esc(v.modalidad)}"><datalist id="if-mods">${mods.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
        ${field('durabilidad', 'Durabilidad mecánica (1–5)', sel('durabilidad', v.durabilidad))}
        ${field('ambiental', 'Resistencia ambiental (1–5)', sel('ambiental', v.ambiental))}
        ${field('viabilidad', 'Viabilidad de aplicación (1–5)', sel('viabilidad', v.viabilidad))}
        ${field('tiempo', 'Tiempo estimado', text('tiempo', v.tiempo, 'Ej. 2–4 horas'))}
        ${field('vidaUtil', 'Vida útil esperada', text('vidaUtil', v.vidaUtil, 'Ej. 3–5 años'))}
        ${field('rendimiento', 'Rendimiento por lote', text('rendimiento', v.rendimiento, 'Ej. 4–5 maletas'))}
        ${field('costoNivel', 'Clasificación de costo', `<select id="if-costoNivel" name="costoNivel" class="select" style="width:100%"><option value="">Sin clasificar</option>${NIVELES.map(n => `<option ${n === v.costoNivel ? 'selected' : ''}>${n}</option>`).join('')}</select>`, 'Relativa entre las alternativas del estudio.')}
        ${field('costoExclusiones', 'Exclusiones del costo', text('costoExclusiones', v.costoExclusiones, 'Ej. más envío'))}
        ${field('imagenUrl', 'Imagen del producto (enlace)', `<input id="if-imagenUrl" name="imagenUrl" type="url" class="input" value="${esc(v.imagenUrl)}" placeholder="https://…" autocomplete="off"><img class="img-preview" alt="Vista previa de la imagen" referrerpolicy="no-referrer">`,
          'Enlace https a una foto real del producto (de Google Drive sirve el enlace de compartir con acceso «Cualquier persona con el enlace»). Si no carga, se muestra la muestra ilustrativa.', true)}
        ${field('ventajas', 'Ventajas', area('ventajas', v.ventajas.join('\n')), 'Una por línea.', true)}
        ${field('limitaciones', 'Limitaciones', area('limitaciones', v.limitaciones.join('\n')), 'Una por línea.', true)}
        ${field('materiales', 'Materiales requeridos', area('materiales', v.materiales.join('\n')), 'Uno por línea.', true)}
        ${field('observaciones', 'Observaciones y pendientes de validar', area('observaciones', v.observaciones.join('\n')), 'Una por línea. Si hay alguna, la tarjeta muestra «Pendiente de validar».', true)}
        ${field('muestra', 'Muestra ilustrativa', `<select id="if-muestra" name="muestra" class="select" style="width:100%">${[['satinado', 'Pintura satinada'], ['brillo', 'Vinilo brillante'], ['frio', 'Reflectiva (pigmentos fríos)'], ['poroso', 'Textura con microesferas'], ['neutro', 'Neutra']].map(([k, l]) => `<option value="${k}" ${k === v.muestra ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      </div>
      ${a && a.original ? `<p class="hint" style="margin-top:12px">El texto original del Excel se conserva aparte y no se modifica al editar.</p>` : ''}
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Guardar</span></button></div>
    </form>`, initialFocus: '#if-categoria' });
    const form = m.el.querySelector('form');
    let dirty = false;
    const preview = form.querySelector('.img-preview');
    const updatePreview = () => {
      const u = form.elements.imagenUrl.value.trim();
      if (httpsUrl(u)) { preview.src = imgSrc(u); preview.style.display = 'block'; preview.onerror = () => { preview.style.display = 'none'; }; }
      else preview.style.display = 'none';
    };
    updatePreview();
    form.addEventListener('input', e => { dirty = true; if (e.target.name === 'imagenUrl') updatePreview(); });
    m.setCanClose(() => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = n => form.elements[n].value;
      const next = normAlt({
        ...(a || {}), id: a ? a.id : uid(),
        categoria: f('categoria'), producto: f('producto'), sri: f('sri'), modalidad: f('modalidad'), tiempo: f('tiempo'), vidaUtil: f('vidaUtil'),
        rendimiento: f('rendimiento'), costoNivel: f('costoNivel'), imagenUrl: f('imagenUrl'), costoExclusiones: f('costoExclusiones'),
        durabilidad: Number(f('durabilidad')), ambiental: Number(f('ambiental')), viabilidad: Number(f('viabilidad')),
        ventajas: lines(f('ventajas')), limitaciones: lines(f('limitaciones')), materiales: lines(f('materiales')), observaciones: lines(f('observaciones')), muestra: f('muestra')
      });
      const errs = {};
      const rawImg = f('imagenUrl').trim();
      if (rawImg && !httpsUrl(rawImg)) errs.imagenUrl = 'El enlace debe empezar por https://';
      else if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(rawImg)) errs.imagenUrl = 'Es un enlace a una carpeta de Drive. Abre la foto, pulsa «Compartir → Copiar enlace» y pega ese enlace.';
      if (!next.categoria) errs.categoria = 'Escribe la categoría.';
      if (!next.producto) errs.producto = 'Escribe el nombre del producto.';
      form.querySelectorAll('[data-f]').forEach(fl => { const er = errs[fl.dataset.f]; fl.classList.toggle('invalid', !!er); fl.querySelector('.err').textContent = er || ''; });
      if (Object.keys(errs).length) { form.querySelector(`#if-${Object.keys(errs)[0]}`).focus(); return; }
      if (a) S.alts = S.alts.map(x => (x.id === a.id ? next : x)); else S.alts.push(next);
      persist(); dirty = false; m.close('force'); render();
      toast(a ? `Cambios guardados en «${next.producto}» (solo en este navegador).` : `«${next.producto}» se agregó (solo en este navegador).`);
    });
  }

  /* ── Exportar / importar ── */
  function exportJson() {
    const data = { schema: SCHEMA, id: STUDY_ID, titulo: S.seed.titulo, exportado: new Date().toISOString(), recomendadaId: S.recId, alternativas: S.alts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: `investigacion-pinturas-maleta-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Respaldo exportado.');
  }

  async function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('El archivo es demasiado grande (máximo 2 MB).', 'err'); return; }
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.', 'err', 7000); return; }
    const r = validateImport(obj);
    if (!r.ok) { toast('No se importó: ' + r.error, 'err', 8000); return; }
    const ok = await confirmDialog({ title: 'Reemplazar datos', confirm: 'Reemplazar',
      body: `<p>Se reemplazarán las ${S.alts.length} alternativas actuales de este navegador por las ${r.value.alternativas.length} del archivo «${esc(file.name)}».</p>` });
    if (!ok) return;
    S.alts = r.value.alternativas; S.recId = r.value.recomendadaId; S.open.clear();
    persist(); render(); toast('Datos importados.');
  }

  /* ── Eventos ── */
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
    const id = b.dataset.id, a = S.alts.find(x => x.id === id);
    switch (b.dataset.act) {
      case 'toggle': {
        S.open.has(id) ? S.open.delete(id) : S.open.add(id);
        render();
        const nb = root.querySelector(`[data-act="toggle"][data-id="${CSS.escape(id)}"]`); nb && nb.focus();
        break;
      }
      case 'add': openForm(); break;
      case 'edit': if (a) openForm(a); break;
      case 'delete': {
        if (!a) break;
        const ok = await confirmDialog({ title: 'Eliminar alternativa', confirm: 'Eliminar', danger: true,
          body: `<p>Se eliminará «<b>${esc(a.producto)}</b>» de este navegador.${a.id === S.recId ? ' Era la opción recomendada: no quedará ninguna marcada.' : ''}</p><p class="muted" style="margin-top:6px">Puedes recuperarla con «Restaurar datos del estudio» o importando un respaldo.</p>` });
        if (!ok) break;
        S.alts = S.alts.filter(x => x.id !== id); if (S.recId === id) S.recId = null; S.open.delete(id);
        persist(); render(); toast(`«${a.producto}» se eliminó.`);
        break;
      }
      case 'recommend': if (a) { S.recId = id; persist(); render(); toast(`«${a.producto}» es ahora la opción recomendada.`); } break;
      case 'export': exportJson(); break;
      case 'import': root.querySelector('[data-import]').click(); break;
      case 'reset': {
        const ok = await confirmDialog({ title: 'Restaurar datos del estudio', confirm: 'Restaurar', danger: true,
          body: '<p>Se descartarán los cambios guardados en este navegador y se volverán a cargar los datos originales del estudio.</p>' });
        if (!ok) break;
        storage.clear(); S.open.clear(); await load(); toast('Datos del estudio restaurados.');
        break;
      }
      case 'clear': S.q = ''; S.cat = ''; S.mod = ''; render(); break;
    }
  });

  load();
  return () => { alive = false; };
}
