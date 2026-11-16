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
import * as MD from './maq-datos.js';
import * as MQ from './maq-vistas.js';
import * as RP from './maq-repuestos.js';
import * as PV from './maq-postventa.js';
import * as PVV from './maq-pv-vistas.js';
import * as MP from './maq-mapa.js';
import * as OP from './maq-operacion.js';
import * as OPV from './maq-op-vistas.js';
import * as RSV from './maq-res-vistas.js';
import * as VT from './maq-ventas.js';
import * as VTV from './maq-ventas-vistas.js';
import * as SY from './maq-sync.js';
import * as MVT from './maq-mapa-ventas.js';
import * as NUBE from './nube.js';
import * as NUBEUI from './nube-ui.js';
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
  // Máquinas de simulación: modo (individual / kits), vista (tarjetas / tabla) y filtro por tipo.
  S.maqModo = p.maqModo === 'kits' ? 'kits' : 'individual'; S.maqVista = p.maqVista === 'tabla' ? 'tabla' : 'tarjetas'; S.maqFiltro = typeof p.maqFiltro === 'string' ? p.maqFiltro : '';
  S.repVista = p.repVista === 'tabla' ? 'tabla' : 'tarjetas'; S.repBusca = ''; S.repFiltro = '';
  S.pvVista = ['tabla', 'mapa'].includes(p.pvVista) ? p.pvVista : 'tarjetas'; S.pvEstado = ''; S.pvOper = '';
  S.syncAutor = typeof p.syncAutor === 'string' ? p.syncAutor.slice(0, 80) : '';
  S.vtVista = ['tabla', 'mapa'].includes(p.vtVista) ? p.vtVista : 'tarjetas'; S.vtBusca = ''; S.vtCiudad = ''; S.vtDoc = ''; S.vtAlerta = '';
  S.opVista = p.opVista === 'tabla' ? 'tabla' : 'tarjetas';
  S.menuArea = false;
}
const guardarPrefs = () => almacen.guardarPrefs({ vista: S.vista, abiertos: [...S.abiertos], indice: S.indice, activo: S.activo, sbSec: S.sbSec, soloDestacadas: S.soloDestacadas, maqModo: S.maqModo, maqVista: S.maqVista, maqFiltro: S.maqFiltro, repVista: S.repVista, pvVista: S.pvVista, opVista: S.opVista, vtVista: S.vtVista, syncAutor: S.syncAutor });
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
  else if (r.vista === 'maquinas') {
    // La hoja de máquinas se lee al entrar por primera vez (y con «Actualizar»); mientras tanto se muestra el estado.
    if (MD.M.estado === 'inicial') MD.cargarHoja().then(() => { if (leerRuta().vista === 'maquinas') render(); });
    S.maqSub = r.sub;
    // Registros de venta: carga inicial automática solo en el prototipo local y solo una vez (luego, «Reimportar»).
    if (VT.esLocal() && !VT.meta() && !S.vtImportando) {
      S.vtImportando = true;
      VT.importar().then(() => { if (leerRuta().vista === 'maquinas') render(); }).catch(() => {}).finally(() => { S.vtImportando = false; });
    }
    // Repuestos se leen al abrir su pestaña o el Resumen (que muestra sus indicadores).
    if (((r.ventana === 'stock' && r.sub === 'repuestos') || r.ventana === 'resumen') && RP.R.estado === 'inicial')
      RP.cargar().then(() => { const x = leerRuta(); if (x.vista === 'maquinas' && (x.sub === 'repuestos' || x.ventana === 'resumen')) render(); });
    const v = r.ventana;
    if (v === 'postventa') {
      // Ubicaciones provisionales por ciudad (una sola vez por venta; no pisa ediciones) y carga del mapa (Leaflet + OpenStreetMap).
      if (!S.vtUbAseguradas) { S.vtUbAseguradas = true; VT.asegurarUbicaciones(); }
      if (MVT.estadoMapa().fase === 'inicial') MVT.cargarMapa().then(() => render(), () => render());
    }
    html = v === 'stock' ? MQ.stockHtml(S)
      : v === 'postventa' ? PVV.postventaHtml(S, MVT.estadoMapa())
        : v === 'operacion' ? OPV.operacionHtml(S)
          : RSV.resumenHtml();
    titulo = `${MQ.VENTANAS.find(x => x.id === v).titulo} · Máquinas de simulación`;
  }
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
  // Mapa de Postventa (Leaflet + OpenStreetMap): el mismo mapa se vuelve a colocar tras cada repintado, sin perder zoom ni posición.
  const elMapa = document.getElementById('pv-mapa'), slotGm = document.getElementById('vt-gmap-slot');
  if (slotGm && r.vista === 'maquinas' && r.ventana === 'postventa' && MVT.estadoMapa().fase === 'listo') {
    try { MVT.montarPrincipal(slotGm, VTV.ventasFiltradas(S), VT.ventas(), VTV.popupMapaHtml); }
    catch (err) { slotGm.innerHTML = `<p class="vt-gmap-msg">No se pudo mostrar el mapa: ${C.esc(err.message)}</p>`; }
  }
  if (elMapa && r.vista === 'maquinas' && r.ventana === 'postventa') {
    const marcas = PVV.marcadoresMapa(PVV.talleresFiltrados(S));
    if (marcas.length) MP.montarMapa(elMapa, marcas, PVV.popupTallerHtml).catch(err => { elMapa.innerHTML = `<p class="aviso err">${C.esc(err.message)}</p>`; });
  } else MP.desmontarMapa();
  guardarPrefs();
}

