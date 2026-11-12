/* Dashboard de Manufactura (Neotropya): enrutador, estado, eventos y navegación.
   Objetivos → objetivo asociado → proyecto (Inicio / Kanban) → tareas.
   Datos: datos.js, datos-proyectos.js · HTML: componentes.js, proyecto.js · Rutas: rutas.js ·
   Almacenamiento aislado: almacen.js · Estilos: css/prototipo.css */
import { DIVISION, SECCIONES, MACROOBJETIVOS, OBJETIVOS, RECURSOS, RECURRENTES } from './datos.js';
import { almacen, normProyecto, normTarea } from './almacen.js';
import * as C from './componentes.js';
import * as P from './proyecto.js';
import * as KM from './kanban-macro.js';
import { leerRuta, rutaProyecto, rutaMacro, rutaObjetivo } from './rutas.js';
import { FUENTES, RESULTADOS } from './resultados.js';

/* Resultados de investigación: cada archivo fuente se lee una vez (copia local) y se vuelve a pintar al llegar. */
const cacheFuentes = {};
function estadoFuente(id) {
  if (!cacheFuentes[id]) {
    cacheFuentes[id] = { estado: 'cargando' };
    fetch(FUENTES[id].archivo, { cache: 'no-store' }).then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(d => { cacheFuentes[id] = { estado: 'ok', datos: d }; }).catch(e => { cacheFuentes[id] = { estado: 'error', error: e.message }; })
      .finally(() => { if (ctx.ruta.vista === 'proyecto') render(); });
  }
  return cacheFuentes[id];
}

const $ = s => document.querySelector(s);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esMovil = () => window.matchMedia('(max-width: 900px)').matches;
const macroIds = new Set(MACROOBJETIVOS.map(m => m.id));
const macroDe = oid => MACROOBJETIVOS.find(m => m.id === OBJETIVOS[oid].macro);
const ahora = () => new Date().toISOString();
const uid = p => p + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));

/* ── Datos y estado ── */
let proyectos = almacen.proyectos(), tareas = almacen.tareas();
const S = {};
function cargarEstado() {
  const p = almacen.prefs();
  S.vista = p.vista === 'tarjetas' ? 'tarjetas' : 'filas';
  S.abiertos = new Set((Array.isArray(p.abiertos) ? p.abiertos : []).filter(id => macroIds.has(id)));
  S.indice = p.indice !== false;
  S.activo = macroIds.has(p.activo) ? p.activo : null;
  S.sbSec = p.sbSec && typeof p.sbSec === 'object' && !Array.isArray(p.sbSec) ? Object.fromEntries(Object.entries(p.sbSec).filter(([, v]) => typeof v === 'boolean')) : {};
  S.soloDestacadas = !!p.soloDestacadas;
}
const guardarPrefs = () => almacen.guardarPrefs({ vista: S.vista, abiertos: [...S.abiertos], indice: S.indice, activo: S.activo,
  sbSec: S.sbSec, soloDestacadas: S.soloDestacadas });
const guardarTareas = () => { if (!almacen.guardarTareas(tareas)) toast('No se pudo guardar en este navegador.'); };
const guardarProyectos = () => { if (!almacen.guardarProyectos(proyectos)) toast('No se pudo guardar en este navegador.'); };

const ctx = {
  objetivos: OBJETIVOS, recursos: RECURSOS, recurrentes: RECURRENTES, macros: MACROOBJETIVOS, nuevo: null, ruta: leerRuta(),
  get proyectos() { return proyectos; },
  proyectosDe: oid => proyectos.filter(p => p.objetivos.includes(oid)),
  tareasDe: pid => tareas.filter(t => t.proyecto === pid),
  resultadoDe: pid => { const r = RESULTADOS[pid] || null; return { r, estado: r ? estadoFuente(r.fuente) : null }; }
};
const proyectoPorSlug = slug => proyectos.find(p => p.slug === slug);
const tareaPorId = id => tareas.find(t => t.id === id);
const log = (t, tipo, nota) => t.historial.push({ fecha: ahora(), tipo, nota });

