/* Componentes de Infraestructura: funciones puras que devuelven HTML.
   Patrones copiados de Manufactura (sidebar con selector de área, migas, filas/tarjetas de macroobjetivos, búsqueda),
   adaptados a la cascada de Infraestructura: macroobjetivo → registro → actividades (sin objetivos asociados). */
import { AREA, SECCIONES, TIPOS, MACROOBJETIVOS, REGISTROS } from './datos.js';
import { rutaRegistro, rutaMacro, habilitado } from './rutas.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
export const macroDe = r => MACROOBJETIVOS.find(m => m.id === r.macro);
const destacadas = r => r.actividades.filter(x => x.destacada).length;

const svg = (d, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true">${d}</svg>`;
const st = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const ICON = {
  chev: svg(`<path d="M9 6l6 6-6 6" ${st} stroke-width="2.2"/>`, 20),
  target: svg(`<circle cx="12" cy="12" r="8" ${st}/><circle cx="12" cy="12" r="3.5" ${st}/>`),
  folder: svg(`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" ${st}/>`),
  lupa: svg(`<circle cx="10.5" cy="10.5" r="6.5" ${st}/><path d="M20 20l-4.8-4.8" ${st}/>`),
  cond: svg(`<path d="M6 3h12M6 21h12M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" ${st}/>`),
  tablero: svg(`<rect x="3" y="4" width="18" height="16" rx="2" ${st}/><path d="M9 4v16M15 4v16" ${st}/>`),
  engranaje: svg(`<circle cx="12" cy="12" r="3.2" ${st}/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" ${st}/>`),
  doc: svg(`<path d="M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6M9 16h6" ${st}/>`),
  bandeja: svg(`<path d="M3 13l3-8h12l3 8v6H3z M3 13h5l1 3h6l1-3h5" ${st}/>`),
  llave: svg(`<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z" ${st}/>`),
  hoja: svg(`<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z M5 19l7-7" ${st}/>`),
  casa: svg(`<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" ${st}/>`),
  rows: svg(`<path d="M4 6h16M4 12h16M4 18h16" ${st}/>`, 16),
  cards: svg(`<rect x="4" y="4" width="7" height="7" rx="1.5" ${st}/><rect x="13" y="4" width="7" height="7" rx="1.5" ${st}/><rect x="4" y="13" width="7" height="7" rx="1.5" ${st}/><rect x="13" y="13" width="7" height="7" rx="1.5" ${st}/>`, 16),
  arrow: svg(`<path d="M5 12h14M13 6l6 6-6 6" ${st} stroke-width="2.2"/>`, 16),
  enlace: svg(`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" ${st}/>`, 16),
  historial: svg(`<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7M12 8v4l3 2" ${st}/>`, 16),
  alerta: svg(`<path d="M12 3l10 18H2z M12 10v5M12 18h.01" ${st}/>`, 16),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>', 16)
};
const ICONO_TIPO = { proyecto: ICON.folder, investigacion: ICON.lupa, 'tarea-directa': ICON.arrow, condicionado: ICON.cond };
const estrella = () => `<span class="star-mini" title="Especial énfasis">${ICON.star}<span class="sr-only">Especial énfasis: </span></span>`;
export const tipoTxt = r => TIPOS[r.tipo];

/* Enlaces del selector de área. En local apuntan a los prototipos y al sitio servidos en este equipo. */
function enlacesArea() {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '5181';   // solo el prototipo local
  return local ? { manufactura: 'http://localhost:5180/', inicio: 'http://localhost:5173/' } : { manufactura: '/manufactura/', inicio: '/' };
}

/* ── Sidebar ── */
export function sidebarHtml(S, ctx) {
  const r = ctx.ruta;
  const enObj = r.vista === 'objetivos';
  const secObj = `<li class="sb-item ${enObj ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/objetivos" ${enObj ? 'aria-current="page"' : ''}>${ICON.target}<span>Objetivos</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-indice" aria-expanded="${S.indice}" aria-controls="sb-indice" aria-label="${S.indice ? 'Ocultar' : 'Mostrar'} el índice de macroobjetivos">${ICON.chev}</button></div>
      <ol id="sb-indice" class="sb-indice" ${S.indice ? '' : 'hidden'}>
        ${MACROOBJETIVOS.map(m => `<li><button type="button" class="sb-idx" data-act="ir-macro" data-macro="${m.id}" ${enObj && S.activo === m.id ? 'aria-current="location"' : ''} title="${esc(m.titulo)}">
          <span class="sb-idx-n">${m.numero}</span><span>${esc(m.corto)}</span>${m.prioridad === 'critica' ? '<span class="sb-crit" title="Prioridad crítica">!</span>' : ''}</button></li>`).join('')}
      </ol></li>`;
  // Proyectos (incluye los condicionados) e Investigaciones: solo los títulos, en el orden de los macroobjetivos.
  const secLista = (sec, titulo, icono, filtro) => {
    const items = MACROOBJETIVOS.flatMap(m => m.registros.map(id => REGISTROS[id]).filter(filtro));
    const abierta = S.sbSec[sec] !== false;
    const enSec = r.vista === sec || (r.vista === 'registro' && r.seccion === sec);
    return `<li class="sb-item ${enSec ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/${sec}" ${r.vista === sec ? 'aria-current="page"' : ''}>${icono}<span>${titulo}</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-seccion" data-sec="${sec}" aria-expanded="${abierta}" aria-controls="sb-${sec}" aria-label="${abierta ? 'Ocultar' : 'Mostrar'} la lista de ${titulo.toLowerCase()}">${ICON.chev}</button></div>
      <ul id="sb-${sec}" class="sb-indice sb-proys" ${abierta ? '' : 'hidden'}>
        ${items.map(p => { const sel = r.vista === 'registro' && r.slug === p.slug; return `<li class="sb-proy ${sel ? 'is-sel' : ''}"><a class="sb-idx sb-proy-link" href="${rutaRegistro(p)}" ${sel ? 'aria-current="page"' : ''}>
          <span class="sb-idx-n">${macroDe(p).numero}</span><span>${esc(p.nombre)}</span>${p.tipo === 'condicionado' ? '<span class="sb-cond" title="Proyecto condicionado">C</span>' : ''}</a></li>`; }).join('')}
      </ul></li>`;
  };
  const secProy = secLista('proyectos', 'Proyectos', ICON.folder, x => x.tipo !== 'investigacion');
  const secInv = secLista('investigaciones', 'Investigaciones', ICON.lupa, x => x.tipo === 'investigacion');
  // Máquinas de simulación: sus cuatro ventanas (Resumen · Postventa · Stock · Equipos en operación).
  const VENT_MAQ = [['resumen', 'Resumen', '#/maquinas'], ['postventa', 'Postventa', '#/maquinas/postventa'], ['stock', 'Stock', '#/maquinas/stock'], ['operacion', 'Equipos en operación', '#/maquinas/operacion']];
  const secMaq = () => {
    const abierta = S.sbSec.maquinas !== false, enSec = r.vista === 'maquinas';
    return `<li class="sb-item ${enSec ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/maquinas" ${enSec && r.ventana === 'resumen' ? 'aria-current="page"' : ''}>${ICON.engranaje}<span>Máquinas de simulación</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-seccion" data-sec="maquinas" aria-expanded="${abierta}" aria-controls="sb-maquinas" aria-label="${abierta ? 'Ocultar' : 'Mostrar'} las ventanas de Máquinas de simulación">${ICON.chev}</button></div>
      <ul id="sb-maquinas" class="sb-indice sb-proys" ${abierta ? '' : 'hidden'}>
        ${VENT_MAQ.map(([id, t, h]) => { const sel = enSec && r.ventana === id; return `<li class="sb-proy ${sel ? 'is-sel' : ''}"><a class="sb-idx sb-proy-link" href="${h}" ${sel ? 'aria-current="page"' : ''}><span>${t}</span></a></li>`; }).join('')}
      </ul></li>`;
  };
  const VENT_MANT = [['resumen', 'Resumen', '#/mantenimiento'], ['maquinas', 'Máquinas del taller', '#/mantenimiento/maquinas'], ['trabajos', 'Mantenimientos', '#/mantenimiento/trabajos']];
  const secMant = () => {
    const abierta = S.sbSec.mantenimiento !== false, enSec = r.vista === 'mantenimiento';
    return `<li class="sb-item ${enSec ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/mantenimiento" ${enSec && r.ventana === 'resumen' ? 'aria-current="page"' : ''}>${ICON.llave}<span>Mantenimiento</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-seccion" data-sec="mantenimiento" aria-expanded="${abierta}" aria-controls="sb-mantenimiento" aria-label="${abierta ? 'Ocultar' : 'Mostrar'} las ventanas de Mantenimiento">${ICON.chev}</button></div>
      <ul id="sb-mantenimiento" class="sb-indice sb-proys" ${abierta ? '' : 'hidden'}>
        ${VENT_MANT.map(([id, t, h]) => { const sel = enSec && r.ventana === id; return `<li class="sb-proy ${sel ? 'is-sel' : ''}"><a class="sb-idx sb-proy-link" href="${h}" ${sel ? 'aria-current="page"' : ''}><span>${t}</span></a></li>`; }).join('')}
      </ul></li>`;
  };
  // Secciones pendientes: visibles y claramente identificadas, sin enlace.
  const ICONO_SEC = { investigaciones: ICON.lupa, kanban: ICON.tablero, maquinas: ICON.engranaje, documentacion: ICON.doc, pendientes: ICON.bandeja };
  const pendiente = s => `<li class="sb-item"><span class="sb-link is-disabled" aria-disabled="true">${ICONO_SEC[s.id] || ICON.folder}<span>${esc(s.titulo)}</span>
      <span class="sb-soon">${s.etapa ? `Etapa ${s.etapa}` : 'Pendiente'}</span></span></li>`;
  let bloqueAnt = 1, adminVisto = false;
  const items = SECCIONES.map(s => {
    let sep = '';
    if ((s.bloque || 1) !== bloqueAnt) { sep = '<li class="sb-sep" aria-hidden="true"></li>'; bloqueAnt = s.bloque || 1; }
    if (s.admin && !adminVisto) { sep = '<li class="sb-sep" aria-hidden="true"></li><li class="sb-grupo" aria-hidden="true">Administración</li>'; adminVisto = true; }
    const activa = s => { const sel = r.vista === s.id || (r.vista === 'modulo' && r.seccion === s.id); return `<li class="sb-item ${sel ? 'is-active' : ''}"><div class="sb-row"><a class="sb-link" href="#/${s.id}" ${sel ? 'aria-current="page"' : ''}>${ICONO_SEC[s.id] || ICON.folder}<span>${esc(s.titulo)}</span></a></div></li>`; };
    return sep + (s.id === 'objetivos' ? secObj : s.id === 'proyectos' ? secProy : s.id === 'investigaciones' ? secInv : s.id === 'maquinas' ? secMaq() : s.id === 'mantenimiento' ? secMant() : s.activa ? activa(s) : pendiente(s));
  }).join('');
  const L = enlacesArea(), abiertoArea = !!S.menuArea;
  return `<div class="sb-brand-wrap">
      <button type="button" class="sb-brand" data-act="menu-area" aria-expanded="${abiertoArea}" aria-controls="sb-areas" aria-haspopup="true">
        <span class="sb-logo" aria-hidden="true">${svg(`<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>`, 22)}</span>
        <span class="sb-brand-txt"><span class="sb-name">${esc(AREA.nombre)}</span><span class="sb-sub-t">${esc(AREA.relacion)}</span></span>
        <span class="sb-brand-chev" aria-hidden="true">${ICON.chev}</span><span class="sr-only">Cambiar de área</span>
      </button>
      <ul id="sb-areas" class="sb-areas" ${abiertoArea ? '' : 'hidden'}>
        <li><span class="sb-area is-actual" aria-current="true">${ICON.llave}<span><b>${esc(AREA.nombre)}</b><small>Área actual</small></span><span class="sb-check" aria-hidden="true">✓</span></span></li>
        <li><a class="sb-area" href="${L.manufactura}">${ICON.hoja}<span><b>Manufactura</b><small>Desarrollo e investigación de Neotropya</small></span></a></li>
        <li class="sb-area-sep" aria-hidden="true"></li>
        <li><a class="sb-area sb-area-ini" href="${L.inicio}">${ICON.casa}<span>Inicio del departamento</span></a></li>
      </ul>
    </div>
    <nav class="sb-nav" aria-label="Secciones de ${esc(AREA.nombre)}"><ul>${items}</ul></nav>
    <div class="sb-foot">
      <p class="sb-note">Versión local de revisión. Las preferencias de vista se guardan en este navegador.</p>
      <button type="button" class="btn btn-ghost btn-sm" data-act="restablecer">Restablecer preferencias</button>
    </div>`;
}

/* ── Migas ── items: [{ t, href? }] */
export function migasHtml(items) {
  return `<nav class="migas" aria-label="Ruta de navegación"><ol>${items.map((it, i) => i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.t)}</span></li>` : `<li>${it.href ? `<a href="${it.href}">${esc(it.t)}</a>` : esc(it.t)}</li>`).join('')}</ol></nav>`;
}

/* ── Página Objetivos ── */
const ARTE = `<svg viewBox="0 0 380 210" role="presentation" aria-hidden="true">
  <defs><pattern id="ia-grid" width="19" height="19" patternUnits="userSpaceOnUse"><path d="M19 0H0V19" fill="none" stroke="#B8C0B8" stroke-opacity=".12"/></pattern></defs>
  <rect x="0" y="0" width="380" height="210" rx="8" fill="url(#ia-grid)"/>
  <g fill="none" stroke="#B8C0B8" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round">
    <path d="M24 104 L124 52 L224 104"/><path d="M40 96 V186 M208 96 V186"/><path d="M14 186 H234" stroke-opacity=".35"/>
  </g>
  <path d="M24 104 L124 52 L224 104" fill="none" stroke="#F28C28" stroke-width="3.5" stroke-linejoin="round" stroke-dasharray="14 7"/>
  <path d="M150 122c-6 9-9 14-9 18a9 9 0 0 0 18 0c0-4-3-9-9-18z" fill="#8FB2C9" fill-opacity=".75"/>
  <g stroke="#7C8962" stroke-width="5" stroke-linecap="round"><path d="M70 186 V128 M108 186 V128"/></g>
  <path d="M60 150 H118" stroke="#A3B07F" stroke-width="4" stroke-linecap="round"/>
  <g transform="translate(300 86)">
    <circle r="40" fill="none" stroke="#F28C28" stroke-width="12" stroke-dasharray="9.2 6.5" stroke-opacity=".9"/>
    <circle r="27" fill="#202421" stroke="#F28C28" stroke-width="3"/><circle r="9" fill="none" stroke="#B8C0B8" stroke-opacity=".7" stroke-width="3"/>
  </g>
  <g transform="translate(330 160) rotate(-38)"><circle r="17" fill="#141615" stroke="#B8C0B8" stroke-opacity=".7" stroke-width="2"/>
    <circle r="11" fill="none" stroke="#7C8962" stroke-width="5" stroke-dasharray="4.2 3.2"/></g>
  <g font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="11" fill="#B8C0B8" fill-opacity=".55" letter-spacing="1">
    <text x="252" y="20">REF. INF-09</text><text x="24" y="204">TALLER · ALMACÉN · OFICINAS</text></g>