/* Cambio de ruta: pantalla nueva desde arriba, foco en su título; los parámetros de un solo uso se consumen. */
function alCambiarRuta() {
  cerrarMenu(false); cerrarResultados();
  [dlg, dlg2, panel].forEach(d => { if (d.open) d.close(); });
  const r = leerRuta();
  if (r.seccion === 'proyectos' || r.seccion === 'investigaciones' || r.seccion === 'maquinas') S.sbSec[r.seccion] = true;
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

/* ── Máquinas de simulación: fichas, formularios y kits ── */
function maqFicha(id) {
  const u = MD.unidadPorId(id); if (!u) return;
  abrirDialogo(dlg, MQ.fichaHtml(u), `[data-act="maq-ficha"][data-uid="${CSS.escape(id)}"]`);
  // Postventa de la unidad: instalación, trayectoria y servicios (la ficha es la misma dentro y fuera de stock).
  const op = OP.deUnidad(u.id);
  dlg.querySelector('.dlg-body').insertAdjacentHTML('beforeend', OPV.operacionUnidadHtml(u) + PVV.postventaUnidadHtml(u));
  dlg.querySelector('.dlg-foot').insertAdjacentHTML('afterbegin', `<button type="button" class="btn btn-ghost" data-ficha="servicio">+ Servicio o incidencia</button>${u.tallerId ? '<button type="button" class="btn btn-ghost" data-ficha="retiro">Registrar retiro</button>' : ''}
    ${op ? '<button type="button" class="btn btn-ghost" data-ficha="op-inspeccion">+ Inspección</button><button type="button" class="btn btn-ghost" data-ficha="op-editar">Editar operación</button><button type="button" class="btn btn-ghost" data-ficha="op-fin">Retirar de operación</button>' : ''}`);
  dlg.querySelector('.dlg-body').addEventListener('click', e => { const b = e.target.closest('[data-pv="editar-servicio"]'); if (b) pvFormServicio(b.dataset.sid, {}); });
  dlg.querySelector('.dlg-foot').addEventListener('click', e => {
    const b = e.target.closest('[data-ficha]'); if (!b) return;
    if (b.dataset.ficha === 'servicio') pvFormServicio(null, { unidadId: u.id, tallerId: u.tallerId });
    if (b.dataset.ficha === 'retiro') pvFormRetiro(u);
    if (b.dataset.ficha === 'op-editar') opForm(op);
    if (b.dataset.ficha === 'op-inspeccion') opInspeccion(op, u);
    if (b.dataset.ficha === 'op-fin') opFin(op, u);
    if (b.dataset.ficha === 'editar') maqFormComplemento(u);
    if (b.dataset.ficha === 'hoja') maqFormHoja(u);
    if (b.dataset.ficha === 'borrar') {
      dlgRetorno = null; dlg.close();
      confirmar('Eliminar soporte', `<p>Se eliminará el soporte «${C.esc(u.codigo || u.id)}». No pertenece a ningún kit.</p>`, 'Eliminar', () => {
        if (MD.eliminarSoporte(u.id)) { render(); toast('Soporte eliminado.'); } else toast('No se puede eliminar: el soporte está en un kit.');
      });
    }
  });
}
function maqFormComplemento(u0) {
  const soporte = !u0 || u0.tipo === 'soporte', u = u0 || {};
  abrirDialogo(dlg, MQ.formComplementoHtml(u, soporte), soporte && !u0 ? '[data-act="maq-nuevo-soporte"]' : null);
  const form = dlg.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const errCodigo = t => { const er = form.elements.codigo.parentElement.querySelector('.err'); er.textContent = t; er.hidden = false; form.elements.codigo.focus(); };
    if (soporte && !g('codigo')) { errCodigo('Escribe el código interno del soporte.'); return; }
    const datos = { codigo: g('codigo'), serial: g('serial'), marca: g('marca'), modelo: g('modelo'), ubicacion: g('ubicacion'), estadoOperativo: g('estadoOperativo'), condicion: g('condicion'), observaciones: g('observaciones') };
    if (soporte) {
      if (MD.soportes().some(s => s.codigo.toUpperCase() === datos.codigo.toUpperCase() && s.id !== u.id)) { errCodigo('Ya existe un soporte con ese código interno.'); return; }
      MD.guardarSoporte(datos, u.id);
    } else MD.guardarComplemento(u.id, datos, 'Datos complementarios editados (marca, modelo, ubicación, estado operativo u observaciones).');
    dlgRetorno = null; dlg.close(); render(); toast(soporte && !u0 ? 'Soporte agregado.' : 'Datos guardados.');
  });
}
function maqFormHoja(u) {
  abrirDialogo(dlg, MQ.formHojaHtml(u), u ? null : '[data-act="maq-nueva-maquina"]');
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const g = n => String(form.elements[n] && form.elements[n].value !== undefined ? form.elements[n].value : '').trim();
    const radio = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value || '';
    const errs = { codificacion: !g('codificacion'), categoria: !radio('categoria'), escalera: !radio('escalera'), clave: !!form.elements.clave && !g('clave') };
    Object.entries(errs).forEach(([k, bad]) => {
      const el = form.querySelector(`[name="${k}"]`); const er = el && el.closest('.fld').querySelector('.err'); if (er) er.hidden = !bad;
    });
    if (Object.values(errs).some(Boolean)) return;
    if (g('imagen') && !/^https:\/\//.test(g('imagen'))) { msg.innerHTML = '<p class="aviso err">El enlace de la imagen debe empezar por https://</p>'; return; }
    const cod = MD.codeKey(g('codificacion'));
    if (MD.M.maquinas.some(x => MD.codeKey(x.codigo) === cod && (!u || x.id !== u.id))) { msg.innerHTML = '<p class="aviso err">Ya existe una máquina con esa codificación.</p>'; return; }
    if (g('serial') && MD.M.maquinas.some(x => x.serial && x.serial.toUpperCase() === g('serial').toUpperCase() && (!u || x.id !== u.id))) { msg.innerHTML = '<p class="aviso err">Ya existe una máquina con ese serial.</p>'; return; }
    const datos = { codificacion: g('codificacion'), categoria: radio('categoria'), serial: g('serial'), escalera: radio('escalera'), condicion: radio('condicion') || 'En stock', imagen: g('imagen') };
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Guardando…'; msg.innerHTML = '';
    try {
      if (u) await MD.editarEnHoja(u, datos, g('clave')); else await MD.agregarEnHoja(datos, g('clave'));
      if (u && MD.idDeCodigo(datos.codificacion) !== u.id) MD.renombrarUnidad(u.id, MD.idDeCodigo(datos.codificacion));
      dlgRetorno = null; dlg.close(); toast(u ? 'Cambios guardados en la hoja.' : 'Máquina agregada a la hoja.');
      await MD.cargarHoja(); render();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Guardar en la hoja';
      msg.innerHTML = `<p class="aviso err">${C.esc(err.code === 'CONFLICT' ? 'Esta máquina cambió en la hoja mientras la editabas. Pulsa «Actualizar» y vuelve a intentarlo.' : err.message)}</p>`;
    }
  });
}
/* ── Postventa: talleres, instalaciones, servicios y retiro ── */
function pvTaller(id) {
  const t = PV.tallerPorId(id); if (!t) return;
  abrirDialogo(dlg, PVV.fichaTallerHtml(t), `[data-act="pv-taller"][data-tid="${CSS.escape(id)}"]`);
  // Los oyentes van en el contenido de esta ficha (se reemplaza al abrir otra), no en la ventana: así no se acumulan.
  const accion = e => {
    const b = e.target.closest('[data-pv]'); if (!b) return;
    if (b.dataset.pv === 'editar') pvFormTaller(t);
    if (b.dataset.pv === 'instalar') pvFormInstalacion(t.id);
    if (b.dataset.pv === 'servicio') pvFormServicio(null, { tallerId: t.id });
    if (b.dataset.pv === 'editar-servicio') pvFormServicio(b.dataset.sid, {});
  };
  dlg.querySelector('.dlg-body').addEventListener('click', accion);
  dlg.querySelector('.dlg-foot').addEventListener('click', accion);
}
let miniMapa = null;
function pvFormTaller(t) {
  if (t && !NUBE.telefonosVisibles()) { dlg.close(); toast('Para editar el taller escribe tu nombre y el PIN.'); NUBEUI.abrir(); return; }
  abrirDialogo(dlg, PVV.formTallerHtml(t), t ? null : '[data-act="pv-nuevo-taller"]');
  const form = dlg.querySelector('form'), cont = form.querySelector('[data-contactos]'), errC = form.querySelector('[data-err-coord]');
  const numCoord = v => { const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() === '' ? null : Number.isFinite(n) ? n : NaN; };
  // Mapa del formulario: un clic marca las coordenadas; escribir o pegar coordenadas mueve el marcador.
  MP.miniMapa(form.querySelector('[data-minimapa]'), t ? t.lat : NaN, t ? t.lng : NaN, (lat, lng, zoom) => {
    form.elements.lat.value = lat; form.elements.lng.value = lng;
    errC.hidden = zoom >= 15; errC.textContent = zoom >= 15 ? '' : 'Acércate más (hasta ver la calle) para marcar la ubicación exacta.';
  }).then(m => { miniMapa = m; }).catch(() => { form.querySelector('[data-minimapa]').innerHTML = '<p class="nota">No se pudo cargar el mapa. Puedes escribir las coordenadas.</p>'; });
  const alPegar = () => {
    // Se acepta pegar «10.4806, -66.9036» en la latitud.
    const m = String(form.elements.lat.value).match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (m) { form.elements.lat.value = m[1].replace(',', '.'); form.elements.lng.value = m[2].replace(',', '.'); }
    const a = numCoord(form.elements.lat.value), b = numCoord(form.elements.lng.value);
    if (miniMapa && Number.isFinite(a) && Number.isFinite(b)) miniMapa.mover(a, b);
  };
  form.elements.lat.addEventListener('change', alPegar); form.elements.lng.addEventListener('change', alPegar);
  form.addEventListener('click', e => {
    if (e.target.closest('[data-pv-agregar-contacto]')) { cont.insertAdjacentHTML('beforeend', PVV.contactoFilaHtml({}, cont.children.length)); cont.lastElementChild.querySelector('input').focus(); }
    const q = e.target.closest('[data-pv-quitar-contacto]'); if (q) q.closest('[data-contacto]').remove();
    if (e.target.closest('[data-pv-borrar]')) {
      dlgRetorno = null; dlg.close();
      confirmar('Eliminar taller', `<p>Se eliminará «${C.esc(t.nombre)}».</p>`, 'Eliminar', () => { const er = PV.eliminarTaller(t.id); render(); toast(er || 'Taller eliminado.'); });
    }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n].value || '').trim();
    const errN = form.elements.nombre.parentElement.querySelector('.err'); errN.hidden = !!g('nombre'); if (!g('nombre')) { form.elements.nombre.focus(); return; }
    const lat = numCoord(g('lat')), lng = numCoord(g('lng')), conf = form.elements.coordConfirmadas.checked;
    const errCoord = t2 => { errC.textContent = t2; errC.hidden = false; form.elements.lat.focus(); };
    if (Number.isNaN(lat) || Number.isNaN(lng) || (lat === null) !== (lng === null)) { errCoord('Escribe latitud y longitud como números (por ejemplo, 10.4806 y -66.9036).'); return; }
    if (lat !== null && !PV.dentroDeVenezuela(lat, lng)) { errCoord('Esas coordenadas quedan fuera de Venezuela. Revisa el orden (latitud primero) y el signo de la longitud.'); return; }
    if (conf && lat === null) { errCoord('Para marcar las coordenadas como confirmadas, primero indícalas.'); return; }
    const contactos = [...cont.querySelectorAll('[data-contacto]')].map(f => ({ nombre: f.querySelector('[name="c-nombre"]').value, cargo: f.querySelector('[name="c-cargo"]').value,
      telefono: f.querySelector('[name="c-telefono"]').value, correo: f.querySelector('[name="c-correo"]').value }));
    const nuevo = PV.guardarTaller({ nombre: g('nombre'), red: g('red'), estado: g('estado'), municipio: g('municipio'), ciudad: g('ciudad'), direccion: g('direccion'),
      lat, lng, coordConfirmadas: conf, contactos, observaciones: g('observaciones') }, t && t.id);
    if (miniMapa) { miniMapa.quitar(); miniMapa = null; }
    dlgRetorno = null; dlg.close(); render(); toast(t ? 'Taller guardado.' : 'Taller agregado.');
    if (!t) pvTaller(nuevo.id);
  });
  dlg.addEventListener('close', () => { if (miniMapa) { miniMapa.quitar(); miniMapa = null; } }, { once: true });
}
function pvFormInstalacion(tallerId) {
  abrirDialogo(dlg, PVV.formInstalacionHtml(tallerId), tallerId ? null : '[data-act="pv-instalar"]');
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]');
  const kit = form.querySelector('[data-pv-kit]');
  if (kit) kit.addEventListener('change', () => form.querySelectorAll('input[name="unidad"]').forEach(c => { if (kit.value && c.dataset.kit === kit.value) c.checked = true; }));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const ids = [...form.querySelectorAll('input[name="unidad"]:checked')].map(c => c.value);
    form.elements.tallerId.parentElement.querySelector('.err').hidden = !!g('tallerId');
    form.querySelector('[data-err-unidad]').hidden = ids.length > 0;
    if (!g('tallerId') || !ids.length) return;
    const r = PV.registrarInstalacion(ids, { tallerId: g('tallerId'), fechaVenta: g('fechaVenta'), fechaInstalacion: g('fechaInstalacion'), garantia: g('garantia'), observaciones: g('observaciones') });
    if (r.error) { msg.innerHTML = `<span class="aviso err">${C.esc(r.error)}</span>`; return; }
    dlgRetorno = null; dlg.close(); render(); toast(`${r.registradas === 1 ? 'Instalación registrada' : `${r.registradas} unidades registradas`} en el taller.`);
  });
}
function pvFormServicio(sid, ctx) {
  const s = sid ? PV.servicios().find(x => x.id === sid) : null;
  abrirDialogo(dlg, PVV.formServicioHtml(s, s ? {} : ctx), null);
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const r = PV.guardarServicio({ tipo: g('tipo'), fecha: g('fecha'), estado: g('estado'), unidadId: g('unidadId'), tallerId: g('tallerId'), ventaId: g('ventaId'), descripcion: g('descripcion'), proximaAccion: g('proximaAccion'), responsable: g('responsable') }, s && s.id);
    if (r.error) { msg.innerHTML = `<span class="aviso err">${C.esc(r.error)}</span>`; return; }
    dlgRetorno = null; dlg.close(); render(); toast('Registro guardado.');
    if (g('ventaId')) vtFicha(g('ventaId')); else if (g('tallerId')) pvTaller(g('tallerId')); else if (g('unidadId')) maqFicha(g('unidadId'));
  });
}
function pvFormRetiro(u, despues) {
  abrirDialogo(dlg, PVV.formRetiroHtml(u), null);
  const form = dlg.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const er = PV.retirar(u.id, { fecha: form.elements.fecha.value, motivo: form.elements.motivo.value });
    dlgRetorno = null; dlg.close(); render(); toast(er || 'Retiro registrado; la entrega queda en el historial.'); if (despues) despues();
  });
}
/* Dentro de una ficha, los enlaces a otra ficha (máquina ↔ taller) cambian el contenido de la ventana. */
dlg.addEventListener('click', e => {
  const b = e.target.closest('[data-act="maq-ficha"], [data-act="pv-taller"], [data-act="vt-ficha"], [data-act="nube-pin"]'); if (!b || !dlg.contains(b)) return;
  e.stopPropagation();
  if (b.dataset.act === 'nube-pin') { dlg.close(); NUBEUI.abrir(); } else if (b.dataset.act === 'maq-ficha') maqFicha(b.dataset.uid); else if (b.dataset.act === 'vt-ficha') vtFicha(b.dataset.vid); else pvTaller(b.dataset.tid);
});

