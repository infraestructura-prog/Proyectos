/* Dashboard de Infraestructura (prototipo local): enrutador, estado, eventos y navegación.
   Macroobjetivo → registro (proyecto, investigación, proyecto condicionado) → actividades.
   Etapa 3: los proyectos habilitados (datos.js · BLOQUES_ETAPA3) tienen Inicio y Kanban; el resto, ficha preliminar.
   Datos: datos.js · HTML: componentes.js, proyecto.js · Rutas: rutas.js · Almacenamiento aislado: almacen.js */
import { AREA, SECCIONES, MACROOBJETIVOS, REGISTROS } from './datos.js';
import { almacen, normInicio, normTarea, normResultado } from './almacen.js';
import * as C from './componentes.js';
import * as P from './proyecto.js';
import * as KM from './kanban-macro.js';
import * as MG from './migracion.js';
import * as MV from './migracion-vista.js';
import { leerRuta, rutaRegistro, rutaMacro, habilitado } from './rutas.js';

const $ = s => document.querySelector(s);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esMovil = () => window.matchMedia('(max-width: 900px)').matches;
const macroIds = new Set(MACROOBJETIVOS.map(m => m.id));
const registros = Object.values(REGISTROS);
const ahora = () => new Date().toISOString();
const uid = p => p + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
const fmtD = s => (s ? s.split('-').reverse().join('/') : 'sin fecha');

/* ── Datos y estado ── */
let inicios = almacen.proyectos(), tareas = almacen.tareas(), resultados = almacen.resultados();
let origen = almacen.origen(), estMig = almacen.migracion();   // Etapa 5: tarjetas del Kanban anterior y estado de la migración
const guardarResultados = () => { if (!almacen.guardarResultados(resultados)) toast('No se pudo guardar en este navegador.'); };
const S = {};
function cargarEstado() {
  const p = almacen.prefs();
  S.vista = p.vista === 'tarjetas' ? 'tarjetas' : 'filas';
  S.abiertos = new Set((Array.isArray(p.abiertos) ? p.abiertos : []).filter(id => macroIds.has(id)));
  S.indice = p.indice !== false;
  S.activo = macroIds.has(p.activo) ? p.activo : null;
  S.sbSec = p.sbSec && typeof p.sbSec === 'object' && !Array.isArray(p.sbSec) ? Object.fromEntries(Object.entries(p.sbSec).filter(([, v]) => typeof v === 'boolean')) : {};
  S.soloDestacadas = !!p.soloDestacadas;
  S.menuArea = false;
}
const guardarPrefs = () => almacen.guardarPrefs({ vista: S.vista, abiertos: [...S.abiertos], indice: S.indice, activo: S.activo, sbSec: S.sbSec, soloDestacadas: S.soloDestacadas });
const guardarTareas = () => { if (!almacen.guardarTareas(tareas)) toast('No se pudo guardar en este navegador.'); };
const guardarInicios = () => { if (!almacen.guardarProyectos(inicios)) toast('No se pudo guardar en este navegador.'); };
const tareasDe = pid => tareas.filter(t => t.proyecto === pid);
const ctx = { nuevo: null, ruta: leerRuta(), macros: MACROOBJETIVOS, tareasDe };
const tareaPorId = id => tareas.find(t => t.id === id);
const log = (t, tipo, nota) => t.historial.push({ fecha: ahora(), tipo, nota });

/* Proyecto condicionado cuya ejecución aún no se ha iniciado: solo se planifica (To do / Blocked). */
const soloPlanificacion = pid => REGISTROS[pid].tipo === 'condicionado' && !inicios[pid].ejecucion.iniciada;
const EJECUCION = new Set(['doing', 'testing', 'completed']);

/* ── Render (conserva el foco en el control equivalente) ── */
function claveFoco(el) {
  if (!el || !el.dataset || !el.dataset.act) return null;
  return ['act', 'macro', 'vista', 'sec', 'tk', 'pr', 'fu'].filter(k => el.dataset[k]).map(k => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('');
}
function render({ foco } = {}) {
  const prev = foco === undefined ? claveFoco(document.activeElement) : foco;
  const r = ctx.ruta = leerRuta();
  let html, titulo;
  if (r.vista === 'registro') {
    const reg = registros.find(x => x.slug === r.slug);
    // Ruta canónica: /investigaciones/<slug>/{inicio|resultados} o /proyectos/<slug>/{inicio|kanban}; lo demás se corrige.
    if (reg) {
      const canon = rutaRegistro(reg, r.pagina || 'inicio');
      if (location.hash.split('?')[0] !== canon) { location.replace(canon + (r.tarea ? `?tarea=${encodeURIComponent(r.tarea)}` : '')); return; }
    }
    if (!reg) { html = C.noEncontradoHtml(); titulo = 'No encontrado'; }
    else if (habilitado(reg)) {
      const pag = r.pagina || 'inicio';
      html = pag === 'kanban' ? P.kanbanHtml(reg, inicios[reg.id], tareasDe(reg.id), S)
        : pag === 'resultados' ? P.resultadosHtml(reg, inicios[reg.id], resultados[reg.id])
          : P.inicioHtml(reg, inicios[reg.id], tareasDe(reg.id), resultados) + MV.origenesHtml(reg.id, MG.origenesDe(reg.id, origen));
      titulo = `${pag === 'kanban' ? 'Kanban' : pag === 'resultados' ? 'Resultados' : 'Inicio'} · ${reg.nombre}`;
    } else { html = C.registroPaginaHtml(reg); titulo = reg.nombre; }
  } else if (r.vista === 'proyectos') { html = C.proyectosHtml(); titulo = 'Proyectos'; }
  else if (r.vista === 'investigaciones') { html = C.proyectosHtml(true); titulo = 'Investigaciones'; }
  else if (r.vista === 'pendientes') { html = MV.pendientesHtml(origen, estMig, almacen.respaldo()); titulo = 'Pendientes de clasificación'; }
  else if (r.vista === 'kanban') { html = KM.tableroHtml(ctx, tablero()); titulo = 'Kanban'; }
  else if (r.vista === 'modulo') {
    // Máquinas de simulación: el marco se conserva mientras sea la misma pestaña (no se recarga al re-pintar la sidebar).
    const s = SECCIONES.find(x => x.id === r.seccion);
    if (!r.sub) { location.replace(`#/${s.id}/vendidas`); return; }
    $('#sidebar').innerHTML = C.sidebarHtml(S, ctx);
    const cont = $('#contenido');
    cont.classList.add('es-modulo');
    if (!cont.querySelector(`iframe[data-mod="${CSS.escape(s.modulo)}"][data-sub="${CSS.escape(r.sub)}"]`)) { cont.innerHTML = C.moduloHtml(s, r.sub); ajustarMarco(); }
    document.title = `${s.titulo} · ${AREA.nombre}`;
    if (prev) { const el = document.querySelector(prev); if (el) el.focus({ preventScroll: true }); }
    guardarPrefs(); return;
  }
  else {
    html = C.encabezadoHtml(S, ctx) + `<ol class="mo-list vista-${S.vista}" aria-label="Macroobjetivos">${MACROOBJETIVOS.map(m => C.macroHtml(m, S, ctx)).join('')}</ol>`;
    titulo = 'Objetivos';
  }
  $('#sidebar').innerHTML = C.sidebarHtml(S, ctx);
  $('#contenido').classList.remove('es-modulo');
  const abiertos = new Set([...document.querySelectorAll('#contenido details[data-keep][open]')].map(d => d.dataset.keep));
  $('#contenido').innerHTML = html;
  document.querySelectorAll('#contenido details[data-keep]').forEach(d => { if (abiertos.has(d.dataset.keep)) d.open = true; });
  document.title = `${titulo} · ${AREA.nombre}`;
  ctx.nuevo = null;
  if (prev) { const el = document.querySelector(prev); if (el) el.focus({ preventScroll: true }); }
  if ((r.vista === 'registro' && r.pagina === 'kanban') || r.vista === 'kanban') bindDrag();
  guardarPrefs();
}

/* Cambio de ruta: pantalla nueva desde arriba, foco en su título; los parámetros de un solo uso se consumen. */
function alCambiarRuta() {
  cerrarMenu(false); cerrarResultados();
  [dlg, dlg2, panel].forEach(d => { if (d.open) d.close(); });
  const r = leerRuta();
  if (r.seccion === 'proyectos' || r.seccion === 'investigaciones') S.sbSec[r.seccion] = true;
  render({ foco: null });
  if (r.vista === 'objetivos' && r.macro) {
    history.replaceState(null, '', '#/objetivos');
    if (macroIds.has(r.macro)) irMacro(r.macro);
    return;
  }
  window.scrollTo(0, 0);
  const h = $('#pg-titulo'); h && h.focus({ preventScroll: true });
  if (r.vista === 'registro' && r.tarea) {
    const t = tareaPorId(r.tarea), reg = registros.find(x => x.slug === r.slug);
    if (reg) history.replaceState(null, '', rutaRegistro(reg, r.pagina || 'inicio'));
    if (t && reg && t.proyecto === reg.id) { const el = document.querySelector(`li[data-tk="${t.id}"]`); if (el) irA(el, { focus: false, block: 'center' }); formTarea(t); }
  }
}
window.addEventListener('hashchange', alCambiarRuta);

function irA(el, { focus = true, block = 'start' } = {}) {
  if (!el) return;
  el.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block });
  setTimeout(() => { const b = el.getBoundingClientRect(); if (el.isConnected && (b.top < 0 || b.top > window.innerHeight - 60)) el.scrollIntoView({ block }); }, 900);
  if (focus) el.focus({ preventScroll: true });
  const caja = el.closest('.mo, .tk, .pj-sec') || el;
  caja.classList.remove('is-flash'); void caja.offsetWidth; caja.classList.add('is-flash');
  setTimeout(() => caja.classList.remove('is-flash'), 1800);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 3600);
}

