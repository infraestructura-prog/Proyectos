/* Kanban general: UNA tarjeta por macroobjetivo, en las cinco columnas.
   · Al hacer clic en la tarjeta se abre un panel (solo navegación): resultado esperado, avance de sus tareas,
     objetivos asociados con sus proyectos e investigaciones (enlaces a su desarrollo) y tareas recurrentes.
   · La edición de la tarjeta (estado, responsable, prioridad, fecha, notas) está en un botón aparte (✎),
     en su propia ventana, para no interferir con esa navegación.
   El estado de la tarjeta lo decide el equipo: el avance de las tareas se muestra como referencia, no la mueve. */
import { esc, ICON, plural, migasHtml, objetivoBloqueHtml, recurrenteHtml } from './componentes.js';
import { COLUMNAS, PRIORIDADES } from './datos-proyectos.js';
import { DIVISION } from './datos.js';
import { rutaMacro } from './rutas.js';

const COL = COLUMNAS.map(c => c.id);
const colTitulo = id => (COLUMNAS.find(c => c.id === id) || {}).titulo || id;
const prioTitulo = id => (PRIORIDADES.find(p => p.id === id) || PRIORIDADES[0]).titulo;
const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const fmtDT = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function normTarjeta(x = {}) {
  const b = x.bloqueo, c = x.cierre;
  return {
    estado: COL.includes(x.estado) ? x.estado : 'todo', orden: Number.isFinite(x.orden) ? x.orden : 0,
    responsable: str(x.responsable, 120), prioridad: PRIORIDADES.some(p => p.id === x.prioridad) ? x.prioridad : '',
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha || '') ? x.fecha : '', notas: str(x.notas, 4000),
    bloqueo: b && str(b.motivo, 800) ? { motivo: str(b.motivo, 800), necesita: str(b.necesita, 800) } : null,
    cierre: c && c.criterioCumplido ? { nota: str(c.nota, 2000), criterioCumplido: true, fecha: str(c.fecha, 40) } : null,
    historial: (Array.isArray(x.historial) ? x.historial : []).filter(h => h && typeof h === 'object').map(h => ({ fecha: str(h.fecha, 40), nota: str(h.nota, 1000) })).slice(-200)
  };
}

/* Tarjetas de todos los macroobjetivos (las que falten se crean en To do, sin datos inventados). */
export function asegurarTablero(guardado, macros) {
  const t = {}; let cambio = !guardado;
  macros.forEach((m, i) => {
    if (guardado && guardado[m.id]) t[m.id] = normTarjeta(guardado[m.id]);
    else { t[m.id] = normTarjeta({ estado: 'todo', orden: i + 1, historial: [{ fecha: new Date().toISOString(), nota: 'Tarjeta creada en To do.' }] }); cambio = true; }
  });
  return { tablero: t, cambio };
}

const avance = (m, ctx) => {
  const ts = ctx.proyectos.filter(p => p.macro === m.id).flatMap(p => ctx.tareasDe(p.id));
  return { total: ts.length, hechas: ts.filter(t => t.estado === 'completed').length, bloqueadas: ts.filter(t => t.estado === 'blocked').length,
    por: Object.fromEntries(COLUMNAS.map(c => [c.id, ts.filter(t => t.estado === c.id).length])) };
};

/* ── Tablero ── */
function tarjetaHtml(m, k, ctx) {
  const a = avance(m, ctx);
  return `<li class="tk mk c-${k.estado}" draggable="true" data-mk="${m.id}">
    <div class="mk-top"><span class="mk-num">${esc(m.numero)}</span>
      <button type="button" class="icon-btn sm mk-edit" data-act="editar-mk" data-mk="${m.id}" aria-label="Editar la tarjeta «${esc(m.titulo)}»" title="Editar tarjeta">${ICON.edit}</button></div>
    <button type="button" class="tk-title" data-act="abrir-mk" data-mk="${m.id}">${esc(m.titulo)}</button>
    <p class="tk-sub">${k.responsable ? esc(k.responsable) : 'Por asignar'}${k.prioridad ? ` · ${esc(prioTitulo(k.prioridad))}` : ''}${k.fecha ? ` · ${fmtD(k.fecha)}` : ''}</p>
    <p class="tk-sub">${a.total ? `${a.hechas}/${a.total} tareas completadas` : 'Sin tareas: tarea recurrente'}${k.estado === 'blocked' ? ` · <span class="tl-blk">${ICON.lock}Bloqueada</span>` : ''}</p>
    <label class="sr-only" for="mk-st-${m.id}">Estado de «${esc(m.titulo)}»</label>
    <select id="mk-st-${m.id}" class="tk-state" data-act="estado-mk" data-mk="${m.id}">${COLUMNAS.map(c => `<option value="${c.id}" ${c.id === k.estado ? 'selected' : ''}>${esc(c.titulo)}</option>`).join('')}</select>
  </li>`;
}
export function tableroHtml(ctx, tablero) {
  return `${migasHtml([{ t: DIVISION.nombre }, { t: 'Kanban' }])}
    <header class="pg-head"><p class="pg-kicker">${esc(DIVISION.nombre)}</p><h1 id="pg-titulo" tabindex="-1">Kanban</h1>
      <p class="pg-intro">Un macroobjetivo por tarjeta. Haz clic en una tarjeta para ver sus objetivos asociados e ir a su desarrollo; edítala con ${ICON.edit}.</p></header>
    <div class="kb">${COLUMNAS.map(c => {
      const ms = ctx.macros.filter(m => tablero[m.id].estado === c.id).sort((a, b) => tablero[a.id].orden - tablero[b.id].orden);
      return `<section class="kb-col c-${c.id}" aria-labelledby="kb-h-${c.id}">
        <header class="kb-head"><div><h2 id="kb-h-${c.id}">${esc(c.titulo)}</h2><p>${esc(c.ayuda)}</p></div><span class="n" aria-label="${ms.length} macroobjetivos">${ms.length}</span></header>
        <ul class="kb-list" data-col="${c.id}">${ms.map(m => tarjetaHtml(m, tablero[m.id], ctx)).join('') || '<li class="kb-empty">Sin tarjetas.</li>'}</ul>
      </section>`;
    }).join('')}</div>`;
}

