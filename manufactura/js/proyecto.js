/* Vistas de Proyectos e Investigaciones: listas, Inicio, Kanban (solo proyectos), tarjeta y formularios de tarea.
   Una investigación usa la misma ficha de Inicio, con su lista de tareas en lugar del Kanban.
   Funciones puras que devuelven HTML; el estado y los eventos están en app.js. */
import { esc, plural, ICON, migasHtml, tipoItem } from './componentes.js';
import { COLUMNAS, PRIORIDADES, DEPARTAMENTOS, RELACION_DEPTOS } from './datos-proyectos.js';
import { rutaProyecto, rutaObjetivo, rutaMacro } from './rutas.js';
import { DIVISION } from './datos.js';
import { resultadosHtml, resumenResultados } from './resultados.js';

const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const fmtDT = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export const colTitulo = id => (COLUMNAS.find(c => c.id === id) || {}).titulo || id;
export const prioTitulo = id => (PRIORIDADES.find(p => p.id === id) || PRIORIDADES[0]).titulo;
const deptoTitulo = id => (DEPARTAMENTOS.find(d => d.id === id) || {}).titulo || id;
const prioPill = id => `<span class="pill prio p-${id || 'none'}">${id ? `Prioridad ${esc(prioTitulo(id).toLowerCase())}` : 'Prioridad por definir'}</span>`;
const esInv = p => p.tipo === 'investigacion';
const SECCION = p => (esInv(p) ? { id: 'investigaciones', t: 'Investigaciones' } : { id: 'proyectos', t: 'Proyectos' });

/* Resumen calculado a partir de las tareas (nunca se guarda aparte). */
export function resumen(tareas) {
  const por = Object.fromEntries(COLUMNAS.map(c => [c.id, tareas.filter(t => t.estado === c.id)]));
  const total = tareas.length, hechas = por.completed.length;
  const bloqueadas = por.blocked, abiertas = tareas.filter(t => t.estado !== 'completed' && t.estado !== 'blocked');
  return { total, hechas, por, bloqueadas, parcial: bloqueadas.length > 0 && abiertas.length > 0,
    destacadasPend: tareas.filter(t => t.destacada && t.estado !== 'completed'), pct: total ? Math.round(hechas / total * 100) : 0 };
}

/* Migas: si se llegó desde un objetivo, se conserva esa ruta; si no, desde su sección. */
function migasItem(p, pagina, desde, ctx) {
  const o = desde && ctx.objetivos[desde], m = ctx.macros.find(x => x.id === p.macro), sec = SECCION(p);
  const base = o ? [{ t: DIVISION.nombre }, { t: 'Objetivos', href: '#/objetivos' }, ...(m ? [{ t: `${m.numero} · ${m.corto}`, href: rutaMacro(m.id) }] : []), { t: o.nombre, href: rutaObjetivo(o.id) }]
    : [{ t: DIVISION.nombre }, { t: sec.t, href: `#/${sec.id}` }];
  return migasHtml([...base, { t: p.nombre, href: rutaProyecto(p, 'inicio', desde) }, { t: pagina === 'kanban' ? 'Kanban' : pagina === 'resultados' ? 'Resultados' : 'Inicio' }]);
}

function cabecera(p, pagina, desde, ctx) {
  return `${migasItem(p, pagina, desde, ctx)}
    <header class="pj-head">
      <p class="pg-kicker">${esc(tipoItem(p))} <span class="pg-kicker-rel">· ${esc(DIVISION.nombre)}</span></p>
      <h1 id="pg-titulo" tabindex="-1">${esc(p.nombre)}</h1>
      ${esInv(p) ? `<p class="pg-intro">Trabajo orientado a reunir y analizar información para obtener conclusiones.</p>
      <nav class="pj-tabs" aria-label="Vistas de la investigación">
        <a href="${rutaProyecto(p, 'inicio', desde)}" ${pagina === 'inicio' ? 'aria-current="page"' : ''}>Inicio</a>
        <a href="${rutaProyecto(p, 'resultados', desde)}" ${pagina === 'resultados' ? 'aria-current="page"' : ''}>Resultados</a></nav>` : `<nav class="pj-tabs" aria-label="Vistas del proyecto">
        <a href="${rutaProyecto(p, 'inicio', desde)}" ${pagina === 'inicio' ? 'aria-current="page"' : ''}>Inicio</a>
        <a href="${rutaProyecto(p, 'kanban', desde)}" ${pagina === 'kanban' ? 'aria-current="page"' : ''}>Kanban</a></nav>`}
      ${p.condicion ? `<p class="aviso cond"><b>Proyecto condicionado.</b> ${esc(p.condicion)} Sus tareas están registradas, pero todavía no se planifican.</p>` : ''}
    </header>`;
}

