/* Componentes comunes y de la página Objetivos: funciones puras que devuelven HTML.
   Objetivos llega hasta el objetivo asociado; desde ahí se abre el proyecto relacionado (proyecto.js). */
import { DIVISION, SECCIONES } from './datos.js';
import { rutaProyecto } from './rutas.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export const ICON = {
  chev: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  target: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  lupa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4.8-4.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  nodo: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7V5h6v2M12 11v4M10 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  caja: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z M4 8l8 4 8-4 M12 12v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  cartera: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 12h3M3 9h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  tablero: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 4v16M15 4v16" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  llave: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  casa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  folder: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  rows: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cards: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/></svg>',
  starO: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
};

/* ── Sidebar ── (ctx: ruta, proyectos, objetivos) */
export function sidebarHtml(S, macros, ctx) {
  const r = ctx.ruta;
  const secObj = `<li class="sb-item ${r.vista === 'objetivos' ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/objetivos" ${r.vista === 'objetivos' ? 'aria-current="page"' : ''}>${ICON.target}<span>Objetivos</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-indice" aria-expanded="${S.indice}" aria-controls="sb-indice" aria-label="${S.indice ? 'Ocultar' : 'Mostrar'} el índice de macroobjetivos">${ICON.chev}</button></div>
      <ol id="sb-indice" class="sb-indice" ${S.indice ? '' : 'hidden'}>
        ${macros.map(m => `<li><button type="button" class="sb-idx" data-act="ir-macro" data-macro="${m.id}" ${r.vista === 'objetivos' && S.activo === m.id ? 'aria-current="location"' : ''} title="${esc(m.titulo)}">
          <span class="sb-idx-n">${m.numero}</span><span>${esc(m.corto)}</span></button></li>`).join('')}
      </ol></li>`;
  // Proyectos e Investigaciones: solo los títulos. Sus vistas (Inicio, Kanban) se manejan en la ventana.
  const secLista = (sec, titulo, icono, tipo, vacio) => {
    const abierta = S.sbSec[sec] !== false, items = ctx.proyectos.filter(p => p.tipo === tipo);
    const enSec = r.vista === sec || (r.vista === 'proyecto' && r.seccion === sec);
    return `<li class="sb-item ${enSec ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/${sec}" ${r.vista === sec ? 'aria-current="page"' : ''}>${icono}<span>${titulo}</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-seccion" data-sec="${sec}" aria-expanded="${abierta}" aria-controls="sb-${sec}" aria-label="${abierta ? 'Ocultar' : 'Mostrar'} la lista de ${titulo.toLowerCase()}">${ICON.chev}</button></div>
      <ul id="sb-${sec}" class="sb-indice sb-proys" ${abierta ? '' : 'hidden'}>
        ${items.map(p => {
          const sel = r.vista === 'proyecto' && r.slug === p.slug;
          const desde = sel && p.objetivos.includes(r.desde) ? r.desde : '';
          return `<li class="sb-proy ${sel ? 'is-sel' : ''}"><a class="sb-idx sb-proy-link" href="${rutaProyecto(p, 'inicio', desde)}" ${sel ? 'aria-current="location"' : ''}>${esc(p.nombre)}</a></li>`;
        }).join('') || `<li class="sb-empty">${vacio}</li>`}
      </ul></li>`;
  };
  // Línea entre la primera etapa (objetivos, proyectos, seguimiento, investigaciones) y la segunda (resultados).
  const separador = s => (s.etapa === 2 && SECCIONES[SECCIONES.indexOf(s) - 1].etapa !== 2 ? '<li class="sb-sep" aria-hidden="true"></li>' : '');
  // Secciones de la segunda etapa con módulos (Nodos Venezuela, Inventarios, Presupuestos): su lista de módulos.
  const ICONO_SEC = { 'nodos-venezuela': ICON.nodo, inventarios: ICON.caja, presupuestos: ICON.cartera };
  const secHijos = s => {
    const abierta = S.sbSec[s.id] !== false, enSec = (r.vista === 'seccion' || r.vista === 'modulo') && r.seccion === s.id;
    return `<li class="sb-item ${enSec ? 'is-active' : ''}">
      <div class="sb-row"><a class="sb-link" href="#/${s.id}" ${r.vista === 'seccion' && r.seccion === s.id ? 'aria-current="page"' : ''}>${ICONO_SEC[s.id] || ICON.folder}<span>${esc(s.titulo)}</span></a>
        <button type="button" class="sb-disclose" data-act="toggle-seccion" data-sec="${s.id}" aria-expanded="${abierta}" aria-controls="sb-${s.id}" aria-label="${abierta ? 'Ocultar' : 'Mostrar'} los módulos de ${esc(s.titulo)}">${ICON.chev}</button></div>
      <ul id="sb-${s.id}" class="sb-indice sb-proys" ${abierta ? '' : 'hidden'}>
        ${s.hijos.map(h => { const sel = r.vista === 'modulo' && r.seccion === s.id && r.hijo === h.id; return `<li class="sb-proy ${sel ? 'is-sel' : ''}"><a class="sb-idx sb-proy-link" href="#/${s.id}/${h.id}" ${sel ? 'aria-current="page"' : ''}>${esc(h.titulo)}</a></li>`; }).join('')}
      </ul></li>`;
  };
  const secciones = SECCIONES.map(s => separador(s) + (s.id === 'objetivos' ? secObj
    : s.id === 'proyectos' ? secLista('proyectos', 'Proyectos', ICON.folder, 'proyecto', 'Sin proyectos registrados.')
      : s.id === 'investigaciones' ? secLista('investigaciones', 'Investigaciones', ICON.lupa, 'investigacion', 'Sin investigaciones registradas.')
        : s.hijos ? secHijos(s)
          : s.id === 'kanban' ? `<li class="sb-item ${r.vista === 'kanban' ? 'is-active' : ''}"><div class="sb-row"><a class="sb-link" href="#/kanban" ${r.vista === 'kanban' ? 'aria-current="page"' : ''}>${ICON.tablero}<span>Kanban</span></a></div></li>`
        : `<li class="sb-item"><span class="sb-link is-disabled" aria-disabled="true"><span class="sb-dot" aria-hidden="true"></span><span>${esc(s.titulo)}</span><span class="sb-soon">Próximamente</span></span></li>`)).join('');
  // Encabezado = selector de área: pasa directo a Infraestructura (o al inicio del departamento) sin ir a la portada.
  const abierto = !!S.menuArea;
  return `<div class="sb-brand-wrap">
      <button type="button" class="sb-brand" data-act="menu-area" aria-expanded="${abierto}" aria-controls="sb-areas" aria-haspopup="true">
        <span class="sb-logo" aria-hidden="true"><svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="16" r="13" fill="#EAF1E8"/><path d="M16 6c-5 4-7 9-5 14 3 1 7 0 9-3 2-4 0-8-4-11z" fill="#315C49"/><path d="M11 22c3-4 5-7 6-11" stroke="#A8C3A0" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></span>
        <span class="sb-brand-txt"><span class="sb-name">${esc(DIVISION.nombre)}</span><span class="sb-sub-t">${esc(DIVISION.relacion)}</span></span>
        <span class="sb-brand-chev" aria-hidden="true">${ICON.chev}</span><span class="sr-only">Cambiar de área</span>
      </button>
      <ul id="sb-areas" class="sb-areas" ${abierto ? '' : 'hidden'}>
        <li><span class="sb-area is-actual" aria-current="true">${ICON.target}<span><b>${esc(DIVISION.nombre)}</b><small>Área actual</small></span><span class="sb-check" aria-hidden="true">✓</span></span></li>
        <li><a class="sb-area" href="/#/infraestructura">${ICON.llave}<span><b>Infraestructura</b><small>Taller, maquinaria y oficinas</small></span></a></li>
        <li class="sb-area-sep" aria-hidden="true"></li>
        <li><a class="sb-area sb-area-ini" href="/">${ICON.casa}<span>Inicio del departamento</span></a></li>
      </ul>
    </div>
    <nav class="sb-nav" aria-label="Secciones de ${esc(DIVISION.nombre)}"><ul>
      ${secciones}
    </ul></nav>
    <div class="sb-foot">
      <p class="sb-note">Los proyectos, tareas y tarjetas del Kanban se guardan en este navegador.</p>
      <button type="button" class="btn btn-ghost btn-sm" data-act="restablecer">Restablecer datos</button>
    </div>`;
}