/* ── Sincronización con la hoja privada compartida ── */
function syncForm() {
  abrirDialogo(dlg, MQ.formSyncHtml(S.syncAutor), '[data-act="sync-abrir"]');
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]'), enviar = form.querySelector('[type="submit"]');
  const desc = form.querySelector('[data-sync-descartar]');
  if (desc) desc.addEventListener('click', () => { SY.descartarNoAplicados(); dlgRetorno = null; dlg.close(); render(); toast('Lista de cambios no aplicados vaciada.'); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const cl = form.elements.clave, err = cl && cl.closest('.fld').querySelector('.err');
    if (cl && !cl.value) { err.hidden = false; cl.focus(); return; }
    S.syncAutor = form.elements.autor.value.trim(); guardarPrefs();
    enviar.disabled = true; msg.innerHTML = '<span class="nota">Conectando con Google… confirma en la ventana que se abrió.</span>';
    try {
      const m = await SY.sincronizar(cl ? cl.value : '', S.syncAutor);
      dlgRetorno = null; dlg.close(); render();
      toast(`Sincronizado: ${m.enviados === 1 ? '1 cambio enviado' : `${m.enviados} cambios enviados`}${m.conflictos ? ` · ${m.conflictos} no aplicados (revísalos en Sincronizar)` : ''}.`);
    } catch (er) {
      enviar.disabled = false;
      msg.innerHTML = `<span class="aviso err">${C.esc(er.message)}</span>`;
      if (er.code === 'UNAUTHORIZED' && cl) { cl.value = ''; cl.focus(); }
    }
  });
}