/* ── Panel de navegación de un macroobjetivo ── */
export function panelHtml(m, k, ctx) {
  const a = avance(m, ctx), objs = m.objetivos.map(id => ctx.objetivos[id]).filter(Boolean), recs = ctx.recurrentes.filter(r => r.macro === m.id);
  const datos = [k.responsable && ['Responsable', esc(k.responsable)], k.prioridad && ['Prioridad', esc(prioTitulo(k.prioridad))], k.fecha && ['Fecha estimada', fmtD(k.fecha)]].filter(Boolean);
  return `<div class="dlg-head pn-head"><div><p class="dlg-kicker">Macroobjetivo ${esc(m.numero)} · ${esc(colTitulo(k.estado))}</p><h2 id="pn-titulo">${esc(m.titulo)}</h2></div>
      <div class="pn-acc"><button type="button" class="btn btn-sm btn-ghost" data-pn="editar" data-mk="${m.id}">${ICON.edit}Editar tarjeta</button>
        <button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div></div>
    <div class="dlg-body pn-body">
      <p>${esc(m.proposito)}</p>
      ${m.resultado ? `<p class="mo-res"><span class="nivel">Resultado esperado</span> ${esc(m.resultado)}</p>` : ''}
      ${k.estado === 'blocked' && k.bloqueo ? `<div class="aviso err">${ICON.lock}<div><b>Bloqueada:</b> ${esc(k.bloqueo.motivo)}${k.bloqueo.necesita ? `<br><b>Para continuar:</b> ${esc(k.bloqueo.necesita)}` : ''}</div></div>` : ''}
      <div class="pn-avance"><b>${a.hechas}</b> de ${plural(a.total, 'tarea completada', 'tareas completadas')}${a.bloqueadas ? ` · <span class="tl-blk">${ICON.lock}${plural(a.bloqueadas, 'bloqueada', 'bloqueadas')}</span>` : ''}
        ${a.total ? `<span class="nota"> · ${COLUMNAS.filter(c => a.por[c.id]).map(c => `${esc(c.titulo)} ${a.por[c.id]}`).join(' · ')}</span>` : ''}</div>
      ${datos.length ? `<p class="nota">${datos.map(([t, v]) => `${t}: <b>${v}</b>`).join(' · ')}</p>` : ''}
      <h3 class="pn-h">Objetivos asociados</h3>
      <ul class="ob-grid pn-grid">${objs.map(o => objetivoBloqueHtml(o, ctx)).join('')}</ul>
      ${recs.length ? `<ul class="ob-grid pn-grid" aria-label="Tareas recurrentes">${recs.map(r => recurrenteHtml(r, ctx)).join('')}</ul>` : ''}
      <p><a class="link-sec" href="${rutaMacro(m.id)}">Ver este macroobjetivo en Objetivos ${ICON.arrow}</a></p>
    </div>`;
}

/* ── Edición de la tarjeta (ventana aparte) ── */
export function formHtml(m, k) {
  const op = (lista, act) => lista.map(x => `<option value="${esc(x.id)}" ${x.id === act ? 'selected' : ''}>${esc(x.titulo)}</option>`).join('');
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Editar tarjeta · Macroobjetivo ${esc(m.numero)}</p><h2 id="dlg-titulo">${esc(m.titulo)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <div class="fld-row">
        <label class="fld"><span>Estado</span><select name="estado" data-estado>${op(COLUMNAS, k.estado)}</select></label>
        <label class="fld"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(k.responsable)}" placeholder="Por asignar" autocomplete="off"></label>
        <label class="fld"><span>Prioridad</span><select name="prioridad">${op(PRIORIDADES, k.prioridad)}</select></label>
        <label class="fld"><span>Fecha estimada</span><input type="date" name="fecha" value="${esc(k.fecha)}"></label>
      </div>
      <p class="hint" data-trans></p>
      <div class="fld-row" data-bloqueo ${k.estado === 'blocked' ? '' : 'hidden'}>
        <label class="fld"><span>Motivo del bloqueo</span><textarea name="bloqueoMotivo" rows="2" maxlength="800">${esc(k.bloqueo ? k.bloqueo.motivo : '')}</textarea></label>
        <label class="fld"><span>Qué se necesita para continuar</span><textarea name="bloqueoNecesita" rows="2" maxlength="800">${esc(k.bloqueo ? k.bloqueo.necesita : '')}</textarea></label>
      </div>
      <label class="fld"><span>Notas</span><textarea name="notas" rows="3" maxlength="4000">${esc(k.notas)}</textarea></label>
      <details class="mas"><summary>Historial (${k.historial.length})</summary><ol class="hist">${[...k.historial].reverse().map(h => `<li><span class="nota">${esc(fmtDT(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol></details>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