</svg>`;

export function encabezadoHtml(S, ctx) {
  const regs = Object.values(REGISTROS);
  const n = t => regs.filter(r => r.tipo === t).length;
  const resumen = [plural(n('proyecto'), 'proyecto', 'proyectos'), plural(n('condicionado'), 'proyecto condicionado', 'proyectos condicionados'), plural(n('investigacion'), 'investigación', 'investigaciones')];
  return `<header class="ia-hero">
      <div class="ia-hero-txt">
        <p class="ia-kicker"><span class="ia-dot" aria-hidden="true"></span>${esc(AREA.nombre)} · ${esc(AREA.relacion)}</p>
        <h1 id="pg-titulo" tabindex="-1">Objetivos</h1>
        <p class="ia-desc">${plural(MACROOBJETIVOS.length, 'macroobjetivo', 'macroobjetivos')} con sus proyectos e investigaciones: ${resumen.join(', ')}. Despliega un macroobjetivo para ver qué lo compone y abre un registro para ver sus actividades.</p>
        <ul class="ia-leyenda" aria-label="Tipos de registro">
          <li class="t-proyecto">${ICON.folder}Proyecto</li><li class="t-investigacion">${ICON.lupa}Investigación</li>
          <li class="t-condicionado">${ICON.cond}Proyecto condicionado</li><li class="t-estrella">${ICON.star}Especial énfasis</li>
        </ul>
      </div>
      <div class="ia-hero-art">${ARTE}</div>
    </header>
    <div class="pg-tools">
      <div class="pg-tools-l">
        <button type="button" class="btn btn-sm" data-act="expandir">Expandir todos</button>
        <button type="button" class="btn btn-sm" data-act="contraer">Contraer todos</button>
      </div>
      <div class="seg" role="group" aria-label="Vista">
        <button type="button" data-act="vista" data-vista="filas" aria-pressed="${S.vista === 'filas'}">${ICON.rows}Filas</button>
        <button type="button" data-act="vista" data-vista="tarjetas" aria-pressed="${S.vista === 'tarjetas'}">${ICON.cards}Tarjetas</button>
      </div>
    </div>`;
}

/* Etiqueta del tipo de registro. */
export const tipoEtiqueta = r => `<span class="rg-tipo t-${r.tipo}">${ICONO_TIPO[r.tipo]}${esc(tipoTxt(r))}</span>`;
const resumenActs = r => r.actividades.length
  ? `${plural(r.actividades.length, 'actividad', 'actividades')}${destacadas(r) ? ` · ${destacadas(r)} ${ICON.star}<span class="sr-only">con especial énfasis</span>` : ''}`
  : esc(r.sinActividades || 'Sin actividades');

/* Tarjeta de un registro dentro del macroobjetivo abierto. */
export function registroHtml(r) {
  return `<li class="rg t-${r.tipo}" id="${r.id}-bloque">
      ${tipoEtiqueta(r)}
      <h3 class="rg-nombre"><a href="${rutaRegistro(r)}">${esc(r.nombre)}</a></h3>
      <p class="rg-meta">${resumenActs(r)}</p>
      ${r.condicion ? `<div class="rg-cond"><span class="rg-cond-t">${ICON.cond}Condición de inicio</span><p>${esc(r.condicion)}</p></div>` : ''}
      ${r.relaciones.length ? `<ul class="rg-rel" aria-label="Relaciones">${r.relaciones.map(x => { const o = REGISTROS[x.id]; return `<li>${ICON.enlace}<span><a href="${rutaRegistro(o)}">${esc(o.nombre)}</a>${macroDe(o).id !== r.macro ? ` <small>(${macroDe(o).numero})</small>` : ''} — ${esc(x.texto)}</span></li>`; }).join('')}</ul>` : ''}
      ${habilitado(r) ? `<span class="rg-abrir-row"><a class="rg-abrir" href="${rutaRegistro(r, 'inicio')}">Inicio ${ICON.arrow}</a><a class="rg-abrir" href="${rutaRegistro(r, r.tipo === 'investigacion' ? 'resultados' : 'kanban')}">${r.tipo === 'investigacion' ? 'Resultados' : 'Kanban'} ${ICON.arrow}</a></span>` : `<a class="rg-abrir" href="${rutaRegistro(r)}">Ver actividades ${ICON.arrow}</a>`}
    </li>`;
}

/* Composición del macroobjetivo por tipo, p. ej. «2 proyectos» o «Investigación + proyecto condicionado». */
const PLURAL_TIPO = { proyecto: 'proyectos', investigacion: 'investigaciones', 'tarea-directa': 'tareas directas', condicionado: 'proyectos condicionados' };
function composicion(regs) {
  const orden = ['proyecto', 'investigacion', 'condicionado', 'tarea-directa'];
  const txt = orden.map(t => { const n = regs.filter(r => r.tipo === t).length; return n === 0 ? '' : n === 1 ? TIPOS[t].toLowerCase() : `${n} ${PLURAL_TIPO[t]}`; }).filter(Boolean).join(' + ');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/* Macroobjetivo (fila o tarjeta). Cerrado: número, título y sus registros como etiquetas. Abierto: registros, notas y antecedentes. */
export function macroHtml(m, S, ctx) {
  const abierto = S.abiertos.has(m.id);
  const regs = m.registros.map(id => REGISTROS[id]);
  const crit = m.prioridad === 'critica' ? `<span class="ia-crit">${ICON.alerta}Prioridad crítica</span>` : '';
  return `<li class="mo ${abierto ? 'is-open' : ''} ${S.activo === m.id ? 'is-active' : ''}" id="${m.id}" data-macro="${m.id}">
    <div class="mo-head">
      <button type="button" class="mo-toggle" data-act="toggle-macro" data-macro="${m.id}" aria-expanded="${abierto}" aria-controls="${m.id}-panel">
        <span class="mo-num" aria-hidden="true">${m.numero}</span>
        <span class="mo-main"><span class="mo-kicker">Macroobjetivo ${m.numero}${crit}</span><span class="mo-title">${esc(m.titulo)}</span>
          <span class="mo-desc">${esc(composicion(regs))}</span></span>
        <span class="mo-chev">${ICON.chev}<span class="sr-only">${abierto ? 'Contraer' : 'Expandir'}</span></span>
      </button>
      <ul class="mo-tags" aria-label="Registros de «${esc(m.titulo)}»">${regs.map(r => `<li><a class="tag rg-tag t-${r.tipo}" href="${rutaRegistro(r)}" title="${esc(tipoTxt(r))}">${ICONO_TIPO[r.tipo]}${esc(r.nombre)}</a></li>`).join('')}</ul>
    </div>
    ${abierto ? `<div class="mo-panel ${ctx.nuevo === m.id ? 'anim' : ''}" id="${m.id}-panel" role="region" aria-label="Contenido de ${esc(m.titulo)}">
      <ul class="rg-grid">${regs.map(registroHtml).join('')}</ul>
      ${(m.notas || []).length ? `<ul class="mo-notas" aria-label="Notas del macroobjetivo">${m.notas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(m.antecedentes || []).length ? `<div class="mo-ant"><span class="nivel">${ICON.historial} Antecedentes</span>
        <ul>${m.antecedentes.map(x => `<li><b>${esc(x.titulo)}</b> — ${esc(x.nota)}</li>`).join('')}</ul></div>` : ''}
    </div>` : `<div id="${m.id}-panel" hidden></div>`}
  </li>`;
}