/* ── Registros de venta: ficha, corrección con historial, servicios ligados a la venta ── */
function vtFicha(id) {
  const v = VT.ventaPorId(id); if (!v) { toast('El registro ya no existe.'); return; }
  abrirDialogo(dlg, VTV.fichaVentaHtml(v), `[data-act="vt-ficha"][data-vid="${CSS.escape(id)}"]`);
  const pie = dlg.querySelector('.dlg-foot'), cuerpo = dlg.querySelector('.dlg-body');
  const enAccion = e => {
    const b = e.target.closest('[data-vt]'); if (!b) return;
    if (b.dataset.vt === 'editar') { if (!NUBE.telefonosVisibles()) { dlg.close(); toast('Para corregir los datos de la venta escribe tu nombre y el PIN.'); NUBEUI.abrir(); } else vtForm(v); }
    else if (b.dataset.vt === 'servicio') pvFormServicio(null, { ventaId: v.id });
    else if (b.dataset.vt === 'editar-servicio') pvFormServicio(b.dataset.sid, {});
    else if (b.dataset.vt === 'entregar') vtEntrega(v);
    else if (b.dataset.vt === 'ubicacion') vtUbicacion(v);
    else if (b.dataset.vt === 'retirar') { const u = MD.unidadPorId(b.dataset.uid); if (u) pvFormRetiro(u, () => vtFicha(v.id)); }
  };
  pie.addEventListener('click', enAccion); cuerpo.addEventListener('click', enAccion);
}
function vtEntrega(v) {
  abrirDialogo(dlg, VTV.formEntregaHtml(v), null);
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]'), kit = form.querySelector('[data-pv-kit]');
  if (kit) kit.addEventListener('change', () => form.querySelectorAll('input[name="unidad"]').forEach(c => { if (kit.value && c.dataset.kit === kit.value) c.checked = true; }));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const ids = [...form.querySelectorAll('input[name="unidad"]:checked')].map(c => c.value);
    form.querySelector('[data-err-unidad]').hidden = ids.length > 0; if (!ids.length) return;
    const r = PV.registrarInstalacion(ids, { ventaId: v.id, fechaVenta: v.origen.fechaVenta, fechaInstalacion: form.elements.fechaInstalacion.value, observaciones: form.elements.observaciones.value });
    if (r.error) { msg.innerHTML = `<span class="aviso err">${C.esc(r.error)}</span>`; return; }
    dlgRetorno = null; dlg.close(); render(); toast(r.registradas === 1 ? 'Equipo registrado como entregado.' : `${r.registradas} equipos registrados como entregados.`);
    vtFicha(v.id);
  });
}
function vtForm(v) {
  abrirDialogo(dlg, VTV.formVentaHtml(v), null);
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]'), cont = form.querySelector('[data-contactos]');
  form.addEventListener('click', e => {
    if (e.target.closest('[data-vt-agregar-contacto]')) { cont.insertAdjacentHTML('beforeend', VTV.contactoFilaVentaHtml({})); cont.lastElementChild.querySelector('input').focus(); }
    const q = e.target.closest('[data-vt-quitar-contacto]'); if (q) q.closest('[data-contacto]').remove();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const cambios = {};
    Object.keys(VT.CAMPOS).forEach(k => { const el = form.elements[k]; if (el && el.name === k) cambios[k] = el.type === 'checkbox' ? el.checked : el.value; });
    cambios.contactos = [...cont.querySelectorAll('[data-contacto]')].map(f => ({ nombre: f.querySelector('[name="c-nombre"]').value, cargo: f.querySelector('[name="c-cargo"]').value,
      telefono: f.querySelector('[name="c-telefono"]').value, correo: f.querySelector('[name="c-correo"]').value }));
    const r = VT.editar(v.id, cambios, form.elements.motivo.value);
    if (r.error) { msg.innerHTML = `<span class="aviso err">${C.esc(r.error)}</span>`; return; }
    dlgRetorno = null; dlg.close(); render();
    toast(r.sinCambios ? 'Sin cambios.' : `${r.ok === 1 ? 'Cambio guardado' : `${r.ok} cambios guardados`} en el historial.`);
    vtFicha(v.id);
  });
}