/* ── Render (conserva el foco en el control equivalente) ── */
function claveFoco(el) {
  if (!el || !el.dataset || !el.dataset.act) return null;
  return ['act', 'macro', 'ob', 'vista', 'tk', 'pr'].filter(k => el.dataset[k]).map(k => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('');
}
function render({ foco } = {}) {
  const prev = foco === undefined ? claveFoco(document.activeElement) : foco;
  const r = ctx.ruta = leerRuta();
  let html = '', p = null;
  if (r.vista === 'proyecto') {
    p = proyectoPorSlug(r.slug);
    // Un proyecto se abre por /proyectos y una investigación por /investigaciones; las investigaciones no tienen Kanban.
    if (p && (p.tipo === 'investigacion') !== (r.seccion === 'investigaciones')) { location.replace(rutaProyecto(p, r.pagina, r.desde)); return; }
    if (p) { if (p.tipo === 'investigacion' && r.pagina === 'kanban') r.pagina = 'inicio'; if (r.desde && !p.objetivos.includes(r.desde)) r.desde = ''; }
  }
  // Segunda etapa: portada de sección o módulo integrado (Nodos Venezuela, Inventarios, Presupuestos).
  const sec = (r.vista === 'seccion' || r.vista === 'modulo') ? SECCIONES.find(s => s.id === r.seccion) : null;
  const hijo = sec && r.vista === 'modulo' ? sec.hijos.find(h => h.id === r.hijo) : null;
  // (la sección actual se despliega al llegar a la página, en alCambiarRuta; después se puede plegar)
  $('#sidebar').innerHTML = C.sidebarHtml(S, MACROOBJETIVOS, ctx);
  const cont = $('#contenido');
  cont.classList.toggle('es-modulo', !!hijo);
  if (hijo) {
    document.title = `${hijo.titulo} · ${sec.titulo} · ${DIVISION.nombre}`;
    // El módulo se conserva mientras siga siendo el mismo (no se recarga al plegar la sidebar, por ejemplo).
    if (!cont.querySelector(`iframe[data-mod="${CSS.escape(hijo.modulo)}"]`)) { cont.innerHTML = C.moduloHtml(sec, hijo); ajustarMarco(); }
    if (prev) { const el = document.querySelector(prev); if (el) el.focus({ preventScroll: true }); }
    guardarPrefs(); return;
  }
  if (sec && r.vista === 'seccion') html = C.seccionHtml(sec);
  else if (r.vista === 'modulo') html = `${C.migasHtml([{ t: DIVISION.nombre }, { t: sec ? sec.titulo : 'Sección' }, { t: 'No encontrado' }])}<header class="pg-head"><h1 id="pg-titulo" tabindex="-1">Módulo no encontrado</h1></header>`;
  else if (r.vista === 'objetivos') html = C.encabezadoHtml(S, MACROOBJETIVOS, OBJETIVOS) + `<ol class="mo-list vista-${S.vista}" aria-label="Macroobjetivos">${MACROOBJETIVOS.map(m => C.macroHtml(m, S, ctx)).join('')}</ol>`;
  else if (r.vista === 'kanban') html = KM.tableroHtml(ctx, tablero(), !!leerLegado());
  else if (r.vista === 'proyectos') html = P.listaHtml(ctx, 'proyecto');
  else if (r.vista === 'investigaciones') html = P.listaHtml(ctx, 'investigacion');
  else if (!p) html = `${C.migasHtml([{ t: DIVISION.nombre }, { t: 'Proyectos', href: '#/proyectos' }, { t: 'No encontrado' }])}<header class="pg-head"><h1 id="pg-titulo" tabindex="-1">Proyecto no encontrado</h1><p class="pg-intro"><a href="#/proyectos">Volver a Proyectos</a></p></header>`;
  else html = r.pagina === 'kanban' ? P.kanbanHtml(p, r.desde, ctx, S) : r.pagina === 'resultados' ? P.resultadosPaginaHtml(p, r.desde, ctx) : P.inicioHtml(p, r.desde, ctx);
  const abiertos = new Set([...document.querySelectorAll('#contenido details[data-keep][open]')].map(d => d.dataset.keep));   // desplegables abiertos se conservan
  $('#contenido').innerHTML = html;
  document.querySelectorAll('#contenido details[data-keep]').forEach(d => { if (abiertos.has(d.dataset.keep)) d.open = true; });
  document.title = `${sec ? sec.titulo : r.vista === 'objetivos' ? 'Objetivos' : r.vista === 'kanban' ? 'Kanban' : r.vista === 'proyectos' ? 'Proyectos' : r.vista === 'investigaciones' ? 'Investigaciones' : p ? `${r.pagina === 'kanban' ? 'Kanban' : r.pagina === 'resultados' ? 'Resultados' : 'Inicio'} · ${p.nombre}` : 'No encontrado'} · ${DIVISION.nombre}`;
  ctx.nuevo = null;
  if (prev) { const el = document.querySelector(prev); if (el) el.focus({ preventScroll: true }); }
  if (r.vista === 'kanban' || (r.vista === 'proyecto' && r.pagina === 'kanban')) bindDrag();
  guardarPrefs();
}

/* Cambio de ruta: pantalla nueva desde arriba, foco en su título; los parámetros de un solo uso se consumen. */
function alCambiarRuta() {
  cerrarMenu(false); cerrarResultados();
  if (dlg.open) { dlgRetorno = null; dlg.close(); }
  if (panel.open) panel.close();
  const r = leerRuta();
  // Al llegar a un proyecto, investigación o módulo, su sección de la sidebar se despliega (luego se puede plegar).
  if (r.seccion) S.sbSec[r.seccion] = true;
  render({ foco: null });
  if (r.vista === 'objetivos' && (r.macro || r.objetivo)) {
    history.replaceState(null, '', '#/objetivos');
    if (r.objetivo && OBJETIVOS[r.objetivo]) irObjetivo(r.objetivo); else if (macroIds.has(r.macro)) irMacro(r.macro);
    return;
  }
  window.scrollTo(0, 0);
  const h = $('#pg-titulo'); h && h.focus({ preventScroll: true });
  if (r.vista === 'proyecto' && r.tarea) {
    const t = tareaPorId(r.tarea); const p = proyectoPorSlug(r.slug);
    history.replaceState(null, '', rutaProyecto(p || { slug: r.slug }, r.pagina, r.desde));
    if (t && p && t.proyecto === p.id) { render({ foco: null }); const el = document.querySelector(`li[data-tk="${t.id}"]`); if (el) irA(el, { focus: false, block: 'center' }); formTarea(t); }
  }
}
window.addEventListener('hashchange', alCambiarRuta);

function irA(el, { focus = true, block = 'start' } = {}) {
  if (!el) return;
  el.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block });
  // Si el navegador interrumpe el desplazamiento suave, se completa sin animación.
  setTimeout(() => { const r = el.getBoundingClientRect(); if (el.isConnected && (r.top < 0 || r.top > window.innerHeight - 60)) el.scrollIntoView({ block }); }, 900);
  if (focus) { if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName)) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
  el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
  setTimeout(() => el.classList.remove('is-flash'), 1800);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 3200);
}