/* ── Proyectos o Investigaciones: lista agrupada por macroobjetivo ── */
export function proyectosHtml(inv = false) {
  const grupos = MACROOBJETIVOS.map(m => ({ m, ps: m.registros.map(id => REGISTROS[id]).filter(r => (r.tipo === 'investigacion') === inv) })).filter(g => g.ps.length);
  const total = grupos.reduce((s, g) => s + g.ps.length, 0);
  const titulo = inv ? 'Investigaciones' : 'Proyectos';
  const hab = p => (inv ? 'Inicio y Resultados' : 'Inicio y Kanban');
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: titulo }])}
    <header class="pg-head"><p class="pg-kicker">${esc(AREA.nombre)}</p><h1 id="pg-titulo" tabindex="-1">${titulo}</h1>
      <p class="pg-intro">${inv ? `${plural(total, 'investigación', 'investigaciones')} por macroobjetivo: reunir información, analizarla y obtener conclusiones. Cada una alimenta a un proyecto condicionado.`
        : `${plural(total, 'proyecto', 'proyectos')} por macroobjetivo.`}</p></header>
    ${grupos.map(g => `<section class="pj-grupo" data-macro="${g.m.id}" aria-labelledby="g-${g.m.id}">
      <h2 class="pj-grupo-t" id="g-${g.m.id}"><a href="${rutaMacro(g.m.id)}"><span>${g.m.numero}</span>${esc(g.m.titulo)}</a></h2>
      <ul class="pj-list">${g.ps.map(p => `<li class="pj-card">${tipoEtiqueta(p)}<h3><a href="${rutaRegistro(p)}">${esc(p.nombre)}</a></h3>
        <p class="pj-meta">${resumenActs(p)}${habilitado(p) ? ` · <b class="pj-hab">${hab(p)}</b>` : ' · Ficha preliminar'}</p>
        ${p.condicion ? `<p class="pj-meta">${ICON.cond} ${esc(p.condicion)}</p>` : ''}</li>`).join('')}</ul></section>`).join('')}`;
}

/* ── Ficha preliminar de un registro: datos de la lista definitiva y sus actividades ──
   Inicio completo y Kanban (proyectos) llegan en la Etapa 3; las investigaciones, en la Etapa 4. */
export function registroPaginaHtml(r) {
  const m = macroDe(r), inv = r.tipo === 'investigacion';
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: `${m.numero} ${m.corto}`, href: rutaMacro(m.id) }, { t: r.nombre }])}
    <header class="pg-head ficha-head" data-macro="${m.id}">
      ${tipoEtiqueta(r)}
      <h1 id="pg-titulo" tabindex="-1">${esc(r.nombre)}</h1>
      <p class="pg-intro">Macroobjetivo <a href="${rutaMacro(m.id)}">${m.numero} · ${esc(m.titulo)}</a>${m.prioridad === 'critica' ? ` <span class="ia-crit">${ICON.alerta}Prioridad crítica</span>` : ''}</p>
    </header>
    <p class="aviso etapa">${inv ? 'Ficha preliminar. La estructura de las investigaciones (Inicio y Resultados) se acuerda y construye en la Etapa 4.'
      : 'Ficha preliminar. El Inicio completo (responsable, prioridad, fechas, próxima acción…) y el Kanban de este proyecto llegan en un próximo bloque de la Etapa 3.'}</p>
    ${r.condicion ? `<section class="pj-sec ficha-cond" aria-labelledby="h-cond"><h2 id="h-cond">${ICON.cond} Condición de inicio</h2>
      <p>${esc(r.condicion)}</p>
      <p class="nota">Se muestra aparte del estado de las actividades. La ejecución no podrá marcarse como iniciada sin registrar que la condición se resolvió.</p>
      <p><span class="pill cond-estado">Resolución de la condición: sin registrar</span></p></section>` : ''}
    <section class="pj-sec" aria-labelledby="h-act"><h2 id="h-act">Actividades</h2>
      ${r.actividades.length ? `<ol class="act-lista">${r.actividades.map(x => `<li><span class="act-txt">${x.destacada ? estrella() : ''}${esc(x.texto)}</span>
        <span class="act-estado"><span class="pill">To do</span> <span class="pend">Estado por confirmar</span></span></li>`).join('')}</ol>`
        : `<p class="vacio">${esc(r.sinActividades || 'Sin actividades registradas.')}</p>`}
    </section>
    ${r.relaciones.length ? `<section class="pj-sec" aria-labelledby="h-rel"><h2 id="h-rel">Relaciones</h2>
      <ul class="rg-rel">${r.relaciones.map(x => { const o = REGISTROS[x.id], om = macroDe(o); return `<li>${ICON.enlace}<span>${tipoEtiqueta(o)} <a href="${rutaRegistro(o)}">${esc(o.nombre)}</a> <small>(${om.numero} ${esc(om.corto)})</small> — ${esc(x.texto)}</span></li>`; }).join('')}</ul></section>` : ''}
    ${(m.notas || []).length ? `<section class="pj-sec" aria-labelledby="h-notas"><h2 id="h-notas">Notas del macroobjetivo</h2><ul class="mo-notas">${m.notas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}`;
}

export function noEncontradoHtml() {
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: 'No encontrado' }])}<header class="pg-head"><h1 id="pg-titulo" tabindex="-1">Registro no encontrado</h1><p class="pg-intro"><a href="#/objetivos">Volver a Objetivos</a></p></header>`;
}

