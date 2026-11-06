/* Neotropya › Nodos › Investigaciones › Acople universal nodo–moto.
   Datos: assets/data/investigaciones/acople-nodo-moto.json (motos de referencia y opciones de Amazon).
   Solo consulta: independiente de Google Sheets y de las tiendas; no sincroniza precios ni crea compras.
   Para ampliar, se agregan elementos a «motos» o «productos» en el JSON sin tocar este módulo. */
import { esc, ICON, openModal, alertBox } from '../ui.js';

const DATA_URL = '/assets/data/investigaciones/acople-nodo-moto.json';
const OPEN_KEY = 'ccs-inv-acople-abiertos';
const TIPOS = { base: 'Base', maleta: 'Maleta', conjunto: 'Conjunto maleta/base' };
const NIVELES = {
  confirmado: { label: 'Confirmado', title: 'Característica comercial confirmada en la documentación del producto' },
  investigacion: { label: 'Investigación', title: 'Dato recogido durante la investigación; pendiente de verificar en la documentación del producto' },
  hipotesis: { label: 'Hipótesis', title: 'Hipótesis de adaptación al nodo; requiere prueba' },
  pendiente: { label: 'Pendiente', title: 'Dato pendiente de verificar' }
};
const httpsUrl = s => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };
const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const nivel = n => { const x = NIVELES[n] || NIVELES.pendiente; return `<span class="ac-lvl lvl-${NIVELES[n] ? n : 'pendiente'}" title="${esc(x.title)}">${x.label}</span>`; };

/* El estado de los desplegables se recuerda durante la navegación (sessionStorage, o memoria si no está disponible). */
let memOpen = null;
const readOpen = () => { try { const v = JSON.parse(sessionStorage.getItem(OPEN_KEY)); if (Array.isArray(v)) return new Set(v); } catch { /* sin almacenamiento */ } return new Set(memOpen || []); };
const saveOpen = set => { memOpen = [...set]; try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(memOpen)); } catch { /* sin almacenamiento */ } };