/* ── Objetivos ── */
function abrirMacro(id) { if (!S.abiertos.has(id)) ctx.nuevo = id; S.abiertos.add(id); S.activo = id; }
function irMacro(id) {
  if (ctx.ruta.vista !== 'objetivos') { location.hash = rutaMacro(id); return; }
  abrirMacro(id); cerrarMenu(false); render({ foco: null });
  irA(document.querySelector(`[data-act="toggle-macro"][data-macro="${id}"]`));
}

/* ── Ventanas: dlg (formularios) y dlg2 (confirmaciones de estado, encima de dlg) ── */
const dlg = $('#dlg'), dlg2 = $('#dlg2'), panel = $('#panel');
let dlgRetorno = null;
function abrirDialogo(d, html, retorno) {
  if (d === dlg) dlgRetorno = retorno === undefined ? claveFoco(document.activeElement) : retorno;
  d.innerHTML = html; d.showModal();
  const f = d.querySelector('input:not([type=hidden]):not([type=checkbox]):not([disabled]), textarea:not([disabled]), select, [data-dlg-ok]'); f && f.focus();
}
dlg.addEventListener('close', () => { const el = dlgRetorno && document.querySelector(dlgRetorno); if (el) el.focus({ preventScroll: true }); dlgRetorno = null; });
[dlg, dlg2].forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-dlg-close]')) d.close('cancel'); }));
function confirmar(titulo, cuerpo, accion, alAceptar) {
  abrirDialogo(dlg, C.confirmHtml(titulo, cuerpo, accion));
  dlg.querySelector('[data-dlg-ok]').addEventListener('click', () => { dlgRetorno = null; dlg.close(); alAceptar(); });
}
function avisoCondicion(pid) {
  const r = REGISTROS[pid], res = inicios[pid].condicion.resolucion;
  return `<p>«${C.esc(r.nombre)}» es un proyecto condicionado. ${res ? 'Su condición está resuelta, pero la ejecución no se ha marcado como iniciada.' : 'Su condición de inicio no se ha resuelto:'}</p>
    ${res ? '' : `<p class="cond-txt">${C.esc(r.condicion)}</p>`}
    <p>Mientras tanto se puede planificar (To do, Blocked y edición de tareas), pero ninguna tarea pasa a Doing, Testing ni Completed. Hazlo desde la condición de inicio, en la página Inicio.</p>`;
}
function negarEjecucion(pid) {
  abrirDialogo(dlg2, `<div class="dlg-head"><div><p class="dlg-kicker">Proyecto condicionado</p><h2 id="dlg2-titulo">La ejecución no ha iniciado</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body">${avisoCondicion(pid)}</div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Entendido</button><a class="btn btn-primary" href="${rutaRegistro(REGISTROS[pid], 'inicio')}" data-ir-cond>Ir a la condición</a></div>`);
  dlg2.querySelector('[data-ir-cond]').addEventListener('click', () => dlg2.close());
}

/* Pide los datos de Blocked o Completed. Devuelve una promesa con los datos o null si se cancela. */
function pedirTransicion(t, a) {
  if (a !== 'blocked' && a !== 'completed') return Promise.resolve({});
  return new Promise(resolve => {
    let hecho = false;
    abrirDialogo(dlg2, P.transicionHtml(t, a));
    const form = dlg2.querySelector('form');
    dlg2.addEventListener('close', () => { if (!hecho) resolve(null); }, { once: true });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = Object.fromEntries([...new FormData(form).entries()].map(([k, x]) => [k, String(x).trim()]));
      let ok = true;
      if (a === 'blocked') ['motivo', 'necesita'].forEach(k => { const bad = !v[k]; form.elements[k].setAttribute('aria-invalid', bad); form.elements[k].parentElement.querySelector('.err').hidden = !bad; if (bad && ok) { form.elements[k].focus(); ok = false; } });
      else { const bad = !form.elements.cumple.checked; form.querySelector('[data-err-cumple]').hidden = !bad; if (bad) { form.elements.cumple.focus(); ok = false; } }
      if (!ok) return;
      hecho = true; dlg2.close(); resolve(a === 'blocked' ? { motivo: v.motivo, necesita: v.necesita } : { nota: v.nota || '', criterioCumplido: true });
    });
  });
}

