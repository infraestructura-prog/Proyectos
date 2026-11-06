/* Neotropya › Nodos › Investigaciones › Acople universal nodo–moto.
   Datos iniciales: assets/data/investigaciones/acople-nodo-moto.json (motos de referencia y opciones de compra).
   Independiente de Google Sheets y de las tiendas: no sincroniza precios ni crea compras.
   Las tarjetas se pueden editar, agregar y eliminar; los cambios se guardan solo en localStorage de este
   navegador y se respaldan con exportación/importación de JSON. Nunca modifica el archivo de datos. */
import { esc, ICON, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';

const DATA_URL = '/assets/data/investigaciones/acople-nodo-moto.json';
const STORE_KEY = 'ccs-inv-acople-v1';
const OPEN_KEY = 'ccs-inv-acople-abiertos';
const SCHEMA = 'ccs-investigacion-acople-v1';
const STUDY_ID = 'acople-nodo-moto';
const TIPOS = { base: 'Base', maleta: 'Maleta', conjunto: 'Conjunto maleta/base' };
const NIVELES = {
  confirmado: { label: 'Confirmado', title: 'Característica comercial confirmada en la documentación del producto' },
  investigacion: { label: 'Investigación', title: 'Dato recogido durante la investigación; pendiente de verificar en la documentación del producto' },
  hipotesis: { label: 'Hipótesis', title: 'Hipótesis de adaptación al nodo; requiere prueba' },
  pendiente: { label: 'Pendiente', title: 'Dato pendiente de verificar' }
};
const DETALLE = [
  ['tipo', 'Tipo de solución'], ['capacidad', 'Capacidad'], ['mecanismo', 'Mecanismo de fijación y liberación'],
  ['herrajes', 'Placa y herrajes incluidos'], ['instalacion', 'Requisitos de instalación']
];
const httpsUrl = s => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };
const imgOk = s => httpsUrl(s) || /^\/assets\/img\/[\w./-]+\.(jpe?g|png|webp)$/i.test(s || '');
const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const nivel = n => { const x = NIVELES[n] || NIVELES.pendiente; return `<span class="ac-lvl lvl-${NIVELES[n] ? n : 'pendiente'}" title="${esc(x.title)}">${x.label}</span>`; };
const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/* ═════════ Normalización (datos iniciales, guardados e importados) ═════════ */
const str = (v, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strArr = v => (Array.isArray(v) ? v.map(x => str(x, 400)).filter(Boolean).slice(0, 30) : []);
const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
function normFoto(f) {
  if (!f || typeof f !== 'object' || !imgOk(str(f.src, 1000))) return null;
  return { src: str(f.src, 1000), fuente: str(f.fuente, 400), pagina: httpsUrl(f.pagina) ? str(f.pagina, 1000) : '', original: httpsUrl(f.original) ? str(f.original, 1000) : '', consultado: date(f.consultado) };
}
function normMoto(m) {
  return { id: str(m.id, 80), marca: str(m.marca, 60), modelo: str(m.modelo, 80), pendiente: !!m.pendiente, nota: str(m.nota, 600), foto: normFoto(m.foto) };
}
function normProd(p) {
  const det = {};
  DETALLE.forEach(([k]) => { const x = p.detalle && p.detalle[k]; det[k] = x && str(x.valor) ? { valor: str(x.valor), nivel: NIVELES[x.nivel] ? x.nivel : 'pendiente' } : null; });
  const pr = p.precio || {};
  const monto = typeof pr.monto === 'number' || typeof pr.monto === 'string' ? String(pr.monto).trim().slice(0, 20) : '';
  return {
    id: str(p.id, 80), plataforma: str(p.plataforma, 60), asin: str(p.asin, 40), url: httpsUrl(p.url) ? str(p.url, 1000) : '',
    nombre: str(p.nombre, 120), marca: str(p.marca, 60), modelo: str(p.modelo, 80), tipo: TIPOS[p.tipo] ? p.tipo : '',
    capacidadL: Number.isFinite(+p.capacidadL) && +p.capacidadL > 0 ? +p.capacidadL : null,
    imagen: normFoto(p.imagen),
    precio: monto && str(pr.moneda, 10) && date(pr.fecha) ? { monto, moneda: str(pr.moneda, 10), fecha: date(pr.fecha) } : null,
    resumenAcople: str(p.resumenAcople, 400), detalle: det,
    adaptaciones: strArr(p.adaptaciones), pendientes: strArr(p.pendientes),
    fuente: { texto: str(p.fuente && p.fuente.texto, 600), consultado: date(p.fuente && p.fuente.consultado) }
  };
}
export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
  if (obj.schema !== SCHEMA) return { ok: false, error: `El archivo no es un respaldo de esta investigación (se esperaba «${SCHEMA}»).` };
  if (obj.id !== STUDY_ID) return { ok: false, error: 'El respaldo pertenece a otra investigación.' };
  if (!Array.isArray(obj.motos) || !Array.isArray(obj.productos)) return { ok: false, error: 'Faltan las listas de motos o de productos.' };
  if (obj.motos.length > 300 || obj.productos.length > 300) return { ok: false, error: 'El archivo tiene demasiados registros (máximo 300 por lista).' };
  const motos = obj.motos.map(normMoto), productos = obj.productos.map(normProd);
  const bm = motos.findIndex(m => !m.id || !m.modelo); if (bm >= 0) return { ok: false, error: `La moto n.º ${bm + 1} no tiene identificador o modelo.` };
  const bp = productos.findIndex(p => !p.id || !p.nombre); if (bp >= 0) return { ok: false, error: `El producto n.º ${bp + 1} no tiene identificador o nombre.` };
  if (new Set(motos.map(m => m.id)).size !== motos.length || new Set(productos.map(p => p.id)).size !== productos.length) return { ok: false, error: 'Hay registros con el mismo identificador.' };
  return { ok: true, value: { motos, productos } };
}