/* ── Mapa de Postventa: localizar una venta y editar su ubicación ── */
function vtLocalizar(id) {
  if (MVT.estadoMapa().fase !== 'listo') { toast('El mapa no está disponible en este momento. Usa «Reintentar» en el panel del mapa.'); return; }
  if (S.vtMapaContraido) { S.vtMapaContraido = false; render(); }
  const panel = document.querySelector('.vt-mapa-panel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!MVT.localizar(id)) toast('Esta venta no aparece en el mapa con los filtros actuales.');
}
function vtUbicacion(v) {
  const listo = MVT.estadoMapa().fase === 'listo';
  abrirDialogo(dlg, VTV.formUbicacionHtml(v, listo), null);
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]'), emsg = form.querySelector('[data-enlace-msg]');
  const num = x => { const s = String(x ?? '').trim().replace(',', '.'); const n = Number(s); return s === '' ? null : Number.isFinite(n) ? n : NaN; };
  const ant = v.ubicacion;
  const poner = (lat, lng) => { form.elements.lat.value = lat; form.elements.lng.value = lng; };
  const ed = listo ? MVT.montarEditor(form.querySelector('[data-ub-mapa]'), ant && ant.lat !== null ? { lat: ant.lat, lng: ant.lng } : null, poner) : null;
  if (ed) dlg.addEventListener('close', () => ed.quitar(), { once: true });
  const alEscribir = () => {
    // Se acepta pegar «10.4806, -66.9036» en la latitud.
    const m = String(form.elements.lat.value).match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (m) poner(m[1].replace(',', '.'), m[2].replace(',', '.'));
    const a = num(form.elements.lat.value), b = num(form.elements.lng.value);
    if (ed && Number.isFinite(a) && Number.isFinite(b)) ed.mover(a, b);
  };
  form.elements.lat.addEventListener('change', alEscribir); form.elements.lng.addEventListener('change', alEscribir);
  let analisis = null;
  const leerEnlace = () => {
    analisis = VT.analizarEnlaceMaps(form.elements.enlace.value);
    if (analisis.tipo === 'vacio') { emsg.innerHTML = ''; return; }
    const aplicable = ['lugar', 'consulta', 'coordenadas'].includes(analisis.tipo);
    emsg.innerHTML = `<p class="${aplicable ? 'nota' : 'aviso-lectura'}">${C.esc(analisis.mensaje)}</p>${analisis.tipo === 'camara' ? '<button type="button" class="btn btn-sm" data-ub="camara">Usar el centro de la vista como punto de partida</button>' : ''}`;
    // Un enlace con coordenadas del lugar solo PROPONE el punto: no se guarda ni se marca exacto sin confirmación.
    if (aplicable) { poner(analisis.lat, analisis.lng); alEscribir(); }
  };
  form.elements.enlace.addEventListener('change', leerEnlace);
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-ub]'); if (!b) return;
    if (b.dataset.ub === 'leer') leerEnlace();
    if (b.dataset.ub === 'camara' && analisis && analisis.tipo === 'camara') { poner(analisis.lat, analisis.lng); alEscribir(); }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const lat = num(g('lat')), lng = num(g('lng')), prec = form.querySelector('input[name="precision"]:checked');
    if (Number.isNaN(lat) || Number.isNaN(lng)) { msg.innerHTML = '<span class="aviso err">Escribe latitud y longitud como números (por ejemplo, 10.4806 y -66.9036).</span>'; return; }
    const enlace = g('enlace'), an = enlace ? VT.analizarEnlaceMaps(enlace) : null;
    if (an && an.tipo === 'invalido') { msg.innerHTML = `<span class="aviso err">${C.esc(an.mensaje)}</span>`; return; }
    let referencia = g('referencia');
    const movido = !ant || ant.lat !== lat || ant.lng !== lng;
    if (ant && referencia === ant.referencia) {
      if (prec && prec.value === 'exacta' && ant.precision !== 'exacta') referencia = 'Entrada del taller (confirmada)';
      else if (movido) referencia = 'Punto elegido en el mapa';
    }
    const r = VT.guardarUbicacion(v.id, { lat, lng, precision: prec ? prec.value : '', direccion: g('direccion'), ciudad: g('ciudad'), estado: g('estado'), referencia,
      enlace, enlaceNota: an ? an.mensaje : '', nota: ant && ant.nota && prec && prec.value === 'aproximada' && g('estado') === ant.estado ? ant.nota : '' }, S.syncAutor);
    if (r.error) { msg.innerHTML = `<span class="aviso err">${C.esc(r.error)}</span>`; return; }
    dlgRetorno = null; dlg.close(); render();
    toast(`Ubicación ${r.ubicacion.precision === 'exacta' ? 'exacta' : 'aproximada'} guardada; la anterior queda en el historial.`);
    vtFicha(v.id);
  });
}