/* Aplica un cambio de estado a UNA tarea (las demás no cambian) y deja constancia en su historial. */
function aplicarEstado(t, a, datos) {
  const de = t.estado; if (de === a) return;
  if (de === 'blocked' && t.bloqueo) log(t, 'desbloqueo', `Desbloqueada. Motivo anterior: ${t.bloqueo.motivo}${t.bloqueo.necesita ? ` · Se necesitaba: ${t.bloqueo.necesita}` : ''}`);
  if (de === 'completed' && t.cierre) log(t, 'reapertura', `Reabierta. Cierre anterior: ${t.cierre.nota || 'sin nota'}`);
  if (a === 'blocked') { t.bloqueo = { motivo: datos.motivo, necesita: datos.necesita }; log(t, 'bloqueo', `Bloqueada: ${datos.motivo} · Para continuar: ${datos.necesita}`); }
  else t.bloqueo = null;
  if (a === 'completed') { t.cierre = { nota: datos.nota, criterioCumplido: true, fecha: ahora() }; log(t, 'cierre', `Completada. Criterio de finalización confirmado.${datos.nota ? ` Cierre / evidencia: ${datos.nota}` : ''}`); }
  else t.cierre = null;
  log(t, 'estado', `${P.colTitulo(de)} → ${P.colTitulo(a)}.${t.porConfirmar ? ' Estado confirmado.' : ''}`);
  t.porConfirmar = false;
  t.estado = a;
  t.orden = Math.max(0, ...tareas.filter(x => x.proyecto === t.proyecto && x.estado === a && x !== t).map(x => x.orden)) + 1;
}
async function moverTarea(id, a) {
  const t = tareaPorId(id); if (!t || t.estado === a) { render(); return; }
  if (EJECUCION.has(a) && soloPlanificacion(t.proyecto)) { render({ foco: `#st-${CSS.escape(id)}` }); negarEjecucion(t.proyecto); return; }
  const datos = await pedirTransicion(t, a);
  if (!datos) { render({ foco: `#st-${CSS.escape(id)}` }); toast('Cambio de estado cancelado.'); return; }
  aplicarEstado(t, a, datos); guardarTareas(); render({ foco: `#st-${CSS.escape(id)}` });
  toast(`«${t.titulo}» → ${P.colTitulo(a)}.`);
}