/* ── Migas de navegación ── items: [{ t, href? }] (el último es la página actual) */
export function migasHtml(items) {
  return `<nav class="migas" aria-label="Ruta de navegación"><ol>${items.map((it, i) => i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.t)}</span></li>` : `<li>${it.href ? `<a href="${it.href}">${esc(it.t)}</a>` : esc(it.t)}</li>`).join('')}</ol></nav>`;
}

/* ── Página Objetivos ── */
export function encabezadoHtml(S, macros, objetivos) {
  const nObj = Object.keys(objetivos).length;
  return `<header class="pg-head">
      <p class="pg-kicker">${esc(DIVISION.nombre)} <span class="pg-kicker-rel">· ${esc(DIVISION.relacion)}</span></p>
      <h1 id="pg-titulo" tabindex="-1">Objetivos</h1>
      <p class="pg-intro">Visión general: ${plural(macros.length, 'macroobjetivo', 'macroobjetivos')} y los ${plural(nObj, 'objetivo asociado', 'objetivos asociados')} que contribuyen a cada uno. Desde un objetivo se abren sus proyectos e investigaciones.</p>
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

export const tipoItem = p => (p.tipo === 'investigacion' ? 'Investigación' : p.condicion ? 'Proyecto condicionado' : 'Proyecto');
/* Bloque de un objetivo asociado con sus proyectos e investigaciones (Objetivos y panel del Kanban general). */
export function objetivoBloqueHtml(o, ctx) {
  const recs = ctx.recurrentes.filter(r => r.macro === o.macro), ps = ctx.proyectosDe(o.id);
  return `<li class="ob" id="${o.id}-bloque"><span class="ob-kicker">Objetivo asociado</span>
      <h3 class="ob-name">${esc(o.nombre)}</h3><p class="ob-desc">${esc(o.descripcion)}</p>
      ${ps.length ? `<div class="ob-proys"><span class="ob-proys-t">${ps.length === 1 ? 'Relacionado' : 'Relacionados: elige uno'}</span>
        <ul>${ps.map(p => `<li><a class="ob-proy" href="${rutaProyecto(p, 'inicio', o.id)}">${p.tipo === 'investigacion' ? ICON.lupa : ICON.folder}<span><small>${tipoItem(p)}</small>${esc(p.nombre)}</span>${ICON.arrow}</a></li>`).join('')}</ul></div>`
        : (recs.some(r => r.objetivos.includes(o.id)) ? '<p class="ob-none">Se trabaja mediante la tarea recurrente de este macroobjetivo.</p>' : '<p class="ob-none">Sin proyectos ni investigaciones registrados.</p>')}</li>`;
}
/* Tarea recurrente de un macroobjetivo. */
export function recurrenteHtml(r, ctx) {
  return `<li class="rec"><span class="ob-kicker">Tarea recurrente</span><h3 class="ob-name">${esc(r.titulo)}</h3>
      ${r.descripcion ? `<p class="ob-desc">${esc(r.descripcion)}</p>` : ''}
      ${r.componentes.length ? `<ul class="rec-comp">${r.componentes.map(c => `<li>${c.destacado ? `<span class="star-mini" title="Especial énfasis">${ICON.star}<span class="sr-only">Destacado: </span></span>` : ''}${esc(c.texto)}</li>`).join('')}</ul>` : ''}
      ${r.resultado ? `<p class="rec-res"><b>Resultado:</b> ${esc(r.resultado)}</p>` : ''}
      ${r.ruta ? `<p class="rec-res"><a class="ob-proy" href="${r.ruta}">${ICON.nodo}<span><small>Se sigue en</small>${esc(r.rutaTexto)}</span>${ICON.arrow}</a></p>` : ''}
      ${r.objetivos.length ? `<p class="nota">Contribuye a: ${r.objetivos.filter(x => ctx.objetivos[x]).map(x => esc(ctx.objetivos[x].nombre)).join(' · ')}</p>` : ''}</li>`;
}