/* ── Equipos en operación: registrar, editar, inspección y retiro ── */
function opForm(r) {
  abrirDialogo(dlg, OPV.formOperacionHtml(r), r ? null : '[data-act="op-nuevo"]');
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    const datos = { ubicacion: g('ubicacion'), responsable: g('responsable'), desde: g('desde'), proximaAccion: g('proximaAccion'), fichaTecnica: g('fichaTecnica') };
    const er = r ? OP.editar(r.id, datos) : (OP.registrar(g('unidadId'), datos).error || '');
    if (er) { msg.innerHTML = `<span class="aviso err">${C.esc(er)}</span>`; return; }
    const uid = r ? r.unidadId : g('unidadId');
    dlgRetorno = null; dlg.close(); render(); toast(r ? 'Datos de operación guardados.' : 'Equipo registrado en operación.');
    maqFicha(uid);
  });
}
function opInspeccion(r, u) {
  abrirDialogo(dlg, OPV.formInspeccionHtml(r, u), null);
  const form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const er = OP.inspeccion(r.id, form.elements.fecha.value, form.elements.nota.value.trim());
    if (er) { msg.innerHTML = `<span class="aviso err">${C.esc(er)}</span>`; return; }
    dlgRetorno = null; dlg.close(); render(); toast('Inspección registrada.'); maqFicha(u.id);
  });
}
function opFin(r, u) {
  abrirDialogo(dlg, OPV.formFinOperacionHtml(u), null);
  const form = dlg.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const er = OP.retirar(r.id, form.elements.fecha.value, form.elements.motivo.value);
    dlgRetorno = null; dlg.close(); render(); toast(er || 'Equipo retirado de operación; queda en su historial.');
  });
}

