/* Vistas de proyecto (Etapa 3): Inicio, Kanban, ficha de tarea, transiciones y condición de inicio.
   Adaptadas de Manufactura (prototipo-neotropya/js/proyecto.js). Diferencias propias de Infraestructura:
   · responsable separado de colaboradores (una persona mencionada no pasa a ser responsable);
   · próxima acción y colaboración necesaria en el Inicio;
   · proyectos condicionados: condición aparte del estado de las tareas, resolución registrada y ejecución iniciada;
   · tareas nuevas en To do con «Estado por confirmar»; la fecha reprogramada queda en el historial.
   Funciones puras que devuelven HTML; el estado y los eventos están en app.js. */
import { esc, plural, ICON, migasHtml, tipoEtiqueta, tipoTxt, macroDe } from './componentes.js';
import { AREA, REGISTROS, COLUMNAS, PRIORIDADES, DEPARTAMENTOS, RELACION_DEPTOS, ESTADOS_CONCLUSION } from './datos.js';
import { rutaRegistro, rutaMacro } from './rutas.js';
import { informe } from './informes-datos.js';

const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
export const fmtDT = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export const colTitulo = id => (COLUMNAS.find(c => c.id === id) || {}).titulo || id;
const prioTitulo = id => (PRIORIDADES.find(p => p.id === id) || PRIORIDADES[0]).titulo;
const deptoTitulo = id => (DEPARTAMENTOS.find(d => d.id === id) || {}).titulo || id;
const prioPill = id => `<span class="pill prio p-${id || 'none'}">${id ? `Prioridad ${esc(prioTitulo(id).toLowerCase())}` : 'Prioridad por definir'}</span>`;
const porDefinir = '<span class="vacio">Por definir</span>';
export const esCond = r => r.tipo === 'condicionado';
export const esInv = r => r.tipo === 'investigacion';
/* Registros que dependen de este (su relación apunta a él): p. ej., el proyecto condicionado de una investigación. */
export const dependientesDe = id => Object.values(REGISTROS).filter(x => x.relaciones.some(rel => rel.id === id));
const concTitulo = id => (ESTADOS_CONCLUSION.find(e => e.id === id) || ESTADOS_CONCLUSION[0]).titulo;
export const concChip = res => `<span class="conc-chip e-${res.estado}">${esc(concTitulo(res.estado))}</span>`;
const I = {
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  starO: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* Resumen calculado a partir de las tareas (nunca se guarda aparte). */
export function resumen(tareas) {
  const por = Object.fromEntries(COLUMNAS.map(c => [c.id, tareas.filter(t => t.estado === c.id)]));
  const total = tareas.length, hechas = por.completed.length;
  const bloqueadas = por.blocked, abiertas = tareas.filter(t => t.estado !== 'completed' && t.estado !== 'blocked');
  return { total, hechas, por, bloqueadas, parcial: bloqueadas.length > 0 && abiertas.length > 0, porConfirmar: tareas.filter(t => t.porConfirmar).length,
    destacadasPend: tareas.filter(t => t.destacada && t.estado !== 'completed'), pct: total ? Math.round(hechas / total * 100) : 0 };
}

/* Estado de un proyecto condicionado. */
export function estadoCondicion(ini) {
  if (ini.ejecucion.iniciada) return { id: 'iniciada', t: 'Ejecución iniciada' };
  if (ini.condicion.resolucion) return { id: 'resuelta', t: 'Condición resuelta · ejecución sin iniciar' };
  return { id: 'pendiente', t: 'Condición sin resolver · solo planificación' };
}

function cabecera(r, ini, pagina) {
  const m = macroDe(r);
  const ec = esCond(r) ? estadoCondicion(ini) : null;
  const segunda = esInv(r) ? { id: 'resultados', t: 'Resultados' } : { id: 'kanban', t: 'Kanban' };
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: `${m.numero} ${m.corto}`, href: rutaMacro(m.id) }, { t: r.nombre, href: rutaRegistro(r, 'inicio') }, { t: pagina === segunda.id ? segunda.t : 'Inicio' }])}
    <header class="pj-head ficha-head" data-macro="${m.id}">
      ${tipoEtiqueta(r)}
      <h1 id="pg-titulo" tabindex="-1">${esc(r.nombre)}</h1>
      ${esInv(r) ? '<p class="pg-intro">Reunir información, analizarla y obtener conclusiones.</p>' : ''}
      <div class="pj-head-row">
        <nav class="pj-tabs" aria-label="Vistas ${esInv(r) ? 'de la investigación' : 'del proyecto'}">
          <a href="${rutaRegistro(r, 'inicio')}" ${pagina === 'inicio' ? 'aria-current="page"' : ''}>Inicio</a>
          <a href="${rutaRegistro(r, segunda.id)}" ${pagina === segunda.id ? 'aria-current="page"' : ''}>${segunda.t}</a></nav>
        ${ec ? `<a class="cond-chip c-${ec.id}" href="${rutaRegistro(r, 'inicio')}" data-act="ir-condicion">${ICON.cond}${esc(ec.t)}</a>` : ''}
      </div>
    </header>`;
}

/* ── Inicio ── */
function deptosHtml(d) {
  if (d.relacion !== 'con') return `<p>${esc((RELACION_DEPTOS.find(x => x.id === d.relacion) || RELACION_DEPTOS[0]).titulo)}</p>`;
  return `<p>Con relación interdepartamental</p>${d.lista.length ? `<ul class="pj-deptos">${d.lista.map(x => `<li><b>${esc(deptoTitulo(x.id))}</b><span>${x.detalle ? esc(x.detalle) : 'Apoyo, revisión o entrega por describir.'}</span></li>`).join('')}</ul>`
    : '<p class="vacio">Ningún departamento seleccionado.</p>'}
    <p class="nota">Es colaboración: relacionar un departamento no significa que esté bloqueado.</p>`;
}
function distHtml(r) {
  return `<div class="dist"><div class="dist-bar" role="img" aria-label="Tareas por estado: ${COLUMNAS.map(c => `${c.titulo} ${r.por[c.id].length}`).join(', ')}">${COLUMNAS.filter(c => r.por[c.id].length).map(c => `<span class="c-${c.id}" style="flex:${r.por[c.id].length}"></span>`).join('')}</div>
    <ul class="dist-leg">${COLUMNAS.map(c => `<li class="c-${c.id}">${esc(c.titulo)} <b>${r.por[c.id].length}</b></li>`).join('')}</ul></div>`;
}
function condicionHtml(r, ini, resultados) {
  const res = ini.condicion.resolucion, ec = estadoCondicion(ini);
  // Investigaciones de las que depende: su conclusión se muestra como referencia; no resuelve la condición por sí sola.
  const invs = r.relaciones.map(x => REGISTROS[x.id]).filter(o => esInv(o));
  return `<section class="pj-sec ficha-cond" id="condicion" aria-labelledby="h-cond">
      <div class="sec-head"><h2 id="h-cond">${ICON.cond} Condición de inicio</h2><span class="cond-chip c-${ec.id}">${esc(ec.t)}</span></div>
      <p class="cond-txt">${esc(r.condicion)}</p>
      ${invs.length ? `<ul class="cond-inv">${invs.map(o => { const rr = resultados[o.id]; return `<li>${ICON.lupa}<span>Investigación <a href="${rutaRegistro(o, 'resultados')}">${esc(o.nombre)}</a>: ${concChip(rr)}${rr.estado === 'aprobada' && rr.conclusion ? `<small>${esc(rr.conclusion)}</small>` : ''}</span></li>`; }).join('')}</ul>
        <p class="nota">La conclusión de la investigación es una referencia: la condición se resuelve solo cuando se registra su resolución.</p>` : ''}
      <p class="nota">Se muestra aparte del estado de las tareas. Mientras no se registre su resolución, el proyecto se puede consultar y planificar (editar tareas, responsables y fechas), pero sus tareas no pasan a Doing, Testing ni Completed.</p>
      ${res ? `<div class="cond-res"><span class="cond-res-t">${I.check} Resolución registrada</span>
          <p>${esc(res.nota)}</p><p class="nota">Confirmó: ${esc(res.quien)}${res.fecha ? ` · ${fmtD(res.fecha)}` : ''}${res.registrada ? ` · registrada el ${esc(fmtDT(res.registrada))}` : ''}</p></div>` : ''}
      <div class="pj-actions">
        ${res ? (ini.ejecucion.iniciada ? `<p class="cond-ok">${I.check} Ejecución iniciada${ini.ejecucion.fecha ? ` el ${esc(fmtDT(ini.ejecucion.fecha))}` : ''}.</p>`
          : `<button type="button" class="btn btn-sm btn-primary" data-act="iniciar-ejecucion" data-pr="${r.id}">Marcar la ejecución como iniciada</button>
             <button type="button" class="btn btn-sm btn-ghost" data-act="anular-resolucion" data-pr="${r.id}">Anular la resolución</button>`)
          : `<button type="button" class="btn btn-sm btn-primary" data-act="resolver-condicion" data-pr="${r.id}">Registrar que la condición se resolvió</button>
             <button type="button" class="btn btn-sm" disabled title="Primero registra la resolución de la condición">Marcar la ejecución como iniciada</button>`}
      </div>
    </section>`;
}
export function inicioHtml(r, ini, tareas, resultados) {
  const res = resumen(tareas), m = macroDe(r);
  const inv = esInv(r), deps = inv ? dependientesDe(r.id) : [];
  const enlaceTarea = t => rutaRegistro(r, inv ? 'inicio' : 'kanban', `tarea=${t.id}`);
  return `${cabecera(r, ini, 'inicio')}
    ${esCond(r) ? condicionHtml(r, ini, resultados) : ''}
    <div class="pj-ficha">
      <section class="pj-sec" aria-labelledby="pj-desc-t">
        <h2 id="pj-desc-t" class="sr-only">Presentación</h2>
        ${ini.descripcion ? `<p class="pj-desc-lg">${esc(ini.descripcion)}</p>` : '<p class="vacio">Sin descripción registrada.</p>'}
        <dl class="pj-dl">
          <div class="full"><dt>Próxima acción</dt><dd>${ini.proximaAccion ? `<p class="prox">${esc(ini.proximaAccion)}</p>` : porDefinir}</dd></div>
          <div><dt>Contribuye al macroobjetivo</dt><dd><a href="${rutaMacro(m.id)}">${esc(m.numero)} · ${esc(m.titulo)}</a></dd></div>
          <div><dt>Prioridad</dt><dd>${prioPill(ini.prioridad)}${m.prioridad === 'critica' ? '<p class="nota">El macroobjetivo tiene prioridad crítica.</p>' : ''}</dd></div>
          <div><dt>Responsable</dt><dd>${ini.responsable ? esc(ini.responsable) : '<span class="vacio">Por asignar</span>'}</dd></div>
          <div><dt>Fecha estimada</dt><dd>${ini.entrega ? `${fmtD(ini.entrega)} <span class="nota">· estimada, no es un compromiso confirmado</span>` : porDefinir}</dd></div>
          <div class="full"><dt>Colaboradores</dt><dd>${ini.colaboradores ? esc(ini.colaboradores) : '<span class="vacio">Sin colaboradores registrados</span>'}
            <p class="nota">Colaboran; no son responsables.</p></dd></div>
          <div class="full"><dt>Departamentos relacionados</dt><dd>${deptosHtml(ini.departamentos)}</dd></div>
          <div class="full"><dt>Colaboración necesaria</dt><dd>${ini.colaboracion ? esc(ini.colaboracion) : porDefinir}</dd></div>
          ${r.relaciones.length ? `<div class="full"><dt>Relaciones</dt><dd><ul class="rg-rel">${r.relaciones.map(x => { const o = REGISTROS[x.id], om = macroDe(o); return `<li>${ICON.enlace}<span>${tipoEtiqueta(o)} <a href="${rutaRegistro(o)}">${esc(o.nombre)}</a>${om.id !== r.macro ? ` <small>(${om.numero})</small>` : ''} — ${esc(x.texto)}</span></li>`; }).join('')}</ul></dd></div>` : ''}
          ${deps.length ? `<div class="full"><dt>Dependen de sus resultados</dt><dd><ul class="rg-rel">${deps.map(o => `<li>${ICON.enlace}<span>${tipoEtiqueta(o)} <a href="${rutaRegistro(o)}">${esc(o.nombre)}</a> — ${esc(o.relaciones.find(x => x.id === r.id).texto)}</span></li>`).join('')}</ul></dd></div>` : ''}
          ${(m.notas || []).length ? `<div class="full"><dt>Notas del macroobjetivo</dt><dd><ul class="mo-notas">${m.notas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></dd></div>` : ''}
          ${(m.antecedentes || []).length ? `<div class="full"><dt>Antecedentes</dt><dd><div class="mo-ant"><ul>${m.antecedentes.map(x => `<li><b>${esc(x.titulo)}</b> — ${esc(x.nota)}</li>`).join('')}</ul></div></dd></div>` : ''}
        </dl>
        <div class="pj-actions"><button type="button" class="btn btn-sm" data-act="editar-proyecto" data-pr="${r.id}">${I.edit}Editar datos ${inv ? 'de la investigación' : 'del proyecto'}</button></div>
      </section>
      <section class="pj-sec pj-res" aria-labelledby="pj-res-t">
        <h2 id="pj-res-t">Resumen de actividades</h2>
        <p class="pj-big"><b>${res.hechas}</b> de ${plural(res.total, 'tarea completada', 'tareas completadas')}</p>
        <div class="prog" role="img" aria-label="${res.pct} % de tareas completadas"><span style="width:${res.pct}%"></span></div>
        <p class="nota">${res.pct} % de tareas completadas: cuenta tareas, no mide el esfuerzo ejecutado.</p>
        ${distHtml(res)}
        ${res.porConfirmar ? `<p class="nota"><span class="pend">Estado por confirmar</span> ${plural(res.porConfirmar, 'tarea', 'tareas')} sin estado de ejecución confirmado.</p>` : ''}
        <div class="pj-res-row">
          <div><h3>Bloqueos activos</h3>${res.bloqueadas.length ? `${res.parcial ? `<p class="warn">${I.lock} Bloqueo parcial: las demás tareas pueden continuar.</p>` : ''}
            <ul class="pj-mini">${res.bloqueadas.map(t => `<li><a href="${enlaceTarea(t)}">${esc(t.titulo)}</a>${t.bloqueo ? `<small>${esc(t.bloqueo.motivo)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="vacio">Sin bloqueos activos.</p>'}</div>
          <div><h3>Destacadas pendientes</h3>${res.destacadasPend.length ? `<ul class="pj-mini">${res.destacadasPend.map(t => `<li><span class="star-mini" aria-hidden="true">${ICON.star}</span><a href="${enlaceTarea(t)}">${esc(t.titulo)}</a><small>${esc(colTitulo(t.estado))}</small></li>`).join('')}</ul>` : '<p class="vacio">Ninguna.</p>'}</div>
        </div>
        ${!res.total && r.sinActividades ? `<p class="aviso sin-act">${esc(r.sinActividades)}</p>` : ''}
        ${inv ? `<div class="rs-teaser"><h3>Resultados</h3><p>${concChip(resultados[r.id])} · ${plural(resultados[r.id].fuentes.length, 'fuente', 'fuentes')}</p></div>
          <a class="btn btn-primary pj-kbtn" href="${rutaRegistro(r, 'resultados')}">Ver resultados ${ICON.arrow}</a>`
          : `<a class="btn btn-primary pj-kbtn" href="${rutaRegistro(r, 'kanban')}">Abrir el Kanban del proyecto ${ICON.arrow}</a>`}
      </section>
    </div>
    ${inv ? listaTareasHtml(r, tareas) : ''}`;
}

/* ── Kanban ── */
function tarjetaHtml(t) {
  const extra = [t.prioridad ? esc(prioTitulo(t.prioridad)) : '', t.fecha ? fmtD(t.fecha) : ''].filter(Boolean).join(' · ');
  return `<li class="tk c-${t.estado}" draggable="true" data-tk="${t.id}">
    <div class="tk-row">
      <button type="button" class="star ${t.destacada ? 'on' : ''}" data-act="estrella" data-tk="${t.id}" aria-pressed="${t.destacada}" aria-label="${t.destacada ? 'Quitar el énfasis de' : 'Destacar'} «${esc(t.titulo)}»" title="${t.destacada ? 'Destacada' : 'Destacar'}">${t.destacada ? I.star : I.starO}</button>
      <button type="button" class="tk-title" data-act="abrir-tarea" data-tk="${t.id}">${esc(t.titulo)}</button>
    </div>
    <p class="tk-sub">${t.responsable ? esc(t.responsable) : 'Por asignar'}${extra ? ` · ${extra}` : ''}${t.estado === 'blocked' ? ` · <span class="tl-blk">${I.lock}Bloqueada</span>` : ''}</p>
    ${t.porConfirmar ? '<p class="tk-pend"><span class="pend">Estado por confirmar</span></p>' : ''}
    <label class="sr-only" for="st-${t.id}">Estado de «${esc(t.titulo)}»</label>
    <select id="st-${t.id}" class="tk-state" data-act="estado" data-tk="${t.id}">${COLUMNAS.map(c => `<option value="${c.id}" ${c.id === t.estado ? 'selected' : ''}>${esc(c.titulo)}</option>`).join('')}</select>
  </li>`;
}
export function kanbanHtml(r, ini, tareas, S) {
  const vis = tareas.filter(t => !S.soloDestacadas || t.destacada);
  const ec = esCond(r) ? estadoCondicion(ini) : null;
  return `${cabecera(r, ini, 'kanban')}
    ${ec && ec.id !== 'iniciada' ? `<p class="aviso cond-aviso">${ICON.cond}<span><b>Proyecto condicionado.</b> ${ec.id === 'pendiente' ? 'La condición de inicio no se ha resuelto' : 'La ejecución no se ha marcado como iniciada'}: puedes planificar (To do, Blocked, editar tareas), pero no mover tareas a Doing, Testing ni Completed. <a href="${rutaRegistro(r, 'inicio')}">Ver la condición en Inicio</a>.</span></p>` : ''}
    ${!tareas.length && r.sinActividades ? `<p class="aviso sin-act">${esc(r.sinActividades)} Se podrán agregar cuando se apruebe el alcance de la investigación relacionada.</p>` : ''}
    <div class="kb-tools">
      <button type="button" class="btn btn-sm btn-primary" data-act="nueva-tarea" data-pr="${r.id}">${I.plus}Nueva tarea</button>
      <label class="check"><input type="checkbox" data-act="solo-destacadas" ${S.soloDestacadas ? 'checked' : ''}> Solo tareas destacadas</label>
      <p class="nota" aria-live="polite">${S.soloDestacadas ? `Mostrando ${vis.length} de ${tareas.length} tareas (solo destacadas).` : plural(tareas.length, 'tarea', 'tareas') + '.'} La estrella indica especial énfasis; no cambia la prioridad ni el estado.</p>
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

export function formProyectoHtml(r, ini) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(tipoTxt(r))} · datos de Inicio</p><h2 id="dlg-titulo">Editar «${esc(r.nombre)}»</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <label class="fld"><span>Descripción</span><textarea name="descripcion" rows="3" maxlength="2000">${esc(ini.descripcion)}</textarea></label>
      <label class="fld"><span>Próxima acción</span><input name="proximaAccion" maxlength="600" value="${esc(ini.proximaAccion)}" placeholder="Por definir" autocomplete="off"></label>
      <div class="fld-row">
        <label class="fld"><span>Prioridad</span><select name="prioridad">${opciones(PRIORIDADES, ini.prioridad)}</select></label>
        <label class="fld"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(ini.responsable)}" placeholder="Por asignar" autocomplete="off"><small class="hint">Quien responde por el proyecto. No basta con estar mencionado.</small></label>
        <label class="fld"><span>Fecha estimada</span><input type="date" name="entrega" value="${esc(ini.entrega)}"><small class="hint">Vacía = «Por definir».</small></label>
      </div>
      <label class="fld"><span>Colaboradores</span><input name="colaboradores" maxlength="600" value="${esc(ini.colaboradores)}" placeholder="Personas o proveedores que colaboran (no son responsables)" autocomplete="off"></label>
      <fieldset class="fld"><legend>Departamentos relacionados</legend>
        <div class="radios">${RELACION_DEPTOS.map(x => `<label class="check"><input type="radio" name="relacion" value="${x.id}" ${ini.departamentos.relacion === x.id ? 'checked' : ''}> ${esc(x.titulo)}</label>`).join('')}</div>
        <div data-deptos ${ini.departamentos.relacion === 'con' ? '' : 'hidden'}>${deptosCampos(ini.departamentos.lista, 'depto')}</div>
      </fieldset>
      <label class="fld"><span>Colaboración necesaria</span><textarea name="colaboracion" rows="2" maxlength="1000" placeholder="Apoyo externo o interno que se necesita (p. ej., herrero, centro comercial)">${esc(ini.colaboracion)}</textarea></label>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

/* Registro de la resolución de la condición (cómo, quién, cuándo). */
export function formCondicionHtml(r) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Condición de inicio</p><h2 id="dlg-titulo">Registrar la resolución</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="cond-txt">${esc(r.condicion)}</p>
      <label class="fld"><span>Cómo se resolvió <b class="req">*</b></span><textarea name="nota" rows="3" maxlength="1000" required placeholder="Decisión tomada, alternativa seleccionada, aprobación recibida…"></textarea><small class="err" hidden>Describe cómo se resolvió.</small></label>
      <div class="fld-row">
        <label class="fld"><span>Quién lo confirmó <b class="req">*</b></span><input name="quien" maxlength="120" required autocomplete="off"><small class="err" hidden>Indica quién lo confirmó.</small></label>
        <label class="fld"><span>Fecha</span><input type="date" name="fecha" value="${hoy}"></label>
      </div>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar</button></div>
  </form>`;
}

/* Edición de una tarea: lo esencial a la vista; el resto, plegado en «Más detalles». */
export function formTareaHtml(t, nueva) {
  const nDet = t.subtareas.length + t.departamentos.length + t.enlaces.length + (t.evidencias ? 1 : 0) + (t.notas ? 1 : 0);
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
        <label class="fld"><span>Fecha estimada</span><input type="date" name="fecha" value="${esc(t.fecha)}"><small class="hint">Si cambia, la fecha anterior queda en el historial.</small></label>
      </div>
      <label class="check"><input type="checkbox" name="porConfirmar" ${t.porConfirmar ? 'checked' : ''}> Estado por confirmar</label>
      <p class="hint" data-trans></p>
      <div class="fld-row" data-bloqueo ${t.estado === 'blocked' ? '' : 'hidden'}>
        <label class="fld"><span>Motivo del bloqueo</span><textarea name="bloqueoMotivo" rows="2" maxlength="800">${esc(t.bloqueo ? t.bloqueo.motivo : '')}</textarea></label>
        <label class="fld"><span>Qué se necesita para continuar</span><textarea name="bloqueoNecesita" rows="2" maxlength="800">${esc(t.bloqueo ? t.bloqueo.necesita : '')}</textarea></label>
      </div>
      <label class="fld"><span>Colaboradores</span><input name="colaboradores" maxlength="600" value="${esc(t.colaboradores)}" placeholder="Personas que colaboran (no son responsables)" autocomplete="off"></label>
      <label class="check"><input type="checkbox" name="destacada" ${t.destacada ? 'checked' : ''}> Destacada (especial énfasis)</label>
      <details class="mas"><summary>Más detalles${nDet ? ` (${nDet})` : ''}</summary>
        <div class="mas-body">
          <label class="fld"><span>Criterio de finalización</span><textarea name="criterio" rows="2" maxlength="1000" placeholder="Sin definir">${esc(t.criterio)}</textarea></label>
          <fieldset class="fld"><legend>Subtareas</legend><ul class="subs" data-subs></ul>
            <div class="sub-add"><label class="sr-only" for="nueva-sub">Nueva subtarea</label><input id="nueva-sub" maxlength="300" placeholder="Nueva subtarea…" autocomplete="off"><button type="button" class="btn btn-sm" data-sub="add">${I.plus}Agregar</button></div></fieldset>
          <fieldset class="fld"><legend>Departamentos relacionados</legend>${deptosCampos(t.departamentos, 'tdepto')}</fieldset>
          <label class="fld"><span>Notas</span><textarea name="notas" rows="2" maxlength="4000">${esc(t.notas)}</textarea></label>
          <label class="fld"><span>Enlaces</span><textarea name="enlaces" rows="2" placeholder="Uno por línea (https://…)">${esc(t.enlaces.join('\n'))}</textarea><small class="err" data-err-enlaces hidden></small></label>
          <label class="fld"><span>Evidencias</span><textarea name="evidencias" rows="2" maxlength="4000" placeholder="Fotos, documentos o verificaciones (descripción o enlace)">${esc(t.evidencias)}</textarea></label>
          ${t.origen ? `<p class="nota">Origen: ${esc(t.origen)}</p>` : ''}
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

/* ── Investigaciones: lista de tareas (sin Kanban) ── estado con selector, estrella y apertura para editar. */
function listaTareasHtml(r, tareas) {
  const ts = [...tareas].sort((a, b) => COLUMNAS.findIndex(c => c.id === a.estado) - COLUMNAS.findIndex(c => c.id === b.estado) || a.orden - b.orden);
  return `<section class="pj-sec pj-tareas" aria-labelledby="pj-tar-t">
    <div class="sec-head"><h2 id="pj-tar-t">Tareas de la investigación</h2><button type="button" class="btn btn-sm btn-primary" data-act="nueva-tarea" data-pr="${r.id}">${I.plus}Nueva tarea</button></div>
    ${ts.length ? `<ul class="tl">${ts.map(t => `<li class="tl-row c-${t.estado}" data-tk="${t.id}">
      <button type="button" class="star ${t.destacada ? 'on' : ''}" data-act="estrella" data-tk="${t.id}" aria-pressed="${t.destacada}" aria-label="${t.destacada ? 'Quitar el énfasis de' : 'Destacar'} «${esc(t.titulo)}»">${t.destacada ? I.star : I.starO}</button>
      <div class="tl-main"><button type="button" class="tk-title" data-act="abrir-tarea" data-tk="${t.id}">${esc(t.titulo)}</button>
        <span class="tl-sub">${t.responsable ? esc(t.responsable) : 'Por asignar'}${t.fecha ? ` · ${fmtD(t.fecha)}` : ''}${t.estado === 'blocked' ? ` · <span class="tl-blk">${I.lock}Bloqueada</span>` : ''}${t.porConfirmar ? ' · <span class="pend">Estado por confirmar</span>' : ''}</span></div>
      <label class="sr-only" for="st-${t.id}">Estado de «${esc(t.titulo)}»</label>
      <select id="st-${t.id}" class="tk-state" data-act="estado" data-tk="${t.id}">${COLUMNAS.map(c => `<option value="${c.id}" ${c.id === t.estado ? 'selected' : ''}>${esc(c.titulo)}</option>`).join('')}</select>
    </li>`).join('')}</ul>` : '<p class="vacio">Sin tareas registradas.</p>'}
  </section>`;
}

/* Informe fijo de una investigación (informes-datos.js): resumen, tabla por local y lista preliminar de compra. */
function informeHtml(id) {
  const inf = informe(id); if (!inf) return '';
  const est = { falta: ['Sin extintor', 'inf-falta'], tiene: ['Tiene 1 extintor', 'inf-tiene'], pendiente: ['Por inspeccionar', 'inf-pend'] };
  return `<section class="pj-sec inf" aria-labelledby="inf-t">
    <div class="sec-head"><h2 id="inf-t">${esc(inf.titulo)}</h2><span class="nota">${fmtD(inf.fecha)}</span></div>
    <p class="inf-resumen">${esc(inf.resumen)}</p>
    <h3>Resultados y acciones por local</h3>
    <ul class="inf-locales">${inf.locales.map(l => { const [et, cls] = est[l.estado] || ['', '']; return `<li class="inf-local ${cls}">
      <div class="inf-lhead"><div><b>${esc(l.espacio)}</b>${l.detalle ? `<small>${esc(l.detalle)}</small>` : ''}</div>${et ? `<span class="inf-chip">${et}</span>` : ''}</div>
      <dl><div><dt>Resultado</dt><dd>${esc(l.resultado)}</dd></div><div><dt>Por hacer</dt><dd>${esc(l.porHacer)}</dd></div></dl>
    </li>`; }).join('')}</ul>
    <h3>Lista preliminar de compra</h3>
    <p class="nota">Preliminar: por ahora no se realizan compras ni se comprometen gastos.</p>
    <ul class="inf-compra">${inf.compra.map(c => `<li><b>${esc(c.espacio)}</b><span>${esc(c.texto)}</span></li>`).join('')}</ul>
    ${inf.notasCompra ? `<p class="inf-notas">${esc(inf.notasCompra)}</p>` : ''}
    <p class="nota">Base técnica y documental: ${inf.base.map(esc).join(' · ')}. Fuente: ${esc(inf.origen)}</p>
  </section>`;
}

/* ── Resultados de una investigación: conclusión, hallazgos y fuentes; y a quién alimentan ── */
export function resultadosHtml(r, ini, res) {
  const deps = dependientesDe(r.id);
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return `${cabecera(r, ini, 'resultados')}
    ${informeHtml(r.id)}
    <div class="pj-ficha rs-ficha">
      <section class="pj-sec rs-conc" aria-labelledby="rs-conc-t">
        <div class="sec-head"><h2 id="rs-conc-t">Conclusión</h2>${concChip(res)}</div>
        ${res.conclusion ? `<p class="pj-desc-lg">${esc(res.conclusion)}</p>` : '<p class="vacio">Sin conclusión registrada.</p>'}
        ${res.recomendacion ? `<div><h3>Recomendación</h3><p>${esc(res.recomendacion)}</p></div>` : ''}
        ${res.aprobacion ? `<p class="nota">Aprobada por ${esc(res.aprobacion.quien)}${res.aprobacion.fecha ? ` · ${fmtD(res.aprobacion.fecha)}` : ''}</p>` : ''}
        <div><h3>Hallazgos</h3>${res.hallazgos ? `<p class="rs-hall">${esc(res.hallazgos)}</p>` : '<p class="vacio">Sin hallazgos registrados.</p>'}</div>
        <div class="pj-actions"><button type="button" class="btn btn-sm" data-act="editar-resultado" data-pr="${r.id}">${I.edit}Editar conclusión y hallazgos</button></div>
      </section>
      <section class="pj-sec" aria-labelledby="rs-dep-t">
        <h2 id="rs-dep-t">Alimenta a</h2>
        ${deps.length ? `<ul class="rg-rel">${deps.map(o => `<li>${ICON.enlace}<span>${tipoEtiqueta(o)} <a href="${rutaRegistro(o)}">${esc(o.nombre)}</a> — ${esc(o.relaciones.find(x => x.id === r.id).texto)}${o.condicion ? `<small>Condición: ${esc(o.condicion)}</small>` : ''}</span></li>`).join('')}</ul>
          <p class="nota">Aprobar la conclusión no inicia esos proyectos: su condición se resuelve en su propio Inicio.</p>` : '<p class="vacio">Ningún proyecto depende de sus resultados.</p>'}
      </section>
    </div>
    <section class="pj-sec rs-fuentes" aria-labelledby="rs-fu-t">
      <div class="sec-head"><h2 id="rs-fu-t">Fuentes</h2><button type="button" class="btn btn-sm btn-primary" data-act="nueva-fuente" data-pr="${r.id}">${I.plus}Agregar fuente</button></div>
      ${res.fuentes.length ? `<ul class="fu-list">${res.fuentes.map(f => `<li class="fu">
        <div class="fu-main"><b>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)}</a>` : esc(f.titulo)}</b>
          <span class="nota">${[f.tipo, f.url ? host(f.url) : '', f.fecha ? fmtD(f.fecha) : ''].filter(Boolean).map(esc).join(' · ')}</span>
          ${f.nota ? `<p>${esc(f.nota)}</p>` : ''}</div>
        <button type="button" class="icon-btn sm" data-act="editar-fuente" data-pr="${r.id}" data-fu="${esc(f.id)}" aria-label="Editar la fuente «${esc(f.titulo)}»">${I.edit}</button>
      </li>`).join('')}</ul>` : '<p class="vacio">Sin fuentes registradas. Agrega mediciones, cotizaciones, fichas técnicas, fotos o conversaciones que sustenten la conclusión.</p>'}
    </section>`;
}

export function formResultadoHtml(r, res) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Resultados · ${esc(r.nombre)}</p><h2 id="dlg-titulo">Conclusión y hallazgos</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <label class="fld"><span>Hallazgos</span><textarea name="hallazgos" rows="4" maxlength="6000" placeholder="Qué se encontró: datos, mediciones, comparaciones…">${esc(res.hallazgos)}</textarea></label>
      <label class="fld"><span>Conclusión</span><textarea name="conclusion" rows="3" maxlength="4000">${esc(res.conclusion)}</textarea></label>
      <label class="fld"><span>Recomendación</span><textarea name="recomendacion" rows="2" maxlength="2000" placeholder="Qué se propone hacer con la conclusión">${esc(res.recomendacion)}</textarea></label>
      <fieldset class="fld"><legend>Estado de la conclusión</legend>
        <div class="radios">${ESTADOS_CONCLUSION.map(e => `<label class="check"><input type="radio" name="estado" value="${e.id}" ${res.estado === e.id ? 'checked' : ''}> ${esc(e.titulo)}</label>`).join('')}</div></fieldset>
      <div class="fld-row" data-aprob ${res.estado === 'aprobada' ? '' : 'hidden'}>
        <label class="fld"><span>Aprobada por <b class="req">*</b></span><input name="quien" maxlength="120" value="${esc(res.aprobacion ? res.aprobacion.quien : '')}" autocomplete="off"><small class="err" hidden>Indica quién aprobó la conclusión.</small></label>
        <label class="fld"><span>Fecha</span><input type="date" name="fecha" value="${esc(res.aprobacion ? res.aprobacion.fecha : hoy)}"></label>
      </div>
      <p class="hint">Una conclusión aprobada necesita texto y quién la aprobó.</p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

export function formFuenteHtml(f, nueva) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Fuente</p><h2 id="dlg-titulo">${nueva ? 'Agregar fuente' : 'Editar fuente'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <label class="fld"><span>Título <b class="req">*</b></span><input name="titulo" maxlength="300" value="${esc(f.titulo)}" required autocomplete="off"><small class="err" hidden>Escribe un título.</small></label>
      <div class="fld-row">
        <label class="fld"><span>Tipo</span><input name="tipo" maxlength="80" value="${esc(f.tipo)}" placeholder="Medición, cotización, ficha técnica…" autocomplete="off" list="tipos-fuente"></label>
        <label class="fld"><span>Fecha</span><input type="date" name="fecha" value="${esc(f.fecha)}"></label>
      </div>
      <datalist id="tipos-fuente"><option value="Medición"><option value="Cotización"><option value="Ficha técnica"><option value="Fotografía"><option value="Conversación"><option value="Documento"></datalist>
      <label class="fld"><span>Enlace</span><input name="url" type="url" maxlength="1000" value="${esc(f.url)}" placeholder="https://…" autocomplete="off"><small class="err" data-err-url hidden>El enlace debe empezar por https://</small></label>
      <label class="fld"><span>Nota</span><textarea name="nota" rows="3" maxlength="2000" placeholder="Qué aporta esta fuente">${esc(f.nota)}</textarea></label>
    </div>
    <div class="dlg-foot">${nueva ? '' : '<button type="button" class="btn btn-ghost fu-borrar" data-fu-borrar>Quitar fuente</button>'}<span class="sp"></span><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