export function confirmHtml(titulo, cuerpo, accion) {
  return `<div class="dlg-head"><div><h2 id="dlg-titulo">${esc(titulo)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">${cuerpo}</div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="button" class="btn btn-danger" data-dlg-ok>${esc(accion)}</button></div>`;
}

/* ── Resultados de búsqueda ── */
export function resultadosHtml(items, activo) {
  if (!items.length) return '<li class="sr-empty" role="option" aria-disabled="true">Sin resultados.</li>';
  const tipo = { macro: 'Macroobjetivo', proyecto: 'Proyecto', condicionado: 'Condicionado', investigacion: 'Investigación', actividad: 'Actividad' };
  return items.map((it, i) => `<li id="sr-${i}" role="option" class="sr-item ${i === activo ? 'is-active' : ''}" aria-selected="${i === activo}" data-i="${i}">
    <span class="sr-tipo t-${it.tipo}">${tipo[it.tipo]}</span><span class="sr-txt"><b>${esc(it.titulo)}</b><small>${esc(it.ruta)}</small></span></li>`).join('');
}

/* ── Módulo integrado del dashboard publicado (Máquinas de simulación), en un marco con su propio desplazamiento ── */
export function moduloHtml(s, sub) {
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: s.titulo }])}
    <h1 id="pg-titulo" class="sr-only" tabindex="-1">${esc(s.titulo)}</h1>
    <p class="aviso etapa mod-aviso">${esc(s.descripcion)}</p>
    <div class="mod-wrap"><iframe class="mod-frame" data-mod="${esc(s.modulo)}" data-sub="${esc(sub)}" src="modulo.html?m=${encodeURIComponent(s.modulo)}&sub=${encodeURIComponent(sub)}" title="${esc(s.titulo)}"></iframe></div>`;
}