/* ── Repuestos: ficha, existencia (modificable con historial) y datos complementarios ── */
function repFicha(id) {
  const r = RP.repuestoPorId(id); if (!r) return;
  abrirDialogo(dlg, MQ.fichaRepuestoHtml(r), `[data-act="rep-ficha"][data-rid="${CSS.escape(id)}"]`);
  dlg.querySelector('.dlg-foot').addEventListener('click', e => {
    const b = e.target.closest('[data-ficha]'); if (!b) return;
    if (b.dataset.ficha === 'existencia') repExistencia(id);
    if (b.dataset.ficha === 'datos') repDatos(id);
  });
}
function repExistencia(id) {
  const r = RP.repuestoPorId(id); if (!r) return;
  abrirDialogo(dlg, MQ.formExistenciaHtml(r), `[data-act="rep-existencia"][data-rid="${CSS.escape(id)}"]`);
  const form = dlg.querySelector('form');
  form.elements.existencia.select();
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = form.elements.existencia.value.trim(), n = Number(v);
    const er = form.elements.existencia.parentElement.querySelector('.err');
    const msg = v === '' ? 'Escribe la nueva existencia.' : RP.ajustarExistencia(id, n, form.elements.motivo.value);
    if (msg) { er.textContent = msg; er.hidden = false; form.elements.existencia.focus(); return; }
    dlgRetorno = null; dlg.close(); render(); toast(`Existencia actualizada: ${r.descEs || r.ref} → ${n}.`);
  });
}
function repDatos(id) {
  const r = RP.repuestoPorId(id); if (!r) return;
  abrirDialogo(dlg, MQ.formRepuestoHtml(r), null);
  const form = dlg.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n].value || '').trim();
    const er = form.elements.imagen.parentElement.querySelector('.err');
    er.hidden = !g('imagen') || /^https:\/\//.test(g('imagen')); if (!er.hidden) { form.elements.imagen.focus(); return; }
    RP.guardarDatos(id, { ubicacion: g('ubicacion'), unidad: g('unidad'), compatibilidad: g('compatibilidad'), imagen: g('imagen'), observaciones: g('observaciones') });
    dlgRetorno = null; dlg.close(); render(); toast('Datos de la referencia guardados.');
  });
}

function maqFormKit() {
  abrirDialogo(dlg, MQ.formKitHtml(), '[data-act="maq-nuevo-kit"]');
  const form = dlg.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const r = MD.crearKit(form.elements.codigo.value, form.elements.observaciones.value.trim());
    const er = form.elements.codigo.parentElement.querySelector('.err');
    if (r.error) { er.textContent = r.error; er.hidden = false; form.elements.codigo.focus(); return; }
    dlgRetorno = null; dlg.close(); render(); toast(`Kit ${r.kit.codigo} creado. Asígnale sus unidades.`);
  });
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
    case 'pv-vista': S.pvVista = b.dataset.vista; render(); break;
    case 'vt-vista': S.vtVista = b.dataset.vista; render({ foco: `[data-act="vt-vista"][data-vista="${b.dataset.vista}"]` }); break;
    case 'vt-ficha': vtFicha(b.dataset.vid); break;
    case 'sync-abrir': syncForm(); break;
    case 'nube-pin': NUBEUI.abrir(); break;
    case 'vt-localizar': vtLocalizar(b.dataset.vid); break;
    case 'vt-ubicacion': { const v = VT.ventaPorId(b.dataset.vid); if (v) vtUbicacion(v); break; }
    case 'vt-mapa-todas': MVT.verTodas(VTV.ventasFiltradas(S)); break;
    case 'vt-mapa-contraer': S.vtMapaContraido = !S.vtMapaContraido; render({ foco: '[data-act="vt-mapa-contraer"]' }); break;
    case 'vt-mapa-reintentar':
      if (MVT.estadoMapa().fase === 'error') { MVT.reiniciarCarga(); MVT.cargarMapa().then(() => render(), () => render()); render(); } else MVT.reintentarTeselas();
      break;
    case 'vt-limpiar': S.vtBusca = ''; S.vtCiudad = ''; S.vtDoc = ''; S.vtAlerta = ''; render({ foco: '[data-act="vt-busca"]' }); break;
    case 'vt-importar':
      VT.importar().then(x => { render(); toast(x.reparadas ? `Se recuperaron ${x.reparadas} teléfonos desde el archivo de origen.` : x.nuevas + x.evidNuevas + x.pendNuevos ? `Importado: ${x.nuevas} ventas y ${x.evidNuevas} evidencias nuevas.` : 'Nada nuevo: no se duplicó ningún registro y tus correcciones se conservan.'); }).catch(err => toast(err.message));
      break;
    case 'vt-clasificar': {
      const er = VT.resolverSinClasificar(b.dataset.eid, b.dataset.accion, b.dataset.vid);
      render(); toast(er || (b.dataset.accion === 'asociar' ? 'Archivo asociado a la venta.' : 'Marcado como copia; no se asocia.')); break;
    }
    case 'op-vista': S.opVista = b.dataset.vista; render(); break;
    case 'op-nuevo': opForm(null); break;
    case 'pv-taller': pvTaller(b.dataset.tid); break;
    case 'pv-nuevo-taller': pvFormTaller(null); break;
    case 'pv-instalar': pvFormInstalacion(''); break;
    case 'rep-actualizar':
      RP.cargar().then(() => { render(); toast(RP.R.desdeCache || RP.R.estado === 'error' ? 'No se pudo actualizar.' : 'Actualizado.'); });
      render(); break;
    case 'rep-vista': S.repVista = b.dataset.vista; render(); break;
    case 'rep-ficha': repFicha(b.dataset.rid); break;
    case 'rep-existencia': repExistencia(b.dataset.rid); break;
    case 'maq-actualizar':
      MD.cargarHoja().then(() => { render(); toast(MD.M.desdeCache || MD.M.estado === 'error' ? 'No se pudo actualizar.' : 'Actualizado.'); });
      render(); break;
    case 'maq-modo': S.maqModo = b.dataset.modo; render(); break;
    case 'maq-vista': S.maqVista = b.dataset.vista; render(); break;
    case 'maq-ficha': maqFicha(b.dataset.uid); break;
    case 'maq-nuevo-soporte': maqFormComplemento(null); break;
    case 'maq-nueva-maquina': maqFormHoja(null); break;
    case 'maq-nuevo-kit': maqFormKit(); break;
    case 'maq-ver-kit':
      S.maqModo = 'kits';
      if (leerRuta().ventana !== 'stock') location.hash = '#/maquinas/stock'; else render();
      setTimeout(() => irA(document.getElementById('kit-' + b.dataset.kit), { block: 'center' }), 80);
      break;
    case 'maq-quitar': { const er = MD.asignar(b.dataset.kit, b.dataset.pos, ''); render(); toast(er || 'Unidad quitada del kit; queda suelta.'); break; }
    case 'maq-desactivar-kit':
      confirmar('Desactivar kit', '<p>El kit se conserva con su historial y sus unidades quedan sueltas, disponibles para otro kit.</p>', 'Desactivar', () => { MD.desactivarKit(b.dataset.kit); render(); toast('Kit desactivado.'); });
      break;
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
  if (el.dataset.act === 'maq-filtro-tipo') { S.maqFiltro = el.value; render({ foco: '[data-act="maq-filtro-tipo"]' }); }
  if (el.dataset.act === 'rep-filtro') { S.repFiltro = el.value; render({ foco: '[data-act="rep-filtro"]' }); }
  if (el.dataset.act === 'pv-estado') { S.pvEstado = el.value; render({ foco: '[data-act="pv-estado"]' }); }
  if (el.dataset.act === 'pv-oper') { S.pvOper = el.value; render({ foco: '[data-act="pv-oper"]' }); }
  if (['vt-ciudad', 'vt-doc', 'vt-alerta'].includes(el.dataset.act)) { S[{ 'vt-ciudad': 'vtCiudad', 'vt-doc': 'vtDoc', 'vt-alerta': 'vtAlerta' }[el.dataset.act]] = el.value; render({ foco: `[data-act="${el.dataset.act}"]` }); }
  if (el.dataset.act === 'maq-asignar' && el.value) { const er = MD.asignar(el.dataset.kit, el.dataset.pos, el.value); render(); toast(er || 'Unidad asignada al kit.'); }
  if (el.dataset.act === 'solo-destacadas') { S.soloDestacadas = el.checked; render({ foco: '[data-act="solo-destacadas"]' }); }
});
/* Búsqueda de repuestos: se filtra al escribir, conservando el foco y el cursor. */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.act === 'vt-busca') {
    S.vtBusca = el.value; const p = el.selectionStart;
    render({ foco: '[data-act="vt-busca"]' });
    const n = document.querySelector('[data-act="vt-busca"]'); if (n) n.setSelectionRange(p, p); return;
  }
  if (el.dataset.act !== 'rep-busca') return;
  S.repBusca = el.value; const pos = el.selectionStart;
  render({ foco: '[data-act="rep-busca"]' });
  const n = document.querySelector('[data-act="rep-busca"]'); if (n) n.setSelectionRange(pos, pos);
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