const placeholder = () => `<div class="ac-ph" role="img" aria-label="Imagen pendiente">${ICON.image}<span>Imagen pendiente</span></div>`;
const photo = (src, alt) => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-ph>` : placeholder());

export function mount(root, ctx) {
  const S = { d: null, error: null, q: '', open: readOpen() };
  let alive = true;
  root.innerHTML = `<div class="inv ac"><div class="skeleton" style="height:220px" aria-label="Cargando investigación"></div></div>`;

  // Una imagen que no carga se reemplaza por el marcador «Imagen pendiente».
  root.addEventListener('error', e => { if (e.target.matches && e.target.matches('img[data-ph]')) e.target.outerHTML = placeholder(); }, true);

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      S.d = await res.json();
      S.d.motos = Array.isArray(S.d.motos) ? S.d.motos : [];
      S.d.productos = Array.isArray(S.d.productos) ? S.d.productos : [];
    } catch (e) { S.error = 'No se pudo cargar el archivo de datos de la investigación (' + e.message + ').'; }
    if (alive) render();
  }

  const motoName = m => [m.marca, m.modelo].filter(Boolean).join(' ');
  function motoList() {
    const q = S.q.trim().toLowerCase();
    return S.d.motos.filter(m => !q || motoName(m).toLowerCase().includes(q));
  }
  function motoCards() {
    const list = motoList();
    if (!list.length) return `<p class="ac-empty">Ningún modelo coincide con «${esc(S.q)}».</p>`;
    return `<ul class="ac-grid ac-motos">${list.map(m => `<li class="ac-card ac-moto ${m.pendiente ? 'is-pending' : ''}">
      <div class="ac-img">${m.pendiente ? `<div class="ac-ph" role="img" aria-label="Sin fotografía: modelo por identificar">${ICON.info}<span>Por identificar</span></div>` : photo(m.foto && m.foto.src, `${motoName(m)}, fotografía de referencia`)}</div>
      <div class="ac-body"><p class="ac-brand">${m.marca ? esc(m.marca) : '<span class="ac-muted">Marca por identificar</span>'}</p><h3>${esc(m.modelo)}</h3>
      ${m.pendiente ? '<p class="ac-pending">Referencia pendiente de identificación</p>' : ''}</div></li>`).join('')}</ul>`;
  }

  const tipoLabel = t => TIPOS[t] || 'Por confirmar';
  const priceHtml = p => (p.precio && p.precio.monto && p.precio.moneda && p.precio.fecha
    ? `<p class="ac-price"><b>${esc(String(p.precio.monto))} ${esc(p.precio.moneda)}</b> <span>investigado el ${esc(fmtD(p.precio.fecha) || p.precio.fecha)}</span></p>`
    : '<p class="ac-price none">Precio no confirmado</p>');
  function productCards() {
    if (!S.d.productos.length) return '<p class="ac-empty">Aún no hay productos registrados.</p>';
    return `<ul class="ac-grid ac-prods">${S.d.productos.map(p => `<li class="ac-card ac-prod">
      <div class="ac-img">${photo(p.imagen && p.imagen.src, `${p.nombre}, imagen del producto`)}</div>
      <div class="ac-body">
        <p class="ac-brand">${esc(p.marca)} · ${esc(p.modelo)}</p><h3>${esc(p.nombre)}</h3>
        <dl class="ac-facts"><div><dt>Tipo</dt><dd>${esc(tipoLabel(p.tipo))}</dd></div>${p.capacidadL ? `<div><dt>Capacidad</dt><dd>${esc(String(p.capacidadL))} L</dd></div>` : ''}</dl>
        <p class="ac-sum">${esc(p.resumenAcople || 'Sistema de acople por documentar.')}</p>
        ${priceHtml(p)}
        <div class="ac-actions">
          ${httpsUrl(p.url) ? `<a class="btn btn-sm btn-primary" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(p.plataforma || 'la tienda')}<span class="sr-only"> (${esc(p.nombre)}, se abre en otra pestaña)</span></a>` : ''}
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
    const d = S.d, nm = d.motos.length, np = d.productos.length;
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
      ${section('motos', 'Modelos de referencia del mercado venezolano', 'Motocicletas consideradas para medir y evaluar el montaje del nodo.', nm, nm === 1 ? 'modelo' : 'modelos', `
        <p class="ac-note">${esc(d.notas && d.notas.motos || '')}</p>
        <div class="ac-tools"><div class="search">${ICON.search}<label class="sr-only" for="ac-q">Buscar por marca o modelo</label>
          <input id="ac-q" type="search" placeholder="Buscar por marca o modelo" value="${esc(S.q)}" autocomplete="off"></div>
          <p class="count" data-mcount aria-live="polite"></p></div>
        <div data-motos>${motoCards()}</div>`)}
      ${section('productos', 'Bases y maletas disponibles en Amazon', 'Soluciones comerciales de montaje identificadas en la investigación.', np, np === 1 ? 'producto' : 'productos', `
        <p class="ac-note">${esc(d.notas && d.notas.productos || '')}</p>
        <p class="ac-note">Los precios no se actualizan automáticamente: solo se muestran si se investigaron con moneda y fecha.</p>
        ${productCards()}`)}
    </div>`;
    updateCount();
  }

  function updateCount() {
    const el = root.querySelector('[data-mcount]'); if (!el) return;
    const n = motoList().length;
    el.textContent = S.q ? `${n} de ${S.d.motos.length} modelos` : '';
  }

  function toggle(id) {
    const sec = root.querySelector(`[data-acc="${id}"]`); if (!sec) return;
    const open = !S.open.has(id);
    open ? S.open.add(id) : S.open.delete(id); saveOpen(S.open);
    sec.classList.toggle('is-open', open);
    sec.querySelector('.ac-acc-btn').setAttribute('aria-expanded', String(open));
    sec.querySelector('.ac-acc-panel').hidden = !open;
  }

  /* ── Detalle del producto ── */
  function openDetail(p) {
    const dt = p.detalle || {};
    const row = (label, item, fallback = 'Sin datos.') => `<div class="ac-row"><dt>${label}</dt><dd>${item && item.valor ? `${esc(item.valor)} ${nivel(item.nivel)}` : `${esc(fallback)} ${nivel('pendiente')}`}</dd></div>`;
    const img = p.imagen && p.imagen.src;
    openModal({ size: 'pp-wide', html: `
      <div class="modal-head"><div><p class="kicker">${esc(p.plataforma || '')} · ${esc(tipoLabel(p.tipo))}</p><h2 data-modal-title>${esc(p.nombre)}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body ac ac-detail">
        <div class="ac-dimg ${img ? '' : 'is-empty'}">${img ? `<img src="${esc(img)}" alt="${esc(p.nombre)}, imagen ampliada" data-ph>` : placeholder()}</div>
        <ul class="ac-legend" aria-label="Leyenda de los datos">${Object.keys(NIVELES).map(k => `<li>${nivel(k)} <span>${esc(NIVELES[k].title)}</span></li>`).join('')}</ul>
        <dl class="ac-rows">
          <div class="ac-row"><dt>Marca y modelo</dt><dd>${esc(p.marca)} · ${esc(p.modelo)}</dd></div>
          <div class="ac-row"><dt>Enlace y ASIN</dt><dd>${httpsUrl(p.url) ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a>` : 'Sin enlace'}${p.asin ? ` · ASIN <span class="mono">${esc(p.asin)}</span>` : ''}</dd></div>
          ${row('Tipo de solución', dt.tipo)}
          ${row('Capacidad', dt.capacidad)}
          ${row('Mecanismo de fijación y liberación', dt.mecanismo)}
          ${row('Placa y herrajes incluidos', dt.herrajes, 'No confirmado.')}
          ${row('Requisitos de instalación', dt.instalacion)}
          <div class="ac-row"><dt>Precio</dt><dd>${p.precio && p.precio.monto && p.precio.moneda && p.precio.fecha ? `${esc(String(p.precio.monto))} ${esc(p.precio.moneda)} · investigado el ${esc(fmtD(p.precio.fecha) || p.precio.fecha)}` : 'No confirmado.'}</dd></div>
        </dl>
        <section class="sec"><h3 class="sec-title">Posibles adaptaciones para la maleta plástica actual ${nivel('hipotesis')}</h3>
          ${(p.adaptaciones || []).length ? `<ul class="ac-list">${p.adaptaciones.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="ac-muted">Sin hipótesis registradas.</p>'}
          <p class="ac-muted">La maleta actual es de unos 50 L (45 × 40 × 35 cm) con cerradura superior. Una maleta de 45 L no es una sustitución directa: el espacio útil, la distribución del equipo, el peso y el anclaje necesitan evaluación.</p></section>
        <section class="sec"><h3 class="sec-title">Datos pendientes de verificar ${nivel('pendiente')}</h3>
          ${(p.pendientes || []).length ? `<ul class="ac-list">${p.pendientes.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="ac-muted">Ninguno.</p>'}</section>
        <section class="sec"><h3 class="sec-title">Fuente</h3><p>${esc(p.fuente && p.fuente.texto || 'Sin fuente registrada.')}${p.fuente && p.fuente.consultado ? ` Consultado el ${esc(fmtD(p.fuente.consultado))}.` : ''}</p></section>
        ${alertBox('info', 'Compatibilidad no garantizada', `<p>${esc(S.d.notas && S.d.notas.productos || '')}</p>`)}
      </div>
      <div class="modal-foot">${httpsUrl(p.url) ? `<a class="btn btn-primary" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(p.plataforma || 'la tienda')}</a>` : ''}<button type="button" class="btn" data-close>Cerrar</button></div>` });
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-toggle]'); if (t) { toggle(t.dataset.toggle); return; }
    const b = e.target.closest('[data-detail]'); if (b) { const p = S.d.productos.find(x => x.id === b.dataset.detail); if (p) openDetail(p); }
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