/* Macroobjetivo (fila o tarjeta). Abierto: resultado esperado, objetivos asociados con sus proyectos e investigaciones,
   y las tareas recurrentes del macroobjetivo. */
export function macroHtml(m, S, ctx) {
  const abierto = S.abiertos.has(m.id);
  const objs = m.objetivos.map(id => ctx.objetivos[id]);
  const recs = ctx.recurrentes.filter(r => r.macro === m.id);
  // Con un único proyecto o investigación, la etiqueta lo abre directamente; con varios (o ninguno), lleva al bloque del objetivo para elegir.
  const tag = o => { const ps = ctx.proyectosDe(o.id); return ps.length === 1
    ? `<a class="tag" href="${rutaProyecto(ps[0], 'inicio', o.id)}" title="Abrir «${esc(ps[0].nombre)}»">${esc(o.nombre)}</a>`
    : `<button type="button" class="tag" data-act="ir-objetivo" data-ob="${o.id}">${esc(o.nombre)}</button>`; };
  const bloque = o => objetivoBloqueHtml(o, ctx), recurrente = r => recurrenteHtml(r, ctx);
  return `<li class="mo ${abierto ? 'is-open' : ''} ${S.activo === m.id ? 'is-active' : ''}" id="${m.id}" data-macro="${m.id}">
    <div class="mo-head">
      <button type="button" class="mo-toggle" data-act="toggle-macro" data-macro="${m.id}" aria-expanded="${abierto}" aria-controls="${m.id}-panel">
        <span class="mo-num" aria-hidden="true">${m.numero}</span>
        <span class="mo-main"><span class="mo-kicker">Macroobjetivo ${m.numero}</span><span class="mo-title">${esc(m.titulo)}</span>
          <span class="mo-desc">${esc(m.proposito)}</span></span>
        <span class="mo-chev">${ICON.chev}<span class="sr-only">${abierto ? 'Contraer' : 'Expandir'}</span></span>
      </button>
      <ul class="mo-tags" aria-label="Objetivos asociados de «${esc(m.titulo)}»">${objs.map(o => `<li>${tag(o)}</li>`).join('')}</ul>
    </div>
    ${abierto ? `<div class="mo-panel ${ctx.nuevo === m.id ? 'anim' : ''}" id="${m.id}-panel" role="region" aria-label="Contenido de ${esc(m.titulo)}">
      ${m.resultado ? `<p class="mo-res"><span class="nivel">Resultado esperado</span> ${esc(m.resultado)}</p>` : ''}
      <p class="nivel-rel"><span class="nivel">Objetivos asociados</span> Resultados concretos que contribuyen a: <em>${esc(m.proposito.charAt(0).toLowerCase() + m.proposito.slice(1))}</em></p>
      <ul class="ob-grid">${objs.map(bloque).join('')}</ul>
      ${recs.length ? `<ul class="ob-grid rec-grid" aria-label="Tareas recurrentes">${recs.map(recurrente).join('')}</ul>` : ''}
    </div>` : `<div id="${m.id}-panel" hidden></div>`}
  </li>`;
}