/* ── Guardado compartido (Supabase): envía solos los cambios y recibe los de los demás ── */
const PREF = 'ccs-infraestructura-v2:';
const COLECCIONES_NUBE = [
  ['proyectos', 'proyectos', 'mapa'], ['tareas', 'tareas', 'lista'], ['kanban', 'kanban-macroobjetivos', 'mapa'], ['resultados', 'resultados', 'mapa'],
  ['eliminadas', 'tareas-eliminadas', 'lista', x => x && x.tarea && x.tarea.id],
  ['ventas', 'maq-ventas', 'lista'], ['evidencias', 'maq-evidencias', 'lista'], ['evid-sin-clasificar', 'maq-evid-sin-clasificar', 'lista'],
  ['ventas-importacion', 'maq-ventas-importacion', 'unico'], ['talleres', 'maq-talleres', 'lista'], ['instalaciones', 'maq-instalaciones', 'lista'],
  ['servicios', 'maq-servicios', 'lista'], ['operacion', 'maq-operacion', 'lista'], ['complementos', 'maq-complementos', 'mapa'],
  ['soportes', 'maq-soportes', 'lista'], ['kits', 'maq-kits', 'lista'], ['kits-sembrados', 'maq-kits-sembrados', 'unico'], ['rep-datos', 'rep-datos', 'mapa']
].map(([col, k, forma, idDe]) => ({ col, key: PREF + k, forma, idDe }));
/* Al llegar cambios de otra persona: se recargan los datos en memoria y se repinta sin perder el foco. */
let repintadoRemoto = null;
function recibirCambiosNube() {
  inicios = almacen.proyectos(); tareas = almacen.tareas(); resultados = almacen.resultados(); tableroMem = null;
  clearTimeout(repintadoRemoto);
  repintadoRemoto = setTimeout(() => {
    const a = document.activeElement;
    // Si alguien está escribiendo en la página, se espera a que termine para no interrumpirle.
    if (a && $('#contenido').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { a.addEventListener('blur', recibirCambiosNube, { once: true }); return; }
    render();
  }, 250);
}
NUBE.iniciar({ app: 'infra', prefijo: PREF, colecciones: COLECCIONES_NUBE, alRecibir: recibirCambiosNube });
NUBEUI.montar({ proyectos: 'Inicio de proyecto', tareas: 'Tarea', kanban: 'Kanban general', resultados: 'Resultados', eliminadas: 'Tarea eliminada', ventas: 'Venta',
  evidencias: 'Evidencia', 'evid-sin-clasificar': 'Archivo sin clasificar', 'ventas-importacion': 'Importación', talleres: 'Taller', instalaciones: 'Equipo entregado',
  servicios: 'Servicio', operacion: 'Equipo en operación', complementos: 'Ficha de máquina', soportes: 'Soporte', kits: 'Kit', 'kits-sembrados': 'Kits propuestos', 'rep-datos': 'Repuesto' });
/* Al conectarse la base compartida (o al completarse la carga inicial) se repinta para mostrar el estado correcto. */
{ let previo = ''; NUBE.alCambiar(s => { const k = s.fase + '|' + s.nubeVacia; if (k !== previo) { previo = k; if (leerRuta().vista === 'maquinas') render(); } }); }