/* ── Formulario de tarea (crear o editar) ── */
function formTarea(t0, pid) {
  const nueva = !t0;
  const proy = nueva ? pid : t0.proyecto;
  const t = nueva ? normTarea({ id: uid('tk'), proyecto: pid, titulo: '', estado: 'todo', porConfirmar: true }) : normTarea(JSON.parse(JSON.stringify(t0)));
  abrirDialogo(dlg, P.formTareaHtml(t, nueva), nueva ? `[data-act="nueva-tarea"][data-pr="${pid}"]` : `[data-act="abrir-tarea"][data-tk="${t.id}"]`);
  const form = dlg.querySelector('form'), selEstado = form.querySelector('[data-estado]'), trans = form.querySelector('[data-trans]');
  let pendiente = null, estadoForm = t.estado;
  const subsEl = form.querySelector('[data-subs]');
  const pintarSubs = () => { subsEl.innerHTML = t.subtareas.map((s, i) => `<li><label class="check"><input type="checkbox" data-sub="toggle" data-i="${i}" ${s.hecha ? 'checked' : ''}> <span>${C.esc(s.texto)}</span></label>
      <button type="button" class="icon-btn sm" data-sub="del" data-i="${i}" aria-label="Quitar la subtarea «${C.esc(s.texto)}»">×</button></li>`).join('') || '<li class="nota">Sin subtareas.</li>'; };
  pintarSubs();
  const bloqueoCampos = on => { form.querySelector('[data-bloqueo]').hidden = !on; };
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-sub]'); if (!b || b.dataset.sub === 'toggle') return;
    if (b.dataset.sub === 'add') { const n = form.querySelector('#nueva-sub'); if (!n.value.trim()) { n.focus(); return; } t.subtareas.push({ id: uid('s'), texto: n.value.trim().slice(0, 300), hecha: false }); n.value = ''; pintarSubs(); n.focus(); }
    if (b.dataset.sub === 'del') { t.subtareas.splice(Number(b.dataset.i), 1); pintarSubs(); form.querySelector('#nueva-sub').focus(); }
  });
  form.querySelector('#nueva-sub').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-sub="add"]').click(); } });
  const borrar = form.querySelector('[data-tk-borrar]');
  if (borrar) borrar.addEventListener('click', () => eliminarTarea(t.id));
  form.addEventListener('change', async e => {
    const el = e.target;
    if (el.dataset.sub === 'toggle') t.subtareas[Number(el.dataset.i)].hecha = el.checked;
    if (el.dataset.depto) el.closest('.depto').querySelector('.depto-det').hidden = !el.checked;
    if (el === selEstado) {
      const a = el.value;
      if (EJECUCION.has(a) && soloPlanificacion(proy)) { el.value = estadoForm; negarEjecucion(proy); return; }
      if (a === 'blocked' || a === 'completed') {
        const datos = await pedirTransicion({ ...t, estado: estadoForm }, a);
        if (!datos) { el.value = estadoForm; el.focus(); return; }
        pendiente = datos;
        if (a === 'blocked') { bloqueoCampos(true); form.elements.bloqueoMotivo.value = datos.motivo; form.elements.bloqueoNecesita.value = datos.necesita; }
      } else pendiente = null;
      if (a !== 'blocked') bloqueoCampos(false);
      estadoForm = a;
      if (a !== t.estado) form.elements.porConfirmar.checked = false;
      trans.textContent = a === t.estado ? '' : `Al guardar, la tarea pasará a ${P.colTitulo(a)}.`;
      el.focus();
    }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const err = form.querySelector('.err');
    if (!g('titulo')) { err.hidden = false; form.elements.titulo.setAttribute('aria-invalid', 'true'); form.elements.titulo.focus(); return; }
    const enlaces = g('enlaces').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const malo = enlaces.find(u => { try { return new URL(u).protocol !== 'https:'; } catch { return true; } });
    const errEnl = form.querySelector('[data-err-enlaces]');
    if (malo) { form.querySelector('details.mas').open = true; errEnl.hidden = false; errEnl.textContent = `Los enlaces deben empezar por https:// (revisa «${malo}»).`; form.elements.enlaces.focus(); return; }
    if (estadoForm === 'blocked' && (!g('bloqueoMotivo') || !g('bloqueoNecesita'))) { form.elements[g('bloqueoMotivo') ? 'bloqueoNecesita' : 'bloqueoMotivo'].focus(); trans.textContent = 'Una tarea bloqueada necesita motivo y qué se necesita para continuar.'; return; }
    const deptos = [...form.querySelectorAll('input[name="tdepto"]:checked')].map(c => ({ id: c.value, detalle: g(`tdepto-${c.value}`) }));
    const destino = nueva ? t : tareaPorId(t.id);
    const antes = { ...destino };
    Object.assign(destino, normTarea({ ...destino, titulo: g('titulo'), descripcion: g('descripcion'), criterio: g('criterio'), prioridad: g('prioridad'), responsable: g('responsable'),
      colaboradores: g('colaboradores'), fecha: g('fecha'), destacada: form.elements.destacada.checked, porConfirmar: form.elements.porConfirmar.checked,
      subtareas: t.subtareas, departamentos: deptos, notas: g('notas'), enlaces, evidencias: g('evidencias') }), { historial: destino.historial, orden: destino.orden });
    if (nueva) { destino.historial = [{ fecha: ahora(), tipo: 'creada', nota: `Tarea creada en To do${destino.porConfirmar ? ' con «Estado por confirmar»' : ''}.` }]; destino.orden = Math.max(0, ...tareas.filter(x => x.proyecto === pid && x.estado === 'todo').map(x => x.orden)) + 1; tareas.push(destino); }
    else {
      // Historial: qué cambió. La fecha anterior se conserva (fecha original → reprogramada).
      const cambios = [];
      if (antes.fecha !== destino.fecha) cambios.push(antes.fecha ? `Fecha reprogramada: ${fmtD(antes.fecha)} → ${fmtD(destino.fecha)}` : `Fecha estimada: ${fmtD(destino.fecha)}`);
      if (antes.responsable !== destino.responsable) cambios.push(`Responsable: ${antes.responsable || 'por asignar'} → ${destino.responsable || 'por asignar'}`);
      if (antes.colaboradores !== destino.colaboradores) cambios.push(`Colaboradores: ${destino.colaboradores || 'ninguno'}`);
      if (antes.titulo !== destino.titulo) cambios.push(`Título: «${antes.titulo}» → «${destino.titulo}»`);
      if (antes.prioridad !== destino.prioridad) cambios.push(`Prioridad: ${destino.prioridad || 'por definir'}`);
      if (antes.destacada !== destino.destacada) cambios.push(destino.destacada ? 'Marcada como destacada' : 'Se retiró el énfasis');
      if (antes.porConfirmar && !destino.porConfirmar && estadoForm === destino.estado) cambios.push(`Estado confirmado: ${P.colTitulo(destino.estado)}`);
      if (!antes.porConfirmar && destino.porConfirmar) cambios.push('Estado marcado como por confirmar');
      log(destino, 'edicion', cambios.length ? cambios.join(' · ') + '.' : 'Datos editados.');
    }
    if (estadoForm !== destino.estado) aplicarEstado(destino, estadoForm, estadoForm === 'blocked' ? { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') } : pendiente || {});
    else if (destino.estado === 'blocked') destino.bloqueo = { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') };
    guardarTareas(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="abrir-tarea"][data-tk="${destino.id}"]` });
    toast(nueva ? 'Tarea creada.' : 'Tarea guardada.');
  });
}

/* ── Eliminar una tarea (con confirmación). Se aparta en «tareas-eliminadas» de este navegador, recuperable;
   las demás tareas no cambian y los datos iniciales no la vuelven a cargar. ── */
function eliminarTarea(id) {
  const t = tareaPorId(id); if (!t) return;
  dlgRetorno = null; if (dlg.open) dlg.close();
  confirmar('Eliminar tarea', `<p>Se eliminará «${C.esc(t.titulo)}» del tablero.</p>
    <p>Queda guardada aparte en este navegador por si hay que recuperarla. Las demás tareas no cambian.</p>`, 'Eliminar', () => {
    tareas = tareas.filter(x => x.id !== id);
    const quitadas = almacen.eliminadas(); quitadas.push({ fecha: ahora(), tarea: t }); almacen.guardarEliminadas(quitadas.slice(-500));
    guardarTareas(); render({ foco: `[data-act="nueva-tarea"][data-pr="${t.proyecto}"]` }); toast(`Tarea eliminada: «${t.titulo}».`);
  });
}

/* ── Formulario del proyecto (datos de Inicio) ── */
function formProyecto(pid) {
  const r = REGISTROS[pid], ini = inicios[pid];
  abrirDialogo(dlg, P.formProyectoHtml(r, ini));
  const form = dlg.querySelector('form'), bloque = form.querySelector('[data-deptos]');
  form.addEventListener('change', e => {
    if (e.target.name === 'relacion') bloque.hidden = e.target.value !== 'con';
    if (e.target.dataset.depto) e.target.closest('.depto').querySelector('.depto-det').hidden = !e.target.checked;
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const relacion = (form.querySelector('input[name="relacion"]:checked') || {}).value || 'por-confirmar';
    const lista = relacion === 'con' ? [...form.querySelectorAll('input[name="depto"]:checked')].map(c => ({ id: c.value, detalle: g(`depto-${c.value}`) })) : [];
    const nuevo = normInicio({ ...ini, descripcion: g('descripcion'), proximaAccion: g('proximaAccion'), prioridad: g('prioridad'), responsable: g('responsable'), entrega: g('entrega'),
      colaboradores: g('colaboradores'), colaboracion: g('colaboracion'), departamentos: { relacion, lista } });
    const cambios = [];
    if (ini.entrega !== nuevo.entrega) cambios.push(ini.entrega ? `Fecha estimada reprogramada: ${fmtD(ini.entrega)} → ${fmtD(nuevo.entrega)}` : `Fecha estimada: ${fmtD(nuevo.entrega)}`);
    if (ini.responsable !== nuevo.responsable) cambios.push(`Responsable: ${ini.responsable || 'por asignar'} → ${nuevo.responsable || 'por asignar'}`);
    if (ini.proximaAccion !== nuevo.proximaAccion) cambios.push(`Próxima acción: ${nuevo.proximaAccion || 'por definir'}`);
    nuevo.historial.push({ fecha: ahora(), tipo: 'edicion', nota: cambios.length ? cambios.join(' · ') + '.' : 'Datos de Inicio editados.' });
    inicios[pid] = nuevo;
    guardarInicios(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="editar-proyecto"][data-pr="${pid}"]` }); toast('Datos del proyecto guardados.');
  });
}