/* ── Listas de proyectos o investigaciones, agrupadas por macroobjetivo ── */
export function listaHtml(ctx, tipo) {
  const inv = tipo === 'investigacion', titulo = inv ? 'Investigaciones' : 'Proyectos';
  const intro = inv ? 'Trabajo orientado a reunir y analizar información para obtener conclusiones. Cada investigación tiene su ficha de Inicio con sus tareas.'
    : 'Trabajo que requiere planificación y una serie de tareas. Cada proyecto tiene Inicio y Kanban; un proyecto puede servir a varios objetivos sin duplicarse.';
  const items = ctx.proyectos.filter(p => p.tipo === tipo);
  const grupos = ctx.macros.map(m => ({ m, ps: items.filter(p => p.macro === m.id) })).filter(g => g.ps.length);
  return `${migasHtml([{ t: DIVISION.nombre }, { t: titulo }])}
    <header class="pg-head"><p class="pg-kicker">${esc(DIVISION.nombre)}</p><h1 id="pg-titulo" tabindex="-1">${titulo}</h1><p class="pg-intro">${intro}</p></header>
    ${grupos.map(({ m, ps }) => `<section class="pj-grupo" aria-label="${esc(m.titulo)}"><h2 class="pj-grupo-t"><span>${esc(m.numero)}</span> ${esc(m.titulo)}</h2>
      <ul class="pj-list">${ps.map(p => { const r = resumen(ctx.tareasDe(p.id)); return `<li class="pj-card">
        <p class="ob-kicker">${esc(tipoItem(p))}${p.condicion ? ' · aún no se planifica' : ''}</p>
        <h3><a href="${rutaProyecto(p, 'inicio')}">${esc(p.nombre)}</a></h3>
        <p class="pj-meta">${p.objetivos.filter(o => ctx.objetivos[o]).map(o => esc(ctx.objetivos[o].nombre)).join(' · ')} — ${r.hechas} de ${plural(r.total, 'tarea completada', 'tareas completadas')}${r.bloqueadas.length ? ` · ${plural(r.bloqueadas.length, 'bloqueo', 'bloqueos')}` : ''}</p>
        </li>`; }).join('')}</ul></section>`).join('') || `<p class="vacio">Sin ${titulo.toLowerCase()} registrados.</p>`}`;
}