export function confirmHtml(titulo, cuerpo, accion) {
  return `<div class="dlg-head"><div><h2 id="dlg-titulo">${esc(titulo)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">${cuerpo}</div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="button" class="btn btn-danger" data-dlg-ok>${esc(accion)}</button></div>`;
}

/* ── Resultados de búsqueda ── */
export function resultadosHtml(items, activo) {
  if (!items.length) return '<li class="sr-empty" role="option" aria-disabled="true">Sin resultados.</li>';
  const tipo = { macro: 'Macroobjetivo', objetivo: 'Objetivo asociado', proyecto: 'Proyecto', investigacion: 'Investigación', tarea: 'Tarea' };
  return items.map((it, i) => `<li id="sr-${i}" role="option" class="sr-item ${i === activo ? 'is-active' : ''}" aria-selected="${i === activo}" data-i="${i}">
    <span class="sr-tipo t-${it.tipo}">${tipo[it.tipo]}</span><span class="sr-txt"><b>${esc(it.titulo)}</b><small>${esc(it.ruta)}</small></span></li>`).join('');
}

/* ── Segunda etapa: portada de sección y módulo integrado ──
   Los módulos vienen del dashboard publicado y se muestran en modulo.html dentro de un marco, con sus estilos
   originales. El marco ocupa el alto disponible y tiene su propio desplazamiento (así sus ventanas se ven bien). */
export function seccionHtml(s) {
  return `${migasHtml([{ t: DIVISION.nombre }, { t: s.titulo }])}
    <header class="pg-head"><p class="pg-kicker">${esc(DIVISION.nombre)} <span class="pg-kicker-rel">· Resultados</span></p><h1 id="pg-titulo" tabindex="-1">${esc(s.titulo)}</h1>
      ${s.descripcion ? `<p class="pg-intro">${esc(s.descripcion)}</p>` : ''}</header>
    <ul class="pj-list mod-list">${s.hijos.map(h => `<li class="pj-card"><h3><a href="#/${s.id}/${h.id}">${esc(h.titulo)}</a></h3>
      ${h.descripcion ? `<p class="pj-meta">${esc(h.descripcion)}</p>` : ''}</li>`).join('')}</ul>`;
}
export function moduloHtml(s, h) {
  return `${migasHtml([{ t: DIVISION.nombre }, { t: s.titulo, href: `#/${s.id}` }, { t: h.titulo }])}
    <h1 id="pg-titulo" class="sr-only" tabindex="-1">${esc(h.titulo)}</h1>
    <div class="mod-wrap"><iframe class="mod-frame" data-mod="${esc(h.modulo)}" src="modulo.html?m=${encodeURIComponent(h.modulo)}" title="${esc(h.titulo)}"></iframe></div>`;
}