const storage = {
  read() { try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
  write(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch { /* sin almacenamiento */ } }
};

/* El estado de los desplegables se recuerda durante la navegación (sessionStorage, o memoria si no está disponible). */
let memOpen = null;
const readOpen = () => { try { const v = JSON.parse(sessionStorage.getItem(OPEN_KEY)); if (Array.isArray(v)) return new Set(v); } catch { /* sin almacenamiento */ } return new Set(memOpen || []); };
const saveOpen = set => { memOpen = [...set]; try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(memOpen)); } catch { /* sin almacenamiento */ } };

const placeholder = () => `<div class="ac-ph" role="img" aria-label="Imagen pendiente">${ICON.image}<span>Imagen pendiente</span></div>`;
const photo = (src, alt) => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-ph>` : placeholder());

export function mount(root, ctx) {
  const S = { d: null, motos: [], productos: [], savedAt: null, error: null, q: '', open: readOpen() };
  let alive = true;
  root.innerHTML = `<div class="inv ac"><div class="skeleton" style="height:220px" aria-label="Cargando investigación"></div></div>`;

  // Una imagen que no carga se reemplaza por el marcador «Imagen pendiente».
  root.addEventListener('error', e => { if (e.target.matches && e.target.matches('img[data-ph]')) e.target.outerHTML = placeholder(); }, true);

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      S.d = await res.json();
    } catch (e) { S.error = 'No se pudo cargar el archivo de datos de la investigación (' + e.message + ').'; if (alive) render(); return; }
    // Los datos iniciales solo se usan si no hay una versión guardada en este navegador.
    const saved = storage.read();
    const check = saved ? validateImport({ ...saved, schema: SCHEMA, id: STUDY_ID }) : null;
    if (check && check.ok) { S.motos = check.value.motos; S.productos = check.value.productos; S.savedAt = saved.savedAt || null; }
    else resetToSeed();
    if (alive) render();
  }
  function resetToSeed() {
    S.motos = (S.d.motos || []).map(normMoto); S.productos = (S.d.productos || []).map(normProd); S.savedAt = null;
  }
  function persist() {
    S.savedAt = new Date().toISOString();
    if (!storage.write({ schema: SCHEMA, id: STUDY_ID, savedAt: S.savedAt, motos: S.motos, productos: S.productos }))
      toast('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). Exporta un respaldo.', 'err', 8000);
  }
  const newId = (base, list) => { let id = slug(base) || 'registro', n = 2; const ids = new Set(list.map(x => x.id)); const b = id; while (ids.has(id)) id = `${b}-${n++}`; return id; };

  const motoName = m => [m.marca, m.modelo].filter(Boolean).join(' ');
  function motoList() {
    const q = S.q.trim().toLowerCase();
    return S.motos.filter(m => !q || motoName(m).toLowerCase().includes(q));
  }
  const editBtn = (kind, x, label) => `<button type="button" class="btn btn-sm btn-ghost icon-btn ac-edit" data-edit="${kind}" data-id="${esc(x.id)}" aria-label="Editar ${esc(label)}" title="Editar">${ICON.edit}</button>`;
  function motoCards() {
    const list = motoList();
    if (!list.length) return `<p class="ac-empty">${S.q ? `Ningún modelo coincide con «${esc(S.q)}».` : 'Aún no hay modelos registrados.'}</p>`;
    return `<ul class="ac-grid ac-motos">${list.map(m => `<li class="ac-card ac-moto ${m.pendiente ? 'is-pending' : ''}">
      <div class="ac-img">${m.pendiente && !m.foto ? `<div class="ac-ph" role="img" aria-label="Sin fotografía: modelo por identificar">${ICON.info}<span>Por identificar</span></div>` : photo(m.foto && m.foto.src, `${motoName(m)}, fotografía de referencia`)}</div>
      <div class="ac-body"><div class="ac-top"><p class="ac-brand">${m.marca ? esc(m.marca) : '<span class="ac-muted">Marca por identificar</span>'}</p>${editBtn('moto', m, motoName(m))}</div><h3>${esc(m.modelo)}</h3>
      ${m.pendiente ? '<p class="ac-pending">Referencia pendiente de identificación</p>' : ''}</div></li>`).join('')}</ul>`;
  }

  const tipoLabel = t => TIPOS[t] || 'Por confirmar';
  const codeLabel = p => (/amazon/i.test(p.plataforma) ? 'ASIN' : 'Código');
  const priceHtml = p => (p.precio
    ? `<p class="ac-price"><b>${esc(p.precio.monto)} ${esc(p.precio.moneda)}</b> <span>investigado el ${esc(fmtD(p.precio.fecha))}</span></p>`
    : '<p class="ac-price none">Precio no confirmado</p>');
  function productCards() {
    if (!S.productos.length) return '<p class="ac-empty">Aún no hay opciones registradas.</p>';
    return `<ul class="ac-grid ac-prods">${S.productos.map(p => `<li class="ac-card ac-prod">
      <div class="ac-img">${photo(p.imagen && p.imagen.src, `${p.nombre}, imagen del producto`)}</div>
      <div class="ac-body">
        <div class="ac-top"><p class="ac-brand">${esc([p.marca, p.modelo].filter(Boolean).join(' · ') || 'Marca por confirmar')}</p>${editBtn('prod', p, p.nombre)}</div><h3>${esc(p.nombre)}</h3>
        <dl class="ac-facts"><div><dt>Tipo</dt><dd>${esc(tipoLabel(p.tipo))}</dd></div>${p.capacidadL ? `<div><dt>Capacidad</dt><dd>${esc(String(p.capacidadL))} L</dd></div>` : ''}${p.plataforma ? `<div><dt>Tienda</dt><dd>${esc(p.plataforma)}</dd></div>` : ''}</dl>
        <p class="ac-sum">${esc(p.resumenAcople || 'Sistema de acople por documentar.')}</p>
        ${priceHtml(p)}
        <div class="ac-actions">
          ${p.url ? `<a class="btn btn-sm btn-primary" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(p.plataforma || 'la tienda')}<span class="sr-only"> (${esc(p.nombre)}, se abre en otra pestaña)</span></a>` : ''}
          <button type="button" class="btn btn-sm" data-detail="${esc(p.id)}">Ver detalles<span class="sr-only"> de ${esc(p.nombre)}</span></button>
        </div>
      </div></li>`).join('')}</ul>`;
  }

  function section(id, title, desc, count, unit, inner) {
    const open = S.open.has(id);
    return `<section class="ac-acc ${open ? 'is-open' : ''}" data-acc="${id}">
      <h2 class="ac-acc-h"><button type="button" class="ac-acc-btn" aria-expanded="${open}" aria-controls="ac-p-${id}" id="ac-b-${id}" data-toggle="${id}">
        <span class="ac-acc-txt"><span class="ac-acc-title">${esc(title)}</span><span class="ac-acc-desc">${esc(desc)}</span></span>
        <span class="ac-count">${count} ${unit}</span>
        <span class="ac-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
      </button></h2>
      <div class="ac-acc-panel" id="ac-p-${id}" role="region" aria-labelledby="ac-b-${id}" ${open ? '' : 'hidden'}>${inner}</div>
    </section>`;
  }

  function render() {
    if (S.error) { root.innerHTML = `<div class="inv ac">${alertBox('err', 'No se pudo abrir la investigación', `<p>${esc(S.error)}</p>`, `<button class="btn btn-sm" onclick="location.reload()">Reintentar</button>`)}</div>`; return; }
    const d = S.d, nm = S.motos.length, np = S.productos.length;
    const soloAmazon = S.productos.every(p => /amazon/i.test(p.plataforma));
    root.innerHTML = `<div class="inv ac">
      <header class="inv-head">
        <div>
          <p class="neo-hero-kicker"><span class="dot" aria-hidden="true"></span>Investigación · Proyecto NODO</p>
          <h1>${esc(d.titulo)}</h1>
          <p class="inv-desc">${esc(d.descripcion)}.</p>
          ${(d.contexto || []).map(t => `<p class="ac-ctx">${esc(t)}</p>`).join('')}
          ${d.fuente ? `<p class="inv-source">Fuente: ${httpsUrl(d.fuente.url) ? `<a href="${esc(d.fuente.url)}" target="_blank" rel="noopener noreferrer">${esc(d.fuente.titulo)}</a>` : esc(d.fuente.titulo)}. ${esc(d.fuente.nota || '')}</p>` : ''}
        </div>
        <a class="btn" href="${ctx.base.replace(/\/[^/]+$/, '')}">${ICON.back}<span>Volver a Investigaciones</span></a>
      </header>
      <div class="inv-bar">
        <p class="inv-storage" style="margin:0">${S.savedAt ? `Con cambios guardados en este navegador (${esc(fmtDate(S.savedAt))}). No se comparten con otros equipos: usa «Exportar JSON» para respaldarlos.` : 'Datos originales de la investigación.'}</p>
        <div class="inv-data-actions">
          <button type="button" class="btn btn-sm" data-act="export">${ICON.download}Exportar JSON</button>
          <button type="button" class="btn btn-sm" data-act="import">${ICON.upload}Importar JSON</button>
          ${S.savedAt ? '<button type="button" class="btn btn-sm btn-ghost" data-act="reset">Restaurar datos de la investigación</button>' : ''}
          <input type="file" accept="application/json,.json" data-import hidden>
        </div>
      </div>
      ${section('motos', 'Modelos de referencia del mercado venezolano', 'Motocicletas consideradas para medir y evaluar el montaje del nodo.', nm, nm === 1 ? 'modelo' : 'modelos', `
        <p class="ac-note">${esc(d.notas && d.notas.motos || '')}</p>
        <div class="ac-tools"><div class="search">${ICON.search}<label class="sr-only" for="ac-q">Buscar por marca o modelo</label>
          <input id="ac-q" type="search" placeholder="Buscar por marca o modelo" value="${esc(S.q)}" autocomplete="off"></div>
          <p class="count" data-mcount aria-live="polite"></p>
          <button type="button" class="btn btn-sm" data-act="add-moto">${ICON.plus}Agregar modelo</button></div>
        <div data-motos>${motoCards()}</div>`)}
      ${section('productos', soloAmazon ? 'Bases y maletas disponibles en Amazon' : 'Bases y maletas: opciones de compra', 'Soluciones comerciales de montaje identificadas en la investigación.', np, np === 1 ? 'opción' : 'opciones', `
        <p class="ac-note">${esc(d.notas && d.notas.productos || '')}</p>
        <p class="ac-note">Los precios no se actualizan automáticamente: solo se muestran si se investigaron con moneda y fecha.</p>
        <div class="ac-tools"><button type="button" class="btn btn-sm" data-act="add-prod">${ICON.plus}Agregar opción de compra</button></div>
        ${productCards()}`)}
    </div>`;
    updateCount();
    root.querySelector('[data-import]').addEventListener('change', onImport);
  }

  function updateCount() {
    const el = root.querySelector('[data-mcount]'); if (!el) return;
    el.textContent = S.q ? `${motoList().length} de ${S.motos.length} modelos` : '';
  }

  function toggle(id) {
    const sec = root.querySelector(`[data-acc="${id}"]`); if (!sec) return;
    const open = !S.open.has(id);
    open ? S.open.add(id) : S.open.delete(id); saveOpen(S.open);
    sec.classList.toggle('is-open', open);
    sec.querySelector('.ac-acc-btn').setAttribute('aria-expanded', String(open));
    sec.querySelector('.ac-acc-panel').hidden = !open;
  }
  const openSection = id => { if (!S.open.has(id)) { S.open.add(id); saveOpen(S.open); } };

  /* ── Detalle del producto ── */
  function openDetail(p) {
    const row = (label, item, fallback = 'Sin datos.') => `<div class="ac-row"><dt>${label}</dt><dd>${item ? `${esc(item.valor)} ${nivel(item.nivel)}` : `${esc(fallback)} ${nivel('pendiente')}`}</dd></div>`;
    const img = p.imagen && p.imagen.src;
    const m = openModal({ size: 'pp-wide', html: `
      <div class="modal-head"><div><p class="kicker">${esc(p.plataforma || 'Tienda por confirmar')} · ${esc(tipoLabel(p.tipo))}</p><h2 data-modal-title>${esc(p.nombre)}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body ac ac-detail">
        <div class="ac-dimg ${img ? '' : 'is-empty'}">${img ? `<img src="${esc(img)}" alt="${esc(p.nombre)}, imagen ampliada" data-ph>` : placeholder()}</div>
        ${p.imagen && p.imagen.fuente ? `<p class="ac-muted" style="margin:-8px 0 12px">Imagen: ${esc(p.imagen.fuente)}${p.imagen.consultado ? ` (consultada el ${esc(fmtD(p.imagen.consultado))})` : ''}</p>` : ''}
        <ul class="ac-legend" aria-label="Leyenda de los datos">${Object.keys(NIVELES).map(k => `<li>${nivel(k)} <span>${esc(NIVELES[k].title)}</span></li>`).join('')}</ul>
        <dl class="ac-rows">
          <div class="ac-row"><dt>Marca y modelo</dt><dd>${esc([p.marca, p.modelo].filter(Boolean).join(' · ') || 'Por confirmar')}</dd></div>
          <div class="ac-row"><dt>Enlace y ${codeLabel(p)}</dt><dd>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a>` : 'Sin enlace'}${p.asin ? ` · ${codeLabel(p)} <span class="mono">${esc(p.asin)}</span>` : ''}</dd></div>
          ${DETALLE.map(([k, label]) => row(label, p.detalle[k], k === 'herrajes' ? 'No confirmado.' : 'Sin datos.')).join('')}
          <div class="ac-row"><dt>Precio</dt><dd>${p.precio ? `${esc(p.precio.monto)} ${esc(p.precio.moneda)} · investigado el ${esc(fmtD(p.precio.fecha))}` : 'No confirmado.'}</dd></div>
        </dl>
        <section class="sec"><h3 class="sec-title">Posibles adaptaciones para la maleta plástica actual ${nivel('hipotesis')}</h3>
          ${p.adaptaciones.length ? `<ul class="ac-list">${p.adaptaciones.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="ac-muted">Sin hipótesis registradas.</p>'}
          <p class="ac-muted">La maleta actual es de unos 50 L (45 × 40 × 35 cm) con cerradura superior. Una maleta de otra capacidad no es una sustitución directa: el espacio útil, la distribución del equipo, el peso y el anclaje necesitan evaluación.</p></section>
        <section class="sec"><h3 class="sec-title">Datos pendientes de verificar ${nivel('pendiente')}</h3>
          ${p.pendientes.length ? `<ul class="ac-list">${p.pendientes.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="ac-muted">Ninguno.</p>'}</section>
        <section class="sec"><h3 class="sec-title">Fuente</h3><p>${esc(p.fuente.texto || 'Sin fuente registrada.')}${p.fuente.consultado ? ` Consultado el ${esc(fmtD(p.fuente.consultado))}.` : ''}</p></section>
        ${alertBox('info', 'Compatibilidad no garantizada', `<p>${esc(S.d.notas && S.d.notas.productos || '')}</p>`)}
      </div>
      <div class="modal-foot"><div class="left"><button type="button" class="btn" data-x="edit">${ICON.edit}Editar</button></div>
        ${p.url ? `<a class="btn btn-primary" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(p.plataforma || 'la tienda')}</a>` : ''}<button type="button" class="btn" data-close>Cerrar</button></div>` });
    m.el.querySelector('[data-x="edit"]').addEventListener('click', () => { m.close('force'); setTimeout(() => editProd(p), 0); });
  }

  /* ── Formularios ── */
  const fld = (id, label, val, o = {}) => `<div class="field ${o.full ? 'full' : ''}" data-f="${id}"><label for="af-${id}">${label}${o.req ? ' <span class="req">*</span>' : ''}</label>
    ${o.area ? `<textarea id="af-${id}" name="${id}" class="input" rows="${o.rows || 3}">${esc(val)}</textarea>`
      : `<input id="af-${id}" name="${id}" class="input" type="${o.type || 'text'}" value="${esc(val)}" ${o.attrs || ''} autocomplete="off">`}
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}<p class="err"></p></div>`;
  const nivelSel = (id, val) => `<select id="af-${id}" name="${id}" class="select" aria-label="Nivel del dato">${Object.keys(NIVELES).map(k => `<option value="${k}" ${k === val ? 'selected' : ''}>${NIVELES[k].label}</option>`).join('')}</select>`;

  /* Abre un formulario, valida con check(get) → {errores} y guarda con save(get). */
  function formModal({ kicker, title, body, isNew, onDelete, check, save }) {
    const m = openModal({ size: 'pp-wide', html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${esc(kicker)}</p><h2 data-modal-title>${esc(title)}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body ac">${body}</div>
      <div class="modal-foot">${isNew ? '' : `<div class="left"><button type="button" class="btn btn-danger" data-x="del">${ICON.trash}Eliminar</button></div>`}
        <button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Guardar</span></button></div>
    </form>`, initialFocus: '.modal-body input' });
    const form = m.el.querySelector('form');
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    m.setCanClose(() => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'));
    const get = n => { const el = form.elements[n]; if (!el) return ''; return el.type === 'checkbox' ? (el.checked ? '1' : '') : String(el.value).trim(); };
    if (!isNew) form.querySelector('[data-x="del"]').addEventListener('click', async () => { if (await onDelete()) { dirty = false; m.close('force'); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const errs = check(get);
      form.querySelectorAll('.field[data-f]').forEach(fl => { const er = errs[fl.dataset.f]; fl.classList.toggle('invalid', !!er); const el = fl.querySelector('.err'); if (el) el.textContent = er || ''; });
      const first = Object.keys(errs)[0];
      if (first) { const el = form.querySelector(`[name="${first}"]`); if (el) el.focus(); return; }
      save(get); persist(); dirty = false; m.close('force'); render();
    });
  }
  const checkImg = (get, errs, key = 'fotoSrc') => { const v = get(key); if (v && !imgOk(v)) errs[key] = 'Usa un enlace https:// a la imagen (o una ruta /assets/img/… del proyecto).'; };
  const checkUrl = (get, errs, key) => { const v = get(key); if (v && !httpsUrl(v)) errs[key] = 'El enlace debe empezar por https://.'; };
  const fotoFrom = (get, prev) => (get('fotoSrc') ? { src: get('fotoSrc'), fuente: get('fotoFuente'), pagina: httpsUrl(get('fotoPagina')) ? get('fotoPagina') : '', original: prev && prev.src === get('fotoSrc') ? prev.original : '', consultado: date(get('fotoFecha')) } : null);
  const fotoFields = f => `
    ${fld('fotoSrc', 'Enlace de la imagen', f ? f.src : '', { full: true, hint: 'Enlace directo https:// a la imagen. Vacío = «Imagen pendiente». Usa una foto del modelo exacto, no de uno parecido.' })}
    ${fld('fotoFuente', 'Fuente de la imagen', f ? f.fuente : '', { hint: 'Quién la publica (fabricante, tienda…).' })}
    ${fld('fotoPagina', 'Página de origen', f ? f.pagina : '', { hint: 'https://…' })}
    ${fld('fotoFecha', 'Fecha de consulta', f ? f.consultado : '', { type: 'date' })}`;

  function editMoto(m0) {
    const isNew = !m0, m = m0 || normMoto({ id: '', modelo: '' });
    formModal({ kicker: isNew ? 'Nuevo modelo de referencia' : 'Editar modelo', title: isNew ? 'Agregar modelo' : motoName(m), isNew,
      body: `<div class="form-grid">
        ${fld('marca', 'Marca', m.marca)}
        ${fld('modelo', 'Modelo', m.modelo, { req: true, hint: 'Nombre exacto del modelo o versión, sin sustituirlo por uno parecido.' })}
        <label class="check full"><input type="checkbox" name="pendiente" ${m.pendiente ? 'checked' : ''}> Referencia pendiente de identificación</label>
        ${fld('nota', 'Nota', m.nota, { full: true, area: true, rows: 2, hint: 'No se muestra en la tarjeta.' })}
        ${fotoFields(m.foto)}
      </div>`,
      onDelete: async () => {
        const ok = await confirmDialog({ title: 'Eliminar modelo', confirm: 'Eliminar', danger: true, body: `<p>Se eliminará «<b>${esc(motoName(m))}</b>» de este navegador. Puedes recuperarlo con «Restaurar datos de la investigación» o importando un respaldo.</p>` });
        if (ok) { S.motos = S.motos.filter(x => x.id !== m.id); persist(); render(); toast('Modelo eliminado.'); }
        return ok;
      },
      check: get => { const e = {}; if (!get('modelo')) e.modelo = 'Escribe el modelo.'; checkImg(get, e); checkUrl(get, e, 'fotoPagina'); return e; },
      save: get => {
        const pend = !!get('pendiente');
        const nm = normMoto({ id: m.id || newId(`${get('marca')} ${get('modelo')}`, S.motos), marca: get('marca'), modelo: get('modelo'), pendiente: pend, nota: get('nota'), foto: fotoFrom(get, m.foto) });
        if (isNew) S.motos.push(nm); else S.motos[S.motos.findIndex(x => x.id === m.id)] = nm;
        openSection('motos'); toast(isNew ? 'Modelo agregado.' : 'Cambios guardados.');
      }
    });
  }

  function editProd(p0) {
    const isNew = !p0, p = p0 || normProd({ id: '', nombre: '', plataforma: 'Amazon' });
    const det = k => p.detalle[k] || { valor: '', nivel: k === 'instalacion' || k === 'herrajes' ? 'pendiente' : 'investigacion' };
    formModal({ kicker: isNew ? 'Nueva opción de compra' : 'Editar opción de compra', title: isNew ? 'Agregar base o maleta' : p.nombre, isNew,
      body: `<div class="form-grid">
        ${fld('nombre', 'Nombre', p.nombre, { req: true })}
        <div class="field" data-f="tipo"><label for="af-tipo">Tipo</label><select id="af-tipo" name="tipo" class="select" style="width:100%"><option value="">Por confirmar</option>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${k === p.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        ${fld('marca', 'Marca', p.marca)}
        ${fld('modelo', 'Modelo', p.modelo)}
        ${fld('plataforma', 'Tienda o plataforma', p.plataforma, { hint: 'Por ejemplo «Amazon». Solo enlaces reales de esa tienda.' })}
        ${fld('asin', 'ASIN o código del producto', p.asin)}
        ${fld('url', 'Enlace al producto', p.url, { full: true, hint: 'https://… El botón «Ver en …» abre este enlace.' })}
        ${fld('capacidadL', 'Capacidad (litros)', p.capacidadL || '', { type: 'number', attrs: 'min="0" step="0.5" inputmode="decimal"', hint: 'Vacío si no corresponde (por ejemplo, una base sola).' })}
        ${fld('resumen', 'Resumen del sistema de acople', p.resumenAcople, { full: true, area: true, rows: 2 })}
        <fieldset class="field full"><legend>Detalle técnico y nivel de cada dato</legend>
          <div class="ac-detform">${DETALLE.map(([k, label]) => `<div class="ac-detrow" data-f="d_${k}"><label for="af-d_${k}">${label}</label>
            <input id="af-d_${k}" name="d_${k}" class="input" value="${esc(det(k).valor)}" autocomplete="off">${nivelSel(`n_${k}`, det(k).nivel)}</div>`).join('')}</div>
          <p class="hint">Confirmado = ficha comercial del producto · Investigación = dato recogido sin verificar · Hipótesis = adaptación al nodo · Pendiente = por verificar.</p></fieldset>
        ${fld('adaptaciones', 'Posibles adaptaciones para la maleta actual (hipótesis)', p.adaptaciones.join('\n'), { full: true, area: true, hint: 'Una por línea.' })}
        ${fld('pendientes', 'Datos pendientes de verificar', p.pendientes.join('\n'), { full: true, area: true, hint: 'Uno por línea.' })}
        ${fld('pMonto', 'Precio investigado', p.precio ? p.precio.monto : '', { hint: 'Solo se muestra con moneda y fecha.' })}
        ${fld('pMoneda', 'Moneda', p.precio ? p.precio.moneda : '', { hint: 'USD, Bs, EUR…' })}
        ${fld('pFecha', 'Fecha del precio', p.precio ? p.precio.fecha : '', { type: 'date' })}
        ${fld('fuente', 'Fuente de los datos', p.fuente.texto, { full: true, area: true, rows: 2 })}
        ${fld('fuenteFecha', 'Fecha de consulta', p.fuente.consultado, { type: 'date' })}
        ${fotoFields(p.imagen)}
      </div>`,
      onDelete: async () => {
        const ok = await confirmDialog({ title: 'Eliminar opción de compra', confirm: 'Eliminar', danger: true, body: `<p>Se eliminará «<b>${esc(p.nombre)}</b>» de este navegador. Puedes recuperarla con «Restaurar datos de la investigación» o importando un respaldo.</p>` });
        if (ok) { S.productos = S.productos.filter(x => x.id !== p.id); persist(); render(); toast('Opción eliminada.'); }
        return ok;
      },
      check: get => {
        const e = {};
        if (!get('nombre')) e.nombre = 'Escribe el nombre del producto.';
        checkUrl(get, e, 'url'); checkImg(get, e); checkUrl(get, e, 'fotoPagina');
        const c = get('capacidadL'); if (c && !(+c > 0)) e.capacidadL = 'Indica un número mayor que 0 o déjalo vacío.';
        const pr = ['pMonto', 'pMoneda', 'pFecha'].map(get);
        if (pr.some(Boolean) && !pr.every(Boolean)) e[['pMonto', 'pMoneda', 'pFecha'][pr.findIndex(x => !x)]] = 'Para registrar un precio hacen falta importe, moneda y fecha.';
        return e;
      },
      save: get => {
        const detalle = {}; DETALLE.forEach(([k]) => { detalle[k] = { valor: get(`d_${k}`), nivel: get(`n_${k}`) }; });
        const np = normProd({
          id: p.id || newId(get('nombre'), S.productos), plataforma: get('plataforma'), asin: get('asin'), url: get('url'),
          nombre: get('nombre'), marca: get('marca'), modelo: get('modelo'), tipo: get('tipo'), capacidadL: get('capacidadL'),
          imagen: fotoFrom(get, p.imagen), precio: { monto: get('pMonto'), moneda: get('pMoneda'), fecha: get('pFecha') },
          resumenAcople: get('resumen'), detalle, adaptaciones: lines(get('adaptaciones')), pendientes: lines(get('pendientes')),
          fuente: { texto: get('fuente'), consultado: get('fuenteFecha') }
        });
        if (isNew) S.productos.push(np); else S.productos[S.productos.findIndex(x => x.id === p.id)] = np;
        openSection('productos'); toast(isNew ? 'Opción de compra agregada.' : 'Cambios guardados.');
      }
    });
  }

  /* ── Respaldo ── */
  function exportJson() {
    const blob = new Blob([JSON.stringify({ schema: SCHEMA, id: STUDY_ID, exportado: new Date().toISOString(), motos: S.motos, productos: S.productos }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), d = new Date();
    const a = Object.assign(document.createElement('a'), { href: url, download: `investigacion-acople-nodo-moto-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Respaldo exportado.');
  }
  async function onImport(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('El archivo es demasiado grande (máximo 2 MB).', 'err'); return; }
    let obj; try { obj = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.', 'err', 7000); return; }
    const r = validateImport(obj);
    if (!r.ok) { toast('No se importó: ' + r.error, 'err', 9000); return; }
    const ok = await confirmDialog({ title: 'Importar respaldo', confirm: 'Reemplazar datos', danger: true,
      body: `<p>El archivo tiene ${r.value.motos.length} modelo${r.value.motos.length === 1 ? '' : 's'} y ${r.value.productos.length} opci${r.value.productos.length === 1 ? 'ón' : 'ones'} de compra. Reemplazará los datos de esta investigación en este navegador (hoy: ${S.motos.length} y ${S.productos.length}).</p>` });
    if (!ok) return;
    S.motos = r.value.motos; S.productos = r.value.productos; persist(); render(); toast('Respaldo importado.');
  }

  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-toggle]'); if (t) { toggle(t.dataset.toggle); return; }
    const b = e.target.closest('[data-detail]'); if (b) { const p = S.productos.find(x => x.id === b.dataset.detail); if (p) openDetail(p); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { if (ed.dataset.edit === 'moto') { const m = S.motos.find(x => x.id === ed.dataset.id); if (m) editMoto(m); } else { const p = S.productos.find(x => x.id === ed.dataset.id); if (p) editProd(p); } return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    switch (a.dataset.act) {
      case 'add-moto': editMoto(null); break;
      case 'add-prod': editProd(null); break;
      case 'export': exportJson(); break;
      case 'import': root.querySelector('[data-import]').click(); break;
      case 'reset': {
        const ok = await confirmDialog({ title: 'Restaurar datos de la investigación', confirm: 'Restaurar', danger: true,
          body: '<p>Se descartarán los cambios guardados en este navegador (ediciones, altas y bajas) y se volverá a los datos originales. Exporta antes un respaldo si los necesitas.</p>' });
        if (ok) { storage.clear(); resetToSeed(); render(); toast('Datos originales restaurados.'); }
        break;
      }
    }
  });
  root.addEventListener('input', e => {
    if (e.target.id !== 'ac-q') return;
    S.q = e.target.value;
    root.querySelector('[data-motos]').innerHTML = motoCards();
    updateCount();
  });

  load();
  return () => { alive = false; };
}