/* ── Inicio (proyecto o investigación) ── */
function deptosHtml(d) {
  if (d.relacion !== 'con') return `<p>${esc((RELACION_DEPTOS.find(r => r.id === d.relacion) || RELACION_DEPTOS[0]).titulo)}</p>`;
  return `<p>Con relación interdepartamental</p>${d.lista.length ? `<ul class="pj-deptos">${d.lista.map(x => `<li><b>${esc(deptoTitulo(x.id))}</b><span>${x.detalle ? esc(x.detalle) : 'Apoyo, revisión o entrega por describir.'}</span></li>`).join('')}</ul>`
    : '<p class="vacio">Ningún departamento seleccionado.</p>'}
    <p class="nota">Es colaboración: relacionar un departamento no significa que esté bloqueado.</p>`;
}
function distHtml(r) {
  return `<div class="dist"><div class="dist-bar" role="img" aria-label="Tareas por estado: ${COLUMNAS.map(c => `${c.titulo} ${r.por[c.id].length}`).join(', ')}">${COLUMNAS.filter(c => r.por[c.id].length).map(c => `<span class="c-${c.id}" style="flex:${r.por[c.id].length}"></span>`).join('')}</div>
    <ul class="dist-leg">${COLUMNAS.map(c => `<li class="c-${c.id}">${esc(c.titulo)} <b>${r.por[c.id].length}</b></li>`).join('')}</ul></div>`;
}
/* Lista de tareas de una investigación (sin Kanban): estado con selector, estrella y apertura para editar. */
function listaTareasHtml(p, ctx) {
  const ts = ctx.tareasDe(p.id).sort((a, b) => COLUMNAS.findIndex(c => c.id === a.estado) - COLUMNAS.findIndex(c => c.id === b.estado) || a.orden - b.orden);
  return `<section class="pj-sec pj-tareas" aria-labelledby="pj-tar-t">
    <div class="sec-head"><h2 id="pj-tar-t">Tareas de la investigación</h2><button type="button" class="btn btn-sm btn-primary" data-act="nueva-tarea" data-pr="${p.id}">${ICON.plus}Nueva tarea</button></div>
    ${ts.length ? `<ul class="tl">${ts.map(t => `<li class="tl-row c-${t.estado}" data-tk="${t.id}">
      <button type="button" class="star ${t.destacada ? 'on' : ''}" data-act="estrella" data-tk="${t.id}" aria-pressed="${t.destacada}" aria-label="${t.destacada ? 'Quitar el énfasis de' : 'Destacar'} «${esc(t.titulo)}»">${t.destacada ? ICON.star : ICON.starO}</button>
      <div class="tl-main"><button type="button" class="tk-title" data-act="abrir-tarea" data-tk="${t.id}">${esc(t.titulo)}</button>
        <span class="tl-sub">${t.responsable ? esc(t.responsable) : 'Por asignar'}${t.estado === 'blocked' ? ` · <span class="tl-blk">${ICON.lock}Bloqueada</span>` : ''}</span></div>
      <label class="sr-only" for="st-${t.id}">Estado de «${esc(t.titulo)}»</label>
      <select id="st-${t.id}" class="tk-state" data-act="estado" data-tk="${t.id}">${COLUMNAS.map(c => `<option value="${c.id}" ${c.id === t.estado ? 'selected' : ''}>${esc(c.titulo)}</option>`).join('')}</select>
    </li>`).join('')}</ul>` : '<p class="vacio">Sin tareas registradas.</p>'}
  </section>`;
}
export function inicioHtml(p, desde, ctx) {
  const tareas = ctx.tareasDe(p.id), r = resumen(tareas), m = ctx.macros.find(x => x.id === p.macro), inv = esInv(p);
  const incluidas = p.investigaciones.map(id => ctx.proyectos.find(x => x.id === id)).filter(Boolean);
  const alimenta = ctx.proyectos.filter(x => x.investigaciones.includes(p.id));
  const refs = p.referencias.filter(id => ctx.recursos[id]);
  const enlaceTarea = t => (inv ? rutaProyecto(p, 'inicio', desde, `tarea=${t.id}`) : rutaProyecto(p, 'kanban', desde, `tarea=${t.id}`));
  return `${cabecera(p, 'inicio', desde, ctx)}
    <div class="pj-ficha">
      <section class="pj-sec" aria-labelledby="pj-desc-t">
        <h2 id="pj-desc-t" class="sr-only">Presentación</h2>
        ${p.descripcion ? `<p class="pj-desc-lg">${esc(p.descripcion)}</p>` : '<p class="vacio">Sin descripción registrada.</p>'}
        <div class="pj-dl">
          ${p.resultado ? `<div class="full"><dt>Resultado esperado</dt><dd>${esc(p.resultado)}</dd></div>` : ''}
          ${p.entregable ? `<div class="full"><dt>Entregable</dt><dd>${esc(p.entregable)}</dd></div>` : ''}
          <div><dt>Contribuye al macroobjetivo</dt><dd>${m ? `<a href="${rutaMacro(m.id)}">${esc(m.numero)} · ${esc(m.titulo)}</a>${m.resultado ? `<p class="nota">Resultado esperado: ${esc(m.resultado)}</p>` : ''}` : 'Sin macroobjetivo'}</dd></div>
          <div><dt>Objetivos asociados</dt><dd><ul class="pj-chips">${p.objetivos.filter(o => ctx.objetivos[o]).map(o => `<li><a class="tag ${o === desde ? 'is-from' : ''}" href="${rutaObjetivo(o)}">${esc(ctx.objetivos[o].nombre)}</a></li>`).join('')}</ul>
            ${desde && ctx.objetivos[desde] ? `<p class="nota">Llegaste desde «${esc(ctx.objetivos[desde].nombre)}».</p>` : ''}</dd></div>
          <div><dt>Prioridad</dt><dd>${prioPill(p.prioridad)}</dd></div>
          <div><dt>Fecha estimada de entrega</dt><dd>${p.entrega ? `${fmtD(p.entrega)} <span class="nota">· estimada, no es un compromiso confirmado</span>` : '<span class="vacio">Por definir</span>'}</dd></div>
          <div class="full"><dt>Relación con otros departamentos</dt><dd>${deptosHtml(p.departamentos)}</dd></div>
          ${incluidas.length ? `<div class="full"><dt>Investigaciones en las que se basa</dt><dd><ul class="pj-chips">${incluidas.map(x => `<li><a class="tag" href="${rutaProyecto(x)}">${esc(x.nombre)}</a></li>`).join('')}</ul></dd></div>` : ''}
          ${alimenta.length ? `<div class="full"><dt>Alimenta a</dt><dd><ul class="pj-chips">${alimenta.map(x => `<li><a class="tag" href="${rutaProyecto(x)}">${esc(tipoItem(x))}: ${esc(x.nombre)}</a></li>`).join('')}</ul></dd></div>` : ''}
          ${refs.length ? `<div class="full"><dt>Referencias existentes en el sitio</dt><dd><ul class="refs">${refs.map(id => { const rc = ctx.recursos[id]; return `<li>${rc.ruta ? `<a href="${rc.ruta}">${esc(rc.nombre)}</a>` : esc(rc.nombre)} <span class="nota">· ${esc(rc.ubicacion)}</span> ${rc.ruta ? '' : '<span class="pend">Integración pendiente</span>'}</li>`; }).join('')}</ul></dd></div>` : ''}
        </div>
        <div class="pj-actions"><button type="button" class="btn btn-sm" data-act="editar-proyecto" data-pr="${p.id}">${ICON.edit}Editar datos ${inv ? 'de la investigación' : 'del proyecto'}</button></div>
      </section>
      <section class="pj-sec pj-res" aria-labelledby="pj-res-t">
        <h2 id="pj-res-t">Resumen de tareas</h2>
        <p class="pj-big"><b>${r.hechas}</b> de ${plural(r.total, 'tarea completada', 'tareas completadas')}</p>
        <div class="prog" role="img" aria-label="${r.pct} % de tareas completadas"><span style="width:${r.pct}%"></span></div>
        <p class="nota">${r.pct} % de tareas completadas: cuenta tareas, no mide el esfuerzo ejecutado.</p>
        ${distHtml(r)}
        <div class="pj-res-row">
          <div><h3>Bloqueos activos</h3>${r.bloqueadas.length ? `${r.parcial ? `<p class="warn">${ICON.lock} Bloqueo parcial: las demás tareas pueden continuar.</p>` : ''}
            <ul class="pj-mini">${r.bloqueadas.map(t => `<li><a href="${enlaceTarea(t)}">${esc(t.titulo)}</a>${t.bloqueo ? `<small>${esc(t.bloqueo.motivo)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="vacio">Sin bloqueos activos.</p>'}</div>
          <div><h3>Destacadas pendientes</h3>${r.destacadasPend.length ? `<ul class="pj-mini">${r.destacadasPend.map(t => `<li><span class="star-mini" aria-hidden="true">${ICON.star}</span><a href="${enlaceTarea(t)}">${esc(t.titulo)}</a><small>${esc(colTitulo(t.estado))}</small></li>`).join('')}</ul>` : '<p class="vacio">Ninguna.</p>'}</div>
        </div>
        ${inv ? (() => { const rr = ctx.resultadoDe(p.id); return `<div class="rs-teaser"><h3>Resultados de la investigación</h3><p>${resumenResultados(rr.r, rr.estado && rr.estado.datos)}</p></div>
          <a class="btn btn-primary pj-kbtn" href="${rutaProyecto(p, 'resultados', desde)}">Ver resultados ${ICON.arrow}</a>`; })()
          : `<a class="btn btn-primary pj-kbtn" href="${rutaProyecto(p, 'kanban', desde)}">Abrir el Kanban del proyecto ${ICON.arrow}</a>`}
      </section>
    </div>
    ${inv ? listaTareasHtml(p, ctx) : ''}`;
}

/* ── Kanban del proyecto ── tarjeta compacta: estrella, título, responsable y, si aplica, bloqueo, prioridad y fecha. */
function tarjetaHtml(t) {
  const extra = [t.prioridad ? esc(prioTitulo(t.prioridad)) : '', t.fecha ? fmtD(t.fecha) : ''].filter(Boolean).join(' · ');
  return `<li class="tk c-${t.estado}" draggable="true" data-tk="${t.id}">
    <div class="tk-row">
      <button type="button" class="star ${t.destacada ? 'on' : ''}" data-act="estrella" data-tk="${t.id}" aria-pressed="${t.destacada}" aria-label="${t.destacada ? 'Quitar el énfasis de' : 'Destacar'} «${esc(t.titulo)}»" title="${t.destacada ? 'Destacada' : 'Destacar'}">${t.destacada ? ICON.star : ICON.starO}</button>
      <button type="button" class="tk-title" data-act="abrir-tarea" data-tk="${t.id}">${esc(t.titulo)}</button>
    </div>
    <p class="tk-sub">${t.responsable ? esc(t.responsable) : 'Por asignar'}${extra ? ` · ${extra}` : ''}${t.estado === 'blocked' ? ` · <span class="tl-blk">${ICON.lock}Bloqueada</span>` : ''}</p>
    <label class="sr-only" for="st-${t.id}">Estado de «${esc(t.titulo)}»</label>
    <select id="st-${t.id}" class="tk-state" data-act="estado" data-tk="${t.id}">${COLUMNAS.map(c => `<option value="${c.id}" ${c.id === t.estado ? 'selected' : ''}>${esc(c.titulo)}</option>`).join('')}</select>
  </li>`;
}
export function kanbanHtml(p, desde, ctx, S) {
  const todas = ctx.tareasDe(p.id), vis = todas.filter(t => !S.soloDestacadas || t.destacada);
  return `${cabecera(p, 'kanban', desde, ctx)}
    <div class="kb-tools">
      <button type="button" class="btn btn-sm btn-primary" data-act="nueva-tarea" data-pr="${p.id}">${ICON.plus}Nueva tarea</button>
      <label class="check"><input type="checkbox" data-act="solo-destacadas" ${S.soloDestacadas ? 'checked' : ''}> Solo tareas destacadas</label>
      <p class="nota" aria-live="polite">${S.soloDestacadas ? `Mostrando ${vis.length} de ${todas.length} tareas (solo destacadas).` : plural(todas.length, 'tarea', 'tareas') + '.'} La estrella indica especial énfasis; no cambia la prioridad.</p>
    </div>
    <div class="kb">${COLUMNAS.map(c => {
      const ts = vis.filter(t => t.estado === c.id).sort((a, b) => a.orden - b.orden);
      return `<section class="kb-col c-${c.id}" aria-labelledby="kb-h-${c.id}">
        <header class="kb-head"><div><h2 id="kb-h-${c.id}">${esc(c.titulo)}</h2><p>${esc(c.ayuda)}</p></div><span class="n" aria-label="${ts.length} tareas">${ts.length}</span></header>
        <ul class="kb-list" data-col="${c.id}">${ts.map(tarjetaHtml).join('') || '<li class="kb-empty">Sin tareas.</li>'}</ul>
      </section>`;
    }).join('')}</div>`;
}

/* ── Formularios ── */
const opciones = (lista, actual) => lista.map(x => `<option value="${esc(x.id)}" ${x.id === actual ? 'selected' : ''}>${esc(x.titulo)}</option>`).join('');
function deptosCampos(lista, nombre) {
  return `<div class="deptos">${DEPARTAMENTOS.map(d => { const sel = lista.find(x => x.id === d.id); return `<div class="depto">
    <label class="check"><input type="checkbox" name="${nombre}" value="${d.id}" ${sel ? 'checked' : ''} data-depto="${d.id}"> ${esc(d.titulo)}</label>
    <label class="fld depto-det" ${sel ? '' : 'hidden'}><span class="sr-only">Qué se requiere de ${esc(d.titulo)}</span>
      <input name="${nombre}-${d.id}" maxlength="600" value="${esc(sel ? sel.detalle : '')}" placeholder="Apoyo, revisión o entrega que se requiere de ${esc(d.titulo)}" autocomplete="off"></label></div>`; }).join('')}</div>`;
}

export function formProyectoHtml(p) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(tipoItem(p))} · datos de Inicio</p><h2 id="dlg-titulo">Editar «${esc(p.nombre)}»</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <label class="fld"><span>Descripción</span><textarea name="descripcion" rows="3" maxlength="2000">${esc(p.descripcion)}</textarea></label>
      <label class="fld"><span>Resultado esperado</span><textarea name="resultado" rows="2" maxlength="1000">${esc(p.resultado)}</textarea></label>
      ${esInv(p) ? '' : `<label class="fld"><span>Entregable</span><textarea name="entregable" rows="2" maxlength="1000">${esc(p.entregable)}</textarea></label>`}
      <div class="fld-row">
        <label class="fld"><span>Prioridad</span><select name="prioridad">${opciones(PRIORIDADES, p.prioridad)}</select></label>
        <label class="fld"><span>Fecha estimada de entrega</span><input type="date" name="entrega" value="${esc(p.entrega)}"><small class="hint">Vacía = «Por definir». Es una estimación, no un compromiso confirmado.</small></label>
      </div>
      <fieldset class="fld"><legend>Relación con otros departamentos</legend>
        <div class="radios">${RELACION_DEPTOS.map(r => `<label class="check"><input type="radio" name="relacion" value="${r.id}" ${p.departamentos.relacion === r.id ? 'checked' : ''}> ${esc(r.titulo)}</label>`).join('')}</div>
        <div data-deptos ${p.departamentos.relacion === 'con' ? '' : 'hidden'}>${deptosCampos(p.departamentos.lista, 'depto')}
          <p class="hint">Indica qué apoyo, revisión o entrega se requiere. Relacionar un departamento no bloquea el trabajo.</p></div>
      </fieldset>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

/* Edición de una tarea: lo esencial a la vista; el resto, plegado en «Más detalles». */
export function formTareaHtml(t, ctx, nueva) {
  const nDet = t.subtareas.length + t.departamentos.length + t.enlaces.length + (t.evidencias ? 1 : 0);
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${nueva ? 'Nueva tarea' : `Tarea · ${esc(colTitulo(t.estado))}`}</p><h2 id="dlg-titulo">${nueva ? 'Nueva tarea' : esc(t.titulo)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      ${t.estado === 'completed' && t.cierre ? `<div class="aviso ok"><div><b>Completada${t.cierre.fecha ? ` el ${fmtDT(t.cierre.fecha)}` : ''}.</b>${t.cierre.nota ? ` ${esc(t.cierre.nota)}` : ''}</div></div>` : ''}
      <label class="fld"><span>Título <b class="req">*</b></span><input name="titulo" required maxlength="200" value="${esc(t.titulo)}" autocomplete="off"><small class="err" hidden>Escribe un título.</small></label>
      <label class="fld"><span>Descripción</span><textarea name="descripcion" rows="2" maxlength="2000">${esc(t.descripcion)}</textarea></label>
      <div class="fld-row">
        <label class="fld"><span>Estado</span><select name="estado" data-estado>${opciones(COLUMNAS, t.estado)}</select></label>
        <label class="fld"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(t.responsable)}" placeholder="Por asignar" autocomplete="off"></label>
        <label class="fld"><span>Prioridad</span><select name="prioridad">${opciones(PRIORIDADES, t.prioridad)}</select></label>
        <label class="fld"><span>Fecha estimada</span><input type="date" name="fecha" value="${esc(t.fecha)}"></label>
      </div>
      <p class="hint" data-trans></p>
      <div class="fld-row" data-bloqueo ${t.estado === 'blocked' ? '' : 'hidden'}>
        <label class="fld"><span>Motivo del bloqueo</span><textarea name="bloqueoMotivo" rows="2" maxlength="800">${esc(t.bloqueo ? t.bloqueo.motivo : '')}</textarea></label>
        <label class="fld"><span>Qué se necesita para continuar</span><textarea name="bloqueoNecesita" rows="2" maxlength="800">${esc(t.bloqueo ? t.bloqueo.necesita : '')}</textarea></label>
      </div>
      <label class="check"><input type="checkbox" name="destacada" ${t.destacada ? 'checked' : ''}> Destacada (especial énfasis)</label>
      <details class="mas"><summary>Más detalles${nDet ? ` (${nDet})` : ''}</summary>
        <div class="mas-body">
          <label class="fld"><span>Criterio de finalización</span><textarea name="criterio" rows="2" maxlength="1000" placeholder="Sin definir">${esc(t.criterio)}</textarea></label>
          <fieldset class="fld"><legend>Subtareas</legend><ul class="subs" data-subs></ul>
            <div class="sub-add"><label class="sr-only" for="nueva-sub">Nueva subtarea</label><input id="nueva-sub" maxlength="300" placeholder="Nueva subtarea…" autocomplete="off"><button type="button" class="btn btn-sm" data-sub="add">${ICON.plus}Agregar</button></div></fieldset>
          <fieldset class="fld"><legend>Departamentos relacionados</legend>${deptosCampos(t.departamentos, 'tdepto')}</fieldset>
          <label class="fld"><span>Notas</span><textarea name="notas" rows="2" maxlength="4000">${esc(t.notas)}</textarea></label>
          <label class="fld"><span>Enlaces</span><textarea name="enlaces" rows="2" placeholder="Uno por línea (https://…)">${esc(t.enlaces.join('\n'))}</textarea><small class="err" data-err-enlaces hidden></small></label>
          <label class="fld"><span>Evidencias</span><textarea name="evidencias" rows="2" maxlength="4000">${esc(t.evidencias)}</textarea></label>
          ${t.referencias.length ? `<div class="fld"><span class="lbl">Accesos de referencia</span><ul class="refs">${t.referencias.filter(r => ctx.recursos[r]).map(r => { const rc = ctx.recursos[r]; return `<li>${rc.ruta ? `<a href="${rc.ruta}">${esc(rc.nombre)}</a> <span class="nota">· ${esc(rc.ubicacion)}</span>` : `${esc(rc.nombre)} <span class="pend">Integración pendiente</span>`}</li>`; }).join('')}</ul></div>` : ''}
          ${nueva ? '' : `<div class="fld"><span class="lbl">Historial</span><ol class="hist">${[...t.historial].reverse().map(h => `<li><span class="nota">${esc(fmtDT(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol></div>`}
        </div>
      </details>
    </div>
    <div class="dlg-foot">${nueva ? '' : '<button type="button" class="btn btn-ghost tk-borrar" data-tk-borrar>Eliminar tarea</button><span class="sp"></span>'}<button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

/* Cambio de estado que pide datos: Blocked (motivo + qué se necesita) y Completed (nota/evidencia + confirmación). */
export function transicionHtml(t, a) {
  const blk = a === 'blocked';
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(colTitulo(t.estado))} → ${esc(colTitulo(a))}</p><h2 id="dlg2-titulo">${blk ? 'Bloquear tarea' : 'Completar tarea'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body"><p class="tk-ttl">${esc(t.titulo)}</p>
      ${blk ? `<label class="fld"><span>Motivo del bloqueo <b class="req">*</b></span><textarea name="motivo" rows="2" required>${esc(t.bloqueo ? t.bloqueo.motivo : '')}</textarea><small class="err" hidden>Indica el motivo.</small></label>
        <label class="fld"><span>Qué se necesita para continuar <b class="req">*</b></span><textarea name="necesita" rows="2" required>${esc(t.bloqueo ? t.bloqueo.necesita : '')}</textarea><small class="err" hidden>Indica qué se necesita.</small></label>`
        : `<p class="nota"><b>Criterio de finalización:</b> ${t.criterio ? esc(t.criterio) : 'sin definir'}</p>
        <label class="fld"><span>Nota de cierre o evidencia</span><textarea name="nota" rows="3" placeholder="Qué se verificó y cómo (enlace, foto, documento)">${esc(t.cierre ? t.cierre.nota : '')}</textarea></label>
        <label class="check"><input type="checkbox" name="cumple" required> Confirmo que se cumple el criterio de finalización <b class="req">*</b></label><small class="err" data-err-cumple hidden>Confirma el cumplimiento para completar la tarea.</small>`}
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Confirmar</button></div>
  </form>`;
}

/* ── Resultados de una investigación (segunda pestaña; integra las investigaciones ya desarrolladas) ── */
export function resultadosPaginaHtml(p, desde, ctx) {
  const rr = ctx.resultadoDe(p.id);
  return `${cabecera(p, 'resultados', desde, ctx)}${resultadosHtml(rr.r, rr.estado)}`;
}