/* ── Objetivos ── */
function abrirMacro(id) { if (!S.abiertos.has(id)) ctx.nuevo = id; S.abiertos.add(id); S.activo = id; }
function irMacro(id) {
  if (ctx.ruta.vista !== 'objetivos') { location.hash = rutaMacro(id); return; }
  abrirMacro(id); cerrarMenu(false); render({ foco: null });
  irA(document.querySelector(`[data-act="toggle-macro"][data-macro="${id}"]`), { block: 'start' });
}
function irObjetivo(oid) {
  const o = OBJETIVOS[oid]; if (!o) return;
  abrirMacro(o.macro); cerrarMenu(false); render({ foco: null });
  irA(document.getElementById(`${oid}-bloque`), { block: 'center' });
}

/* ── Ventanas: dlg (formularios) y dlg2 (confirmaciones de estado, encima de dlg) ── */
const dlg = $('#dlg'), dlg2 = $('#dlg2'), panel = $('#panel');
let dlgRetorno = null;
function abrirDialogo(d, html, retorno) {
  if (d === dlg) dlgRetorno = retorno === undefined ? claveFoco(document.activeElement) : retorno;
  d.innerHTML = html; d.showModal();
  const f = d.querySelector('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select, [data-dlg-ok]'); f && f.focus();
}
dlg.addEventListener('close', () => { const el = dlgRetorno && document.querySelector(dlgRetorno); if (el) el.focus({ preventScroll: true }); dlgRetorno = null; });
[dlg, dlg2].forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-dlg-close]')) d.close('cancel'); }));