/* ── Condición de inicio (proyectos condicionados) ── */
function formCondicion(pid) {
  const r = REGISTROS[pid];
  abrirDialogo(dlg, P.formCondicionHtml(r), `[data-act="resolver-condicion"][data-pr="${pid}"]`);
  const form = dlg.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n].value || '').trim();
    let ok = true;
    ['nota', 'quien'].forEach(k => { const bad = !g(k); form.elements[k].setAttribute('aria-invalid', bad); form.elements[k].parentElement.querySelector('.err').hidden = !bad; if (bad && ok) { form.elements[k].focus(); ok = false; } });
    if (!ok) return;
    const ini = inicios[pid];
    ini.condicion.resolucion = { nota: g('nota'), quien: g('quien'), fecha: g('fecha'), registrada: ahora() };
    ini.historial.push({ fecha: ahora(), tipo: 'condicion', nota: `Condición resuelta: ${g('nota')} · Confirmó: ${g('quien')}${g('fecha') ? ` · ${fmtD(g('fecha'))}` : ''}.` });
    guardarInicios(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="iniciar-ejecucion"][data-pr="${pid}"]` });
    toast('Resolución de la condición registrada.');
  });
}

/* ── Arrastrar y soltar en el Kanban (el selector de estado es la alternativa accesible) ── */
let arrastrada = null;
function bindDrag() {
  document.querySelectorAll('.tk[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => { arrastrada = el.dataset.mk ? 'mk:' + el.dataset.mk : el.dataset.tk; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arrastrada); });
    el.addEventListener('dragend', () => { arrastrada = null; el.classList.remove('dragging'); document.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); });
  });
  document.querySelectorAll('.kb-list').forEach(l => {
    l.addEventListener('dragover', e => { if (!arrastrada) return; e.preventDefault(); l.closest('.kb-col').classList.add('drop'); });
    l.addEventListener('dragleave', e => { if (!l.contains(e.relatedTarget)) l.closest('.kb-col').classList.remove('drop'); });
    l.addEventListener('drop', e => { e.preventDefault(); const id = arrastrada || e.dataTransfer.getData('text/plain'); l.closest('.kb-col').classList.remove('drop'); if (!id) return; if (id.startsWith('mk:')) moverMacro(id.slice(3), l.dataset.col); else moverTarea(id, l.dataset.col); });
  });
}

/* ── Kanban general: una tarjeta por macroobjetivo ── */
let tableroMem = null;
function tablero() {
  if (!tableroMem) { const r = KM.asegurarTablero(almacen.kanban(), MACROOBJETIVOS); tableroMem = r.tablero; if (r.cambio) almacen.guardarKanban(tableroMem); }
  return tableroMem;
}
const guardarTablero = () => { if (!almacen.guardarKanban(tableroMem)) toast('No se pudo guardar en este navegador.'); };
const logMk = (k, nota) => k.historial.push({ fecha: ahora(), nota });
const tarjetaComoTarea = (m, k) => ({ titulo: m.titulo, estado: k.estado, bloqueo: k.bloqueo, cierre: k.cierre, criterio: '' });

/* Panel de navegación (clic en la tarjeta): proyectos e investigaciones con enlaces a su desarrollo. */
let panelMacro = null;
function abrirPanel(mid, foco = true) {
  const m = MACROOBJETIVOS.find(x => x.id === mid); if (!m) return;
  panelMacro = mid;
  panel.innerHTML = KM.panelHtml(m, tablero()[mid], ctx);
  if (!panel.open) panel.showModal();
  if (foco) { const h = panel.querySelector('#pn-titulo'); h.setAttribute('tabindex', '-1'); h.focus(); }
}
const refrescarPanel = () => { if (panel.open && panelMacro) abrirPanel(panelMacro, false); };
panel.addEventListener('click', e => {
  if (e.target === panel || e.target.closest('[data-dlg-close]')) { panel.close(); return; }
  const b = e.target.closest('[data-pn="editar"]'); if (b) formMacro(b.dataset.mk);   // la edición se abre encima, sin cerrar el panel
});
panel.addEventListener('close', () => { const el = panelMacro && document.querySelector(`[data-act="abrir-mk"][data-mk="${panelMacro}"]`); if (el) el.focus({ preventScroll: true }); panelMacro = null; });

function aplicarEstadoMacro(m, k, a, datos) {
  const de = k.estado; if (de === a) return;
  if (de === 'blocked' && k.bloqueo) logMk(k, `Desbloqueada. Motivo anterior: ${k.bloqueo.motivo}`);
  if (de === 'completed' && k.cierre) logMk(k, `Reabierta. Cierre anterior: ${k.cierre.nota || 'sin nota'}`);
  k.bloqueo = a === 'blocked' ? { motivo: datos.motivo, necesita: datos.necesita } : null;
  if (a === 'blocked') logMk(k, `Bloqueada: ${datos.motivo} · Para continuar: ${datos.necesita}`);
  k.cierre = a === 'completed' ? { nota: datos.nota || '', criterioCumplido: true, fecha: ahora() } : null;
  if (a === 'completed') logMk(k, `Completada.${datos.nota ? ` ${datos.nota}` : ''}`);
  logMk(k, `${P.colTitulo(de)} → ${P.colTitulo(a)}.${k.porConfirmar ? ' Estado confirmado.' : ''}`);
  k.porConfirmar = false;
  k.estado = a; k.orden = Math.max(0, ...MACROOBJETIVOS.map(x => tableroMem[x.id]).filter(x => x !== k && x.estado === a).map(x => x.orden)) + 1;
}
async function moverMacro(mid, a) {
  const m = MACROOBJETIVOS.find(x => x.id === mid), k = tablero()[mid]; if (!m || k.estado === a) { render(); return; }
  const datos = await pedirTransicion(tarjetaComoTarea(m, k), a);
  if (!datos) { render({ foco: `#mk-st-${mid}` }); toast('Cambio de estado cancelado.'); return; }
  aplicarEstadoMacro(m, k, a, datos); guardarTablero(); render({ foco: `#mk-st-${mid}` }); refrescarPanel();
  toast(`«${m.titulo}» → ${P.colTitulo(a)}.`);
}