function confirmar(titulo, cuerpo, accion, alAceptar) {
  abrirDialogo(dlg, C.confirmHtml(titulo, cuerpo, accion));
  dlg.querySelector('[data-dlg-ok]').addEventListener('click', () => { dlgRetorno = null; dlg.close(); alAceptar(); });
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
  log(t, 'estado', `${P.colTitulo(de)} → ${P.colTitulo(a)}.`);
  t.estado = a;
  t.orden = Math.max(0, ...tareas.filter(x => x.proyecto === t.proyecto && x.estado === a && x !== t).map(x => x.orden)) + 1;
}
async function moverTarea(id, a) {
  const t = tareaPorId(id); if (!t || t.estado === a) { render(); return; }
  const datos = await pedirTransicion(t, a);
  if (!datos) { render({ foco: `#st-${CSS.escape(id)}` }); toast('Cambio de estado cancelado.'); return; }
  aplicarEstado(t, a, datos); guardarTareas(); render({ foco: `#st-${CSS.escape(id)}` });
  toast(`«${t.titulo}» → ${P.colTitulo(a)}.`);
}

/* ── Formulario de tarea (crear o editar) ── */
function formTarea(t0, pid) {
  const nueva = !t0;
  const t = nueva ? normTarea({ id: uid('tk'), proyecto: pid, titulo: '', estado: 'todo' }) : normTarea(JSON.parse(JSON.stringify(t0)));
  abrirDialogo(dlg, P.formTareaHtml(t, ctx, nueva), nueva ? `[data-act="nueva-tarea"][data-pr="${pid}"]` : `[data-act="abrir-tarea"][data-tk="${t.id}"]`);
  const form = dlg.querySelector('form'), selEstado = form.querySelector('[data-estado]'), trans = form.querySelector('[data-trans]');
  let pendiente = null, estadoForm = t.estado;   // datos recogidos al elegir Blocked o Completed
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
  form.addEventListener('change', async e => {
    const el = e.target;
    if (el.dataset.sub === 'toggle') t.subtareas[Number(el.dataset.i)].hecha = el.checked;
    if (el.dataset.depto) el.closest('.depto').querySelector('.depto-det').hidden = !el.checked;
    if (el === selEstado) {
      const a = el.value;
      if (a === 'blocked' || a === 'completed') {
        const datos = await pedirTransicion({ ...t, estado: estadoForm }, a);
        if (!datos) { el.value = estadoForm; el.focus(); return; }
        pendiente = datos;
        if (a === 'blocked') { bloqueoCampos(true); form.elements.bloqueoMotivo.value = datos.motivo; form.elements.bloqueoNecesita.value = datos.necesita; }
      } else pendiente = null;
      if (a !== 'blocked') bloqueoCampos(false);
      estadoForm = a;
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
    if (malo) { errEnl.hidden = false; errEnl.textContent = `Los enlaces deben empezar por https:// (revisa «${malo}»).`; form.elements.enlaces.focus(); return; }
    if (estadoForm === 'blocked' && (!g('bloqueoMotivo') || !g('bloqueoNecesita'))) { form.elements[g('bloqueoMotivo') ? 'bloqueoNecesita' : 'bloqueoMotivo'].focus(); trans.textContent = 'Una tarea bloqueada necesita motivo y qué se necesita para continuar.'; return; }
    const deptos = [...form.querySelectorAll('input[name="tdepto"]:checked')].map(c => ({ id: c.value, detalle: g(`tdepto-${c.value}`) }));
    const destino = nueva ? t : tareaPorId(t.id);
    const antes = JSON.stringify([destino.titulo, destino.descripcion, destino.criterio, destino.prioridad, destino.responsable, destino.fecha, destino.destacada]);
    Object.assign(destino, normTarea({ ...destino, titulo: g('titulo'), descripcion: g('descripcion'), criterio: g('criterio'), prioridad: g('prioridad'), responsable: g('responsable'), fecha: g('fecha'),
      destacada: form.elements.destacada.checked, subtareas: t.subtareas, departamentos: deptos, notas: g('notas'), enlaces, evidencias: g('evidencias') }), { historial: destino.historial, orden: destino.orden });
    if (nueva) { destino.historial = [{ fecha: ahora(), tipo: 'creada', nota: 'Tarea creada.' }]; destino.orden = Math.max(0, ...tareas.filter(x => x.proyecto === pid && x.estado === 'todo').map(x => x.orden)) + 1; tareas.push(destino); }
    else log(destino, 'edicion', JSON.stringify([destino.titulo, destino.descripcion, destino.criterio, destino.prioridad, destino.responsable, destino.fecha, destino.destacada]) !== antes ? 'Datos editados (título, criterio, prioridad, responsable, fecha o énfasis).' : 'Datos editados.');
    if (estadoForm !== destino.estado) aplicarEstado(destino, estadoForm, estadoForm === 'blocked' ? { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') } : pendiente || {});
    else if (destino.estado === 'blocked') destino.bloqueo = { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') };
    guardarTareas(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="abrir-tarea"][data-tk="${destino.id}"]` });
    toast(nueva ? 'Tarea creada.' : 'Tarea guardada.');
  });
}

/* ── Formulario del proyecto (datos de Inicio) ── */
function formProyecto(p) {
  abrirDialogo(dlg, P.formProyectoHtml(p));
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
    const i = proyectos.findIndex(x => x.id === p.id);
    proyectos[i] = normProyecto({ ...p, descripcion: g('descripcion'), resultado: g('resultado'), prioridad: g('prioridad'), entrega: g('entrega'), departamentos: { relacion, lista } });
    guardarProyectos(); dlgRetorno = null; dlg.close(); render({ foco: `[data-act="editar-proyecto"][data-pr="${p.id}"]` }); toast('Datos del proyecto guardados.');
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

/* ── Eventos ── */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || dlg.contains(b) || dlg2.contains(b) || panel.contains(b) || b.tagName === 'SELECT' || b.type === 'checkbox') return;
  const { act, macro, ob, tk, pr } = b.dataset;
  switch (act) {
    case 'toggle-macro': if (S.abiertos.has(macro)) S.abiertos.delete(macro); else abrirMacro(macro); render(); break;
    case 'ir-macro': irMacro(macro); break;
    case 'ir-objetivo': irObjetivo(ob); break;
    case 'expandir': MACROOBJETIVOS.forEach(m => S.abiertos.add(m.id)); render(); toast('Macroobjetivos expandidos.'); break;
    case 'contraer': S.abiertos.clear(); render(); toast('Macroobjetivos contraídos.'); break;
    case 'vista': S.vista = b.dataset.vista; render(); break;
    case 'toggle-indice': S.indice = !S.indice; render(); break;
    case 'respaldo-legado': descargarLegado(); break;
    case 'abrir-mk': abrirPanel(b.dataset.mk); break;
    case 'editar-mk': formMacro(b.dataset.mk); break;
    case 'toggle-seccion': S.sbSec[b.dataset.sec] = S.sbSec[b.dataset.sec] === false; render(); break;
    case 'abrir-tarea': formTarea(tareaPorId(tk)); break;
    case 'nueva-tarea': formTarea(null, pr); break;
    case 'estrella': {
      const t = tareaPorId(tk); if (!t) break;
      t.destacada = !t.destacada; log(t, 'enfasis', t.destacada ? 'Marcada como destacada (especial énfasis).' : 'Se retiró el énfasis.');
      guardarTareas(); render(); toast(t.destacada ? 'Tarea destacada.' : 'Énfasis retirado.'); break;
    }
    case 'editar-proyecto': formProyecto(proyectos.find(x => x.id === pr)); break;
    case 'restablecer':
      confirmar('Restablecer datos', `<p>Se borrarán los datos de este dashboard guardados en este navegador (prefijo «${C.esc(almacen.prefijo)}»): preferencias, datos de proyectos e investigaciones, sus tareas y las tarjetas del Kanban. Se vuelven a cargar los datos iniciales.</p><p>Presupuestos no se borra.</p>
        <p>No afecta al dashboard publicado, a los Kanban del sitio ni a ningún otro dato.</p>`, 'Restablecer', () => {
        almacen.restablecer(); proyectos = almacen.proyectos(); tareas = almacen.tareas(); tableroMem = null; cargarEstado();
        $('#contenido').innerHTML = '';   // un módulo integrado abierto se vuelve a cargar con sus datos iniciales
        render({ foco: '#pg-titulo' }); toast('Datos restablecidos.');
      });
      break;
  }
});
document.addEventListener('change', e => {
  const el = e.target; if (dlg.contains(el) || dlg2.contains(el) || panel.contains(el)) return;
  if (el.dataset.act === 'estado-mk') moverMacro(el.dataset.mk, el.value);
  if (el.dataset.act === 'estado') moverTarea(el.dataset.tk, el.value);
  if (el.dataset.act === 'solo-destacadas') { S.soloDestacadas = el.checked; render({ foco: '[data-act="solo-destacadas"]' }); }
});

/* ── Búsqueda (contenido del dashboard: macroobjetivos, objetivos, proyectos y tareas) ── */
const q = $('#q'), lista = $('#sr-list');
let resultados = [], activo = -1;
const indiceBusqueda = () => [
  ...MACROOBJETIVOS.map(m => ({ tipo: 'macro', id: m.id, titulo: m.titulo, ruta: DIVISION.nombre, texto: fold(`${m.numero} ${m.titulo} ${m.corto} ${m.proposito}`) })),
  ...Object.values(OBJETIVOS).map(o => { const m = macroDe(o.id); return { tipo: 'objetivo', id: o.id, titulo: o.nombre, ruta: `${DIVISION.nombre} › ${m.numero} ${m.corto}`, texto: fold(`${o.nombre} ${o.descripcion}`) }; }),
  ...proyectos.map(p => ({ tipo: p.tipo === 'investigacion' ? 'investigacion' : 'proyecto', id: p.id, titulo: p.nombre, ruta: `${DIVISION.nombre} › ${p.tipo === 'investigacion' ? 'Investigaciones' : 'Proyectos'}`, texto: fold(`${p.nombre} ${p.descripcion}`) })),
  ...tareas.map(t => { const p = proyectos.find(x => x.id === t.proyecto); return { tipo: 'tarea', id: t.id, titulo: t.titulo, ruta: `${p ? p.nombre : 'Proyecto'} › ${p && p.tipo === 'investigacion' ? 'Tareas' : 'Kanban'} · ${P.colTitulo(t.estado)}`, texto: fold(`${t.titulo} ${t.descripcion}`) }; })
];
function buscar() {
  const tt = fold(q.value).trim().split(/\s+/).filter(Boolean);
  if (!tt.length) { cerrarResultados(); return; }
  resultados = indiceBusqueda().filter(x => tt.every(w => x.texto.includes(w))).slice(0, 12);
  activo = resultados.length ? 0 : -1; pintarResultados();
}
function pintarResultados() {
  lista.innerHTML = C.resultadosHtml(resultados, activo);
  lista.hidden = false; q.setAttribute('aria-expanded', 'true');
  q.setAttribute('aria-activedescendant', activo >= 0 ? `sr-${activo}` : '');
  const el = lista.querySelector('.is-active'); el && el.scrollIntoView({ block: 'nearest' });
}
function cerrarResultados() { lista.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); }
function elegir(i) {
  const r = resultados[i]; if (!r) return;
  cerrarResultados();
  if (r.tipo === 'macro') irMacro(r.id);
  else if (r.tipo === 'objetivo') { if (ctx.ruta.vista === 'objetivos') irObjetivo(r.id); else location.hash = rutaObjetivo(r.id); }
  else if (r.tipo === 'proyecto' || r.tipo === 'investigacion') location.hash = rutaProyecto(proyectos.find(p => p.id === r.id), 'inicio');
  else { const t = tareaPorId(r.id), p = proyectos.find(x => x.id === t.proyecto); location.hash = rutaProyecto(p, 'kanban', '', `tarea=${t.id}`); }
}
q.addEventListener('input', buscar);
q.addEventListener('focus', () => { if (q.value.trim()) buscar(); });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (lista.hidden) { buscar(); return; }
    e.preventDefault(); if (!resultados.length) return;
    activo = (activo + (e.key === 'ArrowDown' ? 1 : -1) + resultados.length) % resultados.length; pintarResultados();
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open') && !dlg.open && !dlg2.open) cerrarMenu(); });
window.matchMedia('(max-width: 900px)').addEventListener('change', () => { if (!esMovil()) cerrarMenu(false); });

/* Datos del Kanban anterior de Neotropya (clave del dashboard previo, mismo sitio). Solo se leen para descargarlos. */
const CLAVE_LEGADO = 'ccs-neotropya-kanban-v1';
function leerLegado() { try { return localStorage.getItem(CLAVE_LEGADO); } catch { return null; } }
function descargarLegado() {
  const raw = leerLegado(); if (!raw) { toast('No hay datos del Kanban anterior en este navegador.'); return; }
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `kanban-neotropya-anterior-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Respaldo del Kanban anterior descargado.');
}

/* ── Kanban general: una tarjeta por macroobjetivo ── */
let tableroMem = null;
function tablero() {
  if (!tableroMem) { const r = KM.asegurarTablero(almacen.kanban(), MACROOBJETIVOS); tableroMem = r.tablero; if (r.cambio) almacen.guardarKanban(tableroMem); }
  return tableroMem;
}
const guardarTablero = () => { if (!almacen.guardarKanban(tableroMem)) toast('No se pudo guardar en este navegador.'); };
const logMk = (k, nota) => k.historial.push({ fecha: ahora(), nota });
const tarjetaComoTarea = (m, k) => ({ titulo: m.titulo, estado: k.estado, bloqueo: k.bloqueo, cierre: k.cierre, criterio: m.resultado || '' });

/* Panel de navegación (clic en la tarjeta): objetivos asociados y enlaces a su desarrollo. */
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
  if (a === 'completed') logMk(k, `Completada. Resultado esperado confirmado.${datos.nota ? ` ${datos.nota}` : ''}`);
  logMk(k, `${P.colTitulo(de)} → ${P.colTitulo(a)}.`);
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
    estadoForm = a; trans.textContent = a === k.estado ? '' : `Al guardar, la tarjeta pasará a ${P.colTitulo(a)}.`; sel.focus();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const g = n => String(form.elements[n] ? form.elements[n].value : '').trim();
    if (estadoForm === 'blocked' && (!g('bloqueoMotivo') || !g('bloqueoNecesita'))) { trans.textContent = 'Una tarjeta bloqueada necesita motivo y qué se necesita para continuar.'; form.elements[g('bloqueoMotivo') ? 'bloqueoNecesita' : 'bloqueoMotivo'].focus(); return; }
    Object.assign(k, KM.normTarjeta({ ...k, responsable: g('responsable'), prioridad: g('prioridad'), fecha: g('fecha'), notas: g('notas') }), { historial: k.historial, orden: k.orden });
    logMk(k, 'Datos de la tarjeta editados.');
    if (estadoForm !== k.estado) aplicarEstadoMacro(m, k, estadoForm, estadoForm === 'blocked' ? { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') } : pendiente || {});
    else if (k.estado === 'blocked') k.bloqueo = { motivo: g('bloqueoMotivo'), necesita: g('bloqueoNecesita') };
    guardarTablero(); dlg.close(); render(); refrescarPanel(); toast('Tarjeta guardada.');
  });
}

/* ── Inicio ── */
cargarEstado();
if (!location.hash || location.hash === '#' || location.hash === '#objetivos') history.replaceState(null, '', '#/objetivos');
alCambiarRuta();

/* Alto del marco de los módulos integrados: ocupa la ventana disponible y tiene su propio desplazamiento. */
function ajustarMarco() {
  const f = document.querySelector('.mod-frame'); if (!f) return;
  f.style.height = Math.max(420, window.innerHeight - f.getBoundingClientRect().top - window.scrollY) + 'px';
}
window.addEventListener('resize', ajustarMarco);