/* Edición de la tarjeta: ventana propia, encima del tablero o del panel, sin cambiar la navegación. */
function formMacro(mid) {
  const m = MACROOBJETIVOS.find(x => x.id === mid); if (!m) return;
  const k = tablero()[mid];
  abrirDialogo(dlg, KM.formHtml(m, k), panel.open ? null : `[data-act="editar-mk"][data-mk="${mid}"]`);
  const form = dlg.querySelector('form'), sel = form.querySelector('[data-estado]'), trans = form.querySelector('[data-trans]');
  let estadoForm = k.estado, pendiente = null;
  form.addEventListener('change', async e => {
    if (e.target !== sel) return;
    const a = sel.value;
    if (a === 'blocked' || a === 'completed') {
      const datos = await pedirTransicion({ ...tarjetaComoTarea(m, k), estado: estadoForm }, a);
      if (!datos) { sel.value = estadoForm; sel.focus(); return; }
      pendiente = datos;
      if (a === 'blocked') { form.elements.bloqueoMotivo.value = datos.motivo; form.elements.bloqueoNecesita.value = datos.necesita; }
    } else pendiente = null;
    form.querySelector('[data-bloqueo]').hidden = a !== 'blocked';
    if (a !== k.estado) form.elements.porConfirmar.checked = false;
    estadoForm = a; trans.textContent = a === k.estado ? '' : `Al guardar, la tarjeta pasará a ${P.colTitulo(a)}.`; sel.focus();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    if (estadoForm === 'blocked' && (!g('bloqueoMotivo') || !g('bloqueoNecesita'))) { trans.textContent = 'Una tarjeta bloqueada necesita motivo y qué se necesita para continuar.'; form.elements[g('bloqueoMotivo') ? 'bloqueoNecesita' : 'bloqueoMotivo'].focus(); return; }
    const antes = { ...k };
    Object.assign(k, KM.normTarjeta({ ...k, responsable: g('responsable'), prioridad: g('prioridad'), fecha: g('fecha'), notas: g('notas'), porConfirmar: form.elements.porConfirmar.checked }), { historial: k.historial, orden: k.orden });
    const cambios = [];
    if (antes.fecha !== k.fecha) cambios.push(antes.fecha ? `Fecha reprogramada: ${fmtD(antes.fecha)} → ${fmtD(k.fecha)}` : `Fecha estimada: ${fmtD(k.fecha)}`);
    if (antes.responsable !== k.responsable) cambios.push(`Responsable: ${antes.responsable || 'por asignar'} → ${k.responsable || 'por asignar'}`);
    if (antes.porConfirmar && !k.porConfirmar && estadoForm === k.estado) cambios.push(`Estado confirmado: ${P.colTitulo(k.estado)}`);
    logMk(k, cambios.length ? cambios.join(' · ') + '.' : 'Datos de la tarjeta editados.');
    if (estadoForm !== k.estado) aplicarEstadoMacro(m, k, estadoForm, estadoForm === 'blocked' ? { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') } : pendiente || {});
    else if (k.estado === 'blocked') k.bloqueo = { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') };
    guardarTablero(); dlg.close(); render(); refrescarPanel(); toast('Tarjeta guardada.');
  });
}

/* Alto del marco de los módulos integrados: ocupa la ventana disponible y tiene su propio desplazamiento. */
function ajustarMarco() {
  const f = document.querySelector('.mod-frame'); if (!f) return;
  f.style.height = Math.max(420, window.innerHeight - f.getBoundingClientRect().top - window.scrollY - 12) + 'px';
}
window.addEventListener('resize', ajustarMarco);

/* ── Resultados de investigaciones: conclusión, hallazgos y fuentes ── */
function formResultado(iid) {
  const r = REGISTROS[iid], res = resultados[iid];
  abrirDialogo(dlg, P.formResultadoHtml(r, res), `[data-act="editar-resultado"][data-pr="${iid}"]`);
  const form = dlg.querySelector('form'), aprob = form.querySelector('[data-aprob]');
  form.addEventListener('change', e => { if (e.target.name === 'estado') aprob.hidden = e.target.value !== 'aprobada'; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const estado = (form.querySelector('input[name="estado"]:checked') || {}).value || 'sin';
    if (estado === 'aprobada') {
      const sinTexto = !g('conclusion'), sinQuien = !g('quien');
      form.elements.quien.parentElement.querySelector('.err').hidden = !sinQuien;
      if (sinTexto) { form.elements.conclusion.setAttribute('aria-invalid', 'true'); form.elements.conclusion.focus(); return; }
      if (sinQuien) { form.elements.quien.focus(); return; }
    }
    const nuevo = normResultado({ ...res, hallazgos: g('hallazgos'), conclusion: g('conclusion'), recomendacion: g('recomendacion'), estado,
      aprobacion: estado === 'aprobada' ? { quien: g('quien'), fecha: g('fecha') } : null });
    const cambios = [];
    if (res.estado !== nuevo.estado) cambios.push(`Conclusión: ${res.estado} → ${nuevo.estado}${nuevo.aprobacion ? ` (aprobó ${nuevo.aprobacion.quien})` : ''}`);
    if (res.conclusion !== nuevo.conclusion) cambios.push('Conclusión editada');
    if (res.hallazgos !== nuevo.hallazgos) cambios.push('Hallazgos editados');
    if (res.recomendacion !== nuevo.recomendacion) cambios.push('Recomendación editada');
    nuevo.historial.push({ fecha: ahora(), tipo: 'resultado', nota: cambios.length ? cambios.join(' · ') + '.' : 'Resultados revisados sin cambios.' });
    resultados[iid] = nuevo;
    guardarResultados(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="editar-resultado"][data-pr="${iid}"]` }); toast('Resultados guardados.');
  });
}
function formFuente(iid, fid) {
  const res = resultados[iid], nueva = !fid;
  const f = nueva ? { id: uid('fu'), titulo: '', tipo: '', url: '', nota: '', fecha: '' } : res.fuentes.find(x => x.id === fid);
  if (!f) return;
  abrirDialogo(dlg, P.formFuenteHtml(f, nueva), nueva ? `[data-act="nueva-fuente"][data-pr="${iid}"]` : `[data-act="nueva-fuente"][data-pr="${iid}"]`);
  const form = dlg.querySelector('form');
  const borrar = form.querySelector('[data-fu-borrar]');
  if (borrar) borrar.addEventListener('click', () => {
    dlgRetorno = null; dlg.close();
    confirmar('Quitar fuente', `<p>Se quitará «${C.esc(f.titulo)}» de las fuentes de la investigación. Queda constancia en su historial.</p>`, 'Quitar', () => {
      res.fuentes = res.fuentes.filter(x => x.id !== fid);
      res.historial.push({ fecha: ahora(), tipo: 'fuente', nota: `Fuente quitada: ${f.titulo}${f.url ? ` (${f.url})` : ''}.` });
      guardarResultados(); render({ foco: `[data-act="nueva-fuente"][data-pr="${iid}"]` }); toast('Fuente quitada.');
    });
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n].value || '').trim();
    const errT = form.elements.titulo.parentElement.querySelector('.err'), errU = form.querySelector('[data-err-url]');
    errT.hidden = !!g('titulo'); if (!g('titulo')) { form.elements.titulo.focus(); return; }
    let okUrl = !g('url'); try { okUrl = okUrl || new URL(g('url')).protocol === 'https:'; } catch { okUrl = false; }
    errU.hidden = okUrl; if (!okUrl) { form.elements.url.focus(); return; }
    const datos = { id: f.id, titulo: g('titulo'), tipo: g('tipo'), url: g('url'), nota: g('nota'), fecha: g('fecha') };
    if (nueva) res.fuentes.push(datos); else Object.assign(res.fuentes.find(x => x.id === fid), datos);
    resultados[iid] = normResultado(res);
    resultados[iid].historial.push({ fecha: ahora(), tipo: 'fuente', nota: `${nueva ? 'Fuente agregada' : 'Fuente editada'}: ${datos.titulo}.` });
    guardarResultados(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="nueva-fuente"][data-pr="${iid}"]` }); toast(nueva ? 'Fuente agregada.' : 'Fuente guardada.');
  });
}

/* ── Etapa 5: migración del Kanban anterior (idempotente, con respaldo previo y opción de deshacer) ── */
async function ejecutarMigracion() {
  let tarjetas;
  try {
    const res = await fetch(MG.FUENTE.archivo, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.schema !== 'ccs-kanban-v1' || !Array.isArray(j.tarjetas)) throw new Error('El archivo no tiene el formato esperado (ccs-kanban-v1).');
    tarjetas = j.tarjetas;
  } catch (e) { toast(`No se pudo leer la copia de origen: ${e.message}`); return; }
  // 1) Respaldo recuperable antes de transformar (solo la primera vez: el respaldo previo es el estado anterior a cualquier migración).
  if (!almacen.respaldo()) almacen.guardarRespaldo(almacen.instantanea());
  // 2) Copia íntegra de las tarjetas originales.
  almacen.guardarOrigen(tarjetas); origen = tarjetas;
  // 3) Migración sobre copias; solo se guarda si todo salió bien.
  const datos = { inicios: JSON.parse(JSON.stringify(inicios)), tareas: JSON.parse(JSON.stringify(tareas)) };
  const r = MG.migrar(tarjetas, datos, estMig);
  inicios = Object.fromEntries(Object.entries(r.inicios).map(([k, v]) => [k, normInicio(v)]));
  tareas = r.tareas.map((t, i) => normTarea(t, i));
  estMig = r.estado;
  guardarInicios(); guardarTareas(); almacen.guardarMigracion(estMig);
  tableroMem = null;
  render({ foco: '[data-act="migrar"]' });
  const inf = r.informe;
  abrirDialogo(dlg, `<div class="dlg-head"><div><p class="dlg-kicker">Migración del Kanban anterior</p><h2 id="dlg-titulo">Resultado</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body">
      <p><b>${inf.aplicadas.length}</b> tarjetas migradas ahora · <b>${inf.omitidas.length}</b> ya migradas antes (no se duplicaron)${inf.sinMapa.length ? ` · <b>${inf.sinMapa.length}</b> sin correspondencia (a Pendientes)` : ''}.</p>
      ${inf.noSobrescritas.length ? `<p>No se sobrescribieron ${inf.noSobrescritas.length} tareas con ediciones locales; solo se vinculó su origen:</p><ul>${inf.noSobrescritas.map(x => `<li><code>${C.esc(x)}</code></li>`).join('')}</ul>` : ''}
      <p class="nota">Revisa la correspondencia, los conflictos y las tarjetas sin clasificar en esta página. Puedes deshacer la migración con el respaldo previo.</p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn btn-primary" data-dlg-close>Entendido</button></div>`, '[data-act="migrar"]');
}
function descargarRespaldo() {
  const s = almacen.respaldo(); if (!s) return;
  const blob = new Blob([JSON.stringify({ tipo: 'respaldo-previo-migracion', prefijo: almacen.prefijo, ...s, origen }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `infraestructura-respaldo-previo-migracion-${s.fecha.slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ── Clics ── */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || dlg.contains(b) || dlg2.contains(b) || panel.contains(b)) return;
  const { macro, tk, pr } = b.dataset;
  switch (b.dataset.act) {
    case 'toggle-macro': if (S.abiertos.has(macro)) S.abiertos.delete(macro); else abrirMacro(macro); render(); break;
    case 'ir-macro': irMacro(macro); break;
    case 'expandir': MACROOBJETIVOS.forEach(m => S.abiertos.add(m.id)); render(); toast('Macroobjetivos expandidos.'); break;
    case 'contraer': S.abiertos.clear(); render(); toast('Macroobjetivos contraídos.'); break;
    case 'vista': S.vista = b.dataset.vista; render(); break;
    case 'toggle-indice': S.indice = !S.indice; render(); break;
    case 'toggle-seccion': S.sbSec[b.dataset.sec] = S.sbSec[b.dataset.sec] === false; render(); break;
    case 'menu-area': S.menuArea = !S.menuArea; render(); break;
    case 'ir-condicion': if (leerRuta().pagina !== 'kanban') { e.preventDefault(); irA(document.getElementById('condicion'), { block: 'start' }); } break;
    case 'abrir-tarea': formTarea(tareaPorId(tk)); break;
    case 'nueva-tarea': formTarea(null, pr); break;
    case 'estrella': {
      const t = tareaPorId(tk); if (!t) break;
      t.destacada = !t.destacada; log(t, 'enfasis', t.destacada ? 'Marcada como destacada (especial énfasis).' : 'Se retiró el énfasis.');
      guardarTareas(); render(); toast(t.destacada ? 'Tarea destacada.' : 'Énfasis retirado.'); break;
    }
    case 'editar-proyecto': formProyecto(pr); break;
    case 'abrir-mk': abrirPanel(b.dataset.mk); break;
    case 'editar-resultado': formResultado(pr); break;
    case 'migrar': ejecutarMigracion(); break;
    case 'descargar-respaldo': descargarRespaldo(); break;
    case 'deshacer-migracion':
      confirmar('Deshacer la migración', `<p>Se restauran los datos locales (proyectos, tareas, Kanban general y resultados) tal como estaban antes de la primera migración${almacen.respaldo() ? ` (${C.esc(new Date(almacen.respaldo().fecha).toLocaleString('es'))})` : ''}. Los cambios hechos después se pierden; descarga antes el respaldo si lo necesitas.</p><p>No afecta al Kanban anterior ni al dashboard publicado.</p>`, 'Deshacer', () => {
        almacen.restaurar(almacen.respaldo());
        ['migracion-estado', 'migracion-origen', 'migracion-respaldo-previo'].forEach(k => { try { localStorage.removeItem(almacen.prefijo + k); } catch { /* sin almacenamiento */ } });
        inicios = almacen.proyectos(); tareas = almacen.tareas(); resultados = almacen.resultados(); origen = []; estMig = null; tableroMem = null;
        { const borradas = new Set(almacen.eliminadas().map(x => x.tarea.id)); if (tareas.some(t => borradas.has(t.id))) { tareas = tareas.filter(t => !borradas.has(t.id)); guardarTareas(); } }   // lo eliminado no vuelve
        render({ foco: '[data-act="migrar"]' }); toast('Migración deshecha: datos restaurados.');
      });
      break;
    case 'nueva-fuente': formFuente(pr); break;
    case 'editar-fuente': formFuente(pr, b.dataset.fu); break;
    case 'editar-mk': formMacro(b.dataset.mk); break;
    case 'resolver-condicion': formCondicion(pr); break;
    case 'anular-resolucion':
      confirmar('Anular la resolución', `<p>La condición de «${C.esc(REGISTROS[pr].nombre)}» volverá a figurar sin resolver. La resolución anulada queda en el historial del proyecto.</p>`, 'Anular', () => {
        const ini = inicios[pr], res = ini.condicion.resolucion;
        ini.historial.push({ fecha: ahora(), tipo: 'condicion', nota: `Resolución anulada (era: ${res.nota} · ${res.quien}).` });
        ini.condicion.resolucion = null; guardarInicios(); render({ foco: `[data-act="resolver-condicion"][data-pr="${pr}"]` }); toast('Resolución anulada.');
      });
      break;
    case 'iniciar-ejecucion':
      confirmar('Iniciar la ejecución', `<p>Se registrará que la ejecución de «${C.esc(REGISTROS[pr].nombre)}» comenzó, con base en la resolución de su condición. Desde ese momento sus tareas pueden pasar a Doing, Testing y Completed.</p><p>Las tareas no cambian de estado por esta acción.</p>`, 'Iniciar ejecución', () => {
        const ini = inicios[pr];
        ini.ejecucion = { iniciada: true, fecha: ahora() };
        ini.historial.push({ fecha: ahora(), tipo: 'ejecucion', nota: 'Ejecución marcada como iniciada (condición resuelta).' });
        guardarInicios(); render({ foco: '#h-cond' }); toast('Ejecución iniciada.');
      });
      break;
    case 'restablecer':
      confirmar('Restablecer datos del prototipo', `<p>Se borran los datos de este prototipo guardados en este navegador (prefijo «${C.esc(almacen.prefijo)}»): preferencias, datos de Inicio de los proyectos y tareas. Se vuelven a cargar las actividades de la lista definitiva.</p>
        <p>No afecta al dashboard publicado, al Kanban anterior de Infraestructura ni a Manufactura.</p>`, 'Restablecer', () => {
        almacen.restablecer(); inicios = almacen.proyectos(); tareas = almacen.tareas(); resultados = almacen.resultados(); origen = []; estMig = null; tableroMem = null; cargarEstado(); $('#contenido').innerHTML = ''; render({ foco: '#pg-titulo' }); toast('Datos restablecidos.');
      });
      break;
  }
});
document.addEventListener('change', e => {
  const el = e.target; if (dlg.contains(el) || dlg2.contains(el) || panel.contains(el)) return;
  if (el.dataset.act === 'estado') moverTarea(el.dataset.tk, el.value);
  if (el.dataset.act === 'estado-mk') moverMacro(el.dataset.mk, el.value);
  if (el.dataset.act === 'solo-destacadas') { S.soloDestacadas = el.checked; render({ foco: '[data-act="solo-destacadas"]' }); }
});

/* ── Búsqueda: macroobjetivos, registros y actividades (tareas guardadas en los proyectos habilitados) ── */
const q = $('#q'), lista = $('#sr-list');
let hallados = [], activo = -1;
const indice = () => [
  ...MACROOBJETIVOS.map(m => ({ tipo: 'macro', id: m.id, titulo: `${m.numero} ${m.titulo}`, ruta: AREA.nombre, texto: fold(`${m.numero} ${m.titulo} ${m.corto}`) })),
  ...registros.map(r => { const m = C.macroDe(r); return { tipo: r.tipo, id: r.id, titulo: r.nombre, ruta: `${m.numero} ${m.corto} · ${C.tipoTxt(r)}`, texto: fold(`${r.nombre} ${r.condicion || ''}`) }; }),
  ...registros.flatMap(r => habilitado(r)
    ? tareasDe(r.id).map(t => ({ tipo: 'actividad', id: r.id, tarea: t.id, titulo: t.titulo, ruta: `${r.nombre} · ${r.tipo === 'investigacion' ? 'Tareas' : 'Kanban'} · ${P.colTitulo(t.estado)}`, texto: fold(`${t.titulo} ${t.descripcion} ${t.responsable} ${t.colaboradores}`) }))
    : r.actividades.map(x => ({ tipo: 'actividad', id: r.id, titulo: x.texto, ruta: `${r.nombre} · ${C.macroDe(r).numero}`, texto: fold(x.texto) })))
];
function buscar() {
  const tt = fold(q.value).trim().split(/\s+/).filter(Boolean);
  if (!tt.length) { cerrarResultados(); return; }
  hallados = indice().filter(x => tt.every(w => x.texto.includes(w))).slice(0, 12);
  activo = hallados.length ? 0 : -1; pintarResultados();
}
function pintarResultados() {
  lista.innerHTML = C.resultadosHtml(hallados, activo);
  lista.hidden = false; q.setAttribute('aria-expanded', 'true');
  q.setAttribute('aria-activedescendant', activo >= 0 ? `sr-${activo}` : '');
  const el = lista.querySelector('.is-active'); el && el.scrollIntoView({ block: 'nearest' });
}
function cerrarResultados() { lista.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); }
function elegir(i) {
  const r = hallados[i]; if (!r) return;
  cerrarResultados();
  if (r.tipo === 'macro') irMacro(r.id);
  else if (r.tarea) location.hash = rutaRegistro(REGISTROS[r.id], 'kanban', `tarea=${r.tarea}`);
  else location.hash = rutaRegistro(REGISTROS[r.id]);
}
q.addEventListener('input', buscar);
q.addEventListener('focus', () => { if (q.value.trim()) buscar(); });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (lista.hidden) { buscar(); return; }
    e.preventDefault(); if (!hallados.length) return;
    activo = (activo + (e.key === 'ArrowDown' ? 1 : -1) + hallados.length) % hallados.length; pintarResultados();
  } else if (e.key === 'Enter') { if (!lista.hidden && activo >= 0) { e.preventDefault(); elegir(activo); } }
  else if (e.key === 'Escape') { if (!lista.hidden) { e.preventDefault(); cerrarResultados(); } else if (q.value) q.value = ''; }
});
lista.addEventListener('mousedown', e => e.preventDefault());
lista.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) elegir(Number(li.dataset.i)); });
q.addEventListener('blur', () => setTimeout(cerrarResultados, 120));

/* ── Menú lateral en móvil ── */
const menuBtn = $('#menu-btn'), overlay = $('#sb-overlay'), mainCol = $('#main-col');
function abrirMenu() {
  document.body.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.setAttribute('aria-label', 'Cerrar menú');
  overlay.hidden = false; mainCol.inert = true;
  const f = $('#sidebar').querySelector('a, button'); f && f.focus();
}
function cerrarMenu(devolverFoco = true) {
  if (!document.body.classList.contains('menu-open')) return;
  document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', 'Abrir menú');
  overlay.hidden = true; mainCol.inert = false;
  if (devolverFoco) menuBtn.focus();
}
menuBtn.addEventListener('click', () => (document.body.classList.contains('menu-open') ? cerrarMenu() : abrirMenu()));
overlay.addEventListener('click', () => cerrarMenu());
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open') && !dlg.open && !dlg2.open && !panel.open) cerrarMenu(); });
window.matchMedia('(max-width: 900px)').addEventListener('change', () => { if (!esMovil()) cerrarMenu(false); });

/* Selector de área: se cierra con Esc o al hacer clic fuera. */
function cerrarMenuArea(devolverFoco) {
  if (!S.menuArea) return;
  S.menuArea = false; render({ foco: null });
  if (devolverFoco) { const b = document.querySelector('[data-act="menu-area"]'); b && b.focus(); }
}
document.addEventListener('click', e => { if (S.menuArea && !e.target.closest('.sb-brand-wrap')) cerrarMenuArea(false); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.menuArea) { e.stopPropagation(); cerrarMenuArea(true); } }, true);

/* ── Inicio ── */
cargarEstado();
if (!location.hash) history.replaceState(null, '', '#/objetivos');
alCambiarRuta();
