/* Mantenimiento · vistas (Etapa 2: Máquinas del taller y fichas).
   Lo desconocido se muestra como pendiente; nada se completa por suposición. */
import { esc, plural, migasHtml } from './componentes.js';
import { AREA, REGISTROS } from './datos.js';
import { rutaRegistro } from './rutas.js';
import * as MT from './mant-datos.js';

/* Preventivos: desactivados por decisión de Cristian (16/11/2026) hasta contar con información suficiente para
   definir la gestión de la actividad. El código queda listo para reactivarlo cambiando este valor. */
export const PREVENTIVOS_ACTIVOS = false;
export const VENTANAS_MANT = [
  { id: 'resumen', titulo: 'Resumen', ruta: '#/mantenimiento' },
  { id: 'maquinas', titulo: 'Máquinas del taller', ruta: '#/mantenimiento/maquinas' },
  { id: 'trabajos', titulo: 'Mantenimientos', ruta: '#/mantenimiento/trabajos' }
];
const pend = (t = 'Pendiente') => `<span class="mq-pend">${esc(t)}</span>`;
const val = (x, t = 'Pendiente') => (x ? esc(x) : pend(t));
const fd = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const fdt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const fila = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
const chipCond = c => `<span class="mq-chip mt-cond mt-cond-${{ 'Operativa': 'ok', 'Operativa con restricciones': 'rest', 'Fuera de servicio': 'fuera', 'Pendiente de verificar': 'pend' }[c] || 'pend'}">${esc(c)}</span>`;
const chipPrio = s => `<span class="mq-chip ${s.prioridad === '3' ? 'c-falta' : 'c-otra'}">Prioridad ${esc(s.prioridadTxt.toLowerCase())}</span>`;

export function cabeceraMant(ventana) {
  const v = VENTANAS_MANT.find(x => x.id === ventana);
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: 'Mantenimiento', href: ventana === 'resumen' ? '' : '#/mantenimiento' }, ...(ventana === 'resumen' ? [] : [{ t: v.titulo }])].filter(x => x.t))}
    <header class="pj-head ficha-head mq-head">
      <p class="pg-kicker">${esc(AREA.nombre)} · Máquinas del taller</p>
      <h1 id="pg-titulo" tabindex="-1">${ventana === 'resumen' ? 'Mantenimiento' : esc(v.titulo)}</h1>
      <nav class="pj-tabs mq-tabs" aria-label="Ventanas de Mantenimiento">${VENTANAS_MANT.map(x => `<a href="${x.ruta}" ${x.id === ventana ? 'aria-current="page"' : ''}>${esc(x.titulo)}</a>`).join('')}</nav>
    </header>${fuenteHtml()}`;
}
/* La fuente se declara siempre: es una captura fechada, no una conexión en vivo. */
function fuenteHtml() {
  const f = MT.T.fuente;
  if (MT.T.estado === 'error') return `<p class="aviso err">No se pudo leer la captura de Odoo: ${esc(MT.T.error)}</p>`;
  if (!f) return '<p class="nota">Cargando la captura de Odoo…</p>';
  return `<p class="mt-fuente"><b>Datos de Odoo al ${esc(fdt(f.capturado))}</b> · captura de consulta con la cuenta de ${esc(f.cuenta)}. No es una conexión en vivo; el registro original sigue en Odoo.</p>`;
}

/* Ventanas que llegan en etapas posteriores: estado honesto, sin cifras. */
export function enConstruccionHtml(ventana, etapa, texto) {
  return `${cabeceraMant(ventana)}<section class="pj-sec mq-vacio"><h2>Se construye en la Etapa ${etapa}</h2><p>${esc(texto)}</p>
    <p><a class="btn btn-sm" href="#/mantenimiento/maquinas">Ver Máquinas del taller</a></p></section>`;
}

/* ── Máquinas del taller ── */
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function maquinasFiltradas(S) {
  const tt = fold(S.mtBusca).trim().split(/\s+/).filter(Boolean);
  return MT.maquinas().filter(e => (!S.mtCat || e.categoria === S.mtCat) && (!S.mtCond || MT.condicionActual(e).condicion === S.mtCond)
    && (!tt.length || tt.every(w => fold([e.codigo, e.nombreCorto, e.categoria, e.serial, e.modelo, e.proveedor, e.ubicacion].join(' ')).includes(w))))
    .sort((a, b) => (a.codigo || 'ZZ').localeCompare(b.codigo || 'ZZ', 'es', { numeric: true }));
}
export function maquinasHtml(S) {
  if (MT.T.estado !== 'listo') return `${cabeceraMant('maquinas')}<p class="vacio">${MT.T.estado === 'error' ? 'Sin datos.' : 'Cargando…'}</p>`;
  const todas = MT.maquinas(), lista = maquinasFiltradas(S), filtrado = !!(S.mtCat || S.mtCond || String(S.mtBusca || '').trim());
  const vista = S.mtVista === 'tabla' ? 'tabla' : 'tarjetas';
  return `${cabeceraMant('maquinas')}
    <p class="nota mt-alcance" aria-live="polite">${filtrado ? `<b>Mostrando ${lista.length} de ${plural(todas.length, 'máquina', 'máquinas')}.</b>` : `<b>${plural(todas.length, 'máquina censada', 'máquinas censadas')} en Odoo.</b>`} Los registros generales de Odoo se listan aparte y no cuentan como máquinas.</p>
    <div class="mq-barra">
      <label class="mq-filtro"><span class="sr-only">Buscar máquina</span><input type="search" data-act="mt-busca" value="${esc(S.mtBusca || '')}" placeholder="Código, nombre, serial, modelo…" autocomplete="off"></label>
      <label class="mq-filtro"><span class="sr-only">Categoría</span><select data-act="mt-cat"><option value="">Todas las categorías</option>${MT.categorias().map(c => `<option ${c === S.mtCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Condición</span><select data-act="mt-cond"><option value="">Cualquier condición</option>${MT.CONDICIONES.map(c => `<option ${c === S.mtCond ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${filtrado ? '<button type="button" class="btn btn-sm btn-ghost" data-act="mt-limpiar">Quitar filtros</button>' : ''}
      <span class="sp"></span>
      <div class="seg" role="group" aria-label="Vista">${[['tarjetas', 'Tarjetas'], ['tabla', 'Tabla']].map(([x, t]) => `<button type="button" data-act="mt-vista" data-vista="${x}" aria-pressed="${vista === x}">${t}</button>`).join('')}</div>
    </div>
    ${!lista.length ? '<p class="vacio">Ninguna máquina coincide con la búsqueda o los filtros.</p>' : vista === 'tabla' ? tablaMaq(lista) : tarjetasMaq(lista)}
    ${generalesHtml()}`;
}
const abiertaTxt = e => { const s = MT.abiertaPrincipal(e); return s ? `${chipPrio(s)} ${esc(s.asunto)}${s.avisos.length ? ' <span class="mt-aviso-ico" title="Revisar: hay una inconsistencia en Odoo">⚠</span>' : ''}` : '<span class="nota">Ninguno real abierto</span>'; };
function tarjetasMaq(l) {
  return `<ul class="mq-grid mt-grid">${l.map(e => `<li class="mq-card mt-card"><div class="mq-card-body">
      <p class="mq-tipo">${esc(e.codigo || 'Sin código')} · ${esc(e.categoria)}</p>
      <h3><button type="button" class="mq-link" data-act="mt-ficha" data-eid="${esc(e.id)}">${esc(e.nombreCorto)}</button></h3>
      <dl class="vt-dl">
        <div><dt>Condición</dt><dd>${condCorta(e)}</dd></div>
        <div><dt>Ubicación</dt><dd>${ubiTxt(e)}</dd></div>
        <div><dt>Mantenimiento abierto</dt><dd>${abiertaTxt(e)}</dd></div>
        <div><dt>Responsable</dt><dd>${val(e.responsable, 'Pendiente de definir')}</dd></div>
        <div><dt>Próxima acción</dt><dd>${proxMaq(e)}</dd></div>
      </dl>
    </div></li>`).join('')}</ul>`;
}
function tablaMaq(l) {
  return `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Código</th><th>Máquina</th><th>Categoría</th><th>Ubicación</th><th>Condición</th><th>Mantenimiento abierto</th><th>Responsable</th><th>Próxima acción</th></tr></thead><tbody>
    ${l.map(e => `<tr><td>${esc(e.codigo || '—')}</td><td><button type="button" class="mq-link" data-act="mt-ficha" data-eid="${esc(e.id)}"><b>${esc(e.nombreCorto)}</b></button></td>
      <td>${esc(e.categoria)}</td><td>${ubiTxt(e)}</td><td>${condCorta(e)}</td><td>${abiertaTxt(e)}</td><td>${val(e.responsable, 'Pendiente')}</td><td>${proxMaq(e)}</td></tr>`).join('')}</tbody></table></div>`;
}
function generalesHtml() {
  const g = MT.generales(); if (!g.length) return '';
  return `<details class="mas mt-generales"><summary>Registros generales de Odoo (${g.length}) · no son máquinas</summary>
    <ul class="vt-evid">${g.map(e => `<li><b>${esc(e.nombre)}</b> <small class="nota">ID ${e.odooId} en Odoo · ${plural(MT.solicitudesDe(e).length, 'solicitud', 'solicitudes')}</small><br><small>${esc(e.motivoRegistro)}</small></li>`).join('')}</ul></details>`;
}

/* ── Ficha de la máquina ── */
const etiquetaFecha = s => `${s.fechaProgramada ? `Ejecución según Odoo: ${fd(s.fechaProgramada)}` : 'Sin fecha de ejecución'} · registrada el ${fd(s.fechaSolicitud)}${s.fechaCierre ? ` · cerrada en Odoo el ${fd(s.fechaCierre)}` : ''}`;
function solicitudItem(s) {
  return `<li class="mt-sol ${s.abierta ? 'abierta' : ''}"><details><summary><b>${esc(s.asunto)}</b> <span class="nota">· ${esc(s.etapa)} · ${esc(s.tipoTxt)} · ${esc(s.prioridadTxt)}</span></summary>
    <p class="nota">${esc(etiquetaFecha(s))}</p>
    ${s.avisos.map(a => `<p class="mt-aviso">⚠ ${esc(a)}</p>`).join('')}
    <dl class="org-dl">
      ${fila('Responsable', s.responsable ? esc(s.responsable) : `${pend('Pendiente')} <small class="nota">en Odoo: usuario genérico «${esc(s.tecnico || '—')}»</small>`)}
      ${fila('Sistema · componente', esc([s.sistema, s.componente].filter(Boolean).join(' · ')) || pend('Sin dato'))}
      ${s.falla ? fila('Falla reportada', `<span class="pre">${esc(s.falla)}</span>`) : ''}
      ${s.modoFalla ? fila('Causa (modo de falla)', `<span class="pre">${esc(s.modoFalla)}</span>`) : ''}
      ${s.accion ? fila('Intervención realizada', `<span class="pre">${esc(s.accion)}</span>`) : ''}
      ${s.descripcion ? fila('Descripción original', `<span class="pre">${esc(s.descripcion)}</span>`) : ''}
      ${s.presupuesto.length ? fila('Presupuesto registrado', `<ul class="mt-pres">${s.presupuesto.map(p => `<li>${esc(p.concepto)}: ${p.precio ? esc(String(p.precio)) : '—'}${p.referencia ? ` <small class="nota">(referencia ${esc(String(p.referencia))})</small>` : ''}</li>`).join('')}</ul><small class="nota">Moneda no indicada en Odoo.</small>`) : ''}
      ${s.ticket ? fila('Documento vinculado', `${esc(s.ticket)} <small class="nota">(en Incidencias de Odoo)</small>`) : ''}
      ${s.adjuntos.length ? fila('Evidencias en Odoo', s.adjuntos.map(a => `${esc(a.nombre)} <small class="nota">${a.kb} KB</small>`).join(', ')) : ''}
      ${fila('Registro original', `<a href="${esc(MT.urlOdooSolicitud(s))}" target="_blank" rel="noopener noreferrer">Abrir en Odoo</a> <small class="nota">(requiere sesión)</small>`)}
    </dl><p><button type="button" class="btn btn-sm" data-act="mt-trabajo" data-sid="${esc(s.id)}">Ver ficha del trabajo</button></p></details></li>`;
}
export function fichaMaquinaHtml(e) {
  const reales = MT.solicitudesDe(e, 'real'), abiertas = reales.filter(s => s.abierta), hist = reales.filter(s => !s.abierta)
    .sort((a, b) => String(b.fechaProgramada || b.fechaSolicitud).localeCompare(String(a.fechaProgramada || a.fechaSolicitud)));
  const otras = MT.solicitudesDe(e).filter(s => s.clase !== 'real');
  return `<div class="dlg-head"><div><p class="dlg-kicker">${esc(e.codigo || 'Sin código')} · ${esc(e.categoria)}</p><h2 id="dlg-titulo">${esc(e.nombreCorto)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha mt-ficha">
      <p class="mt-fuente-mini">Datos de Odoo al ${esc(fdt(MT.T.fuente.capturado))} (captura, no en vivo).</p>
      <h3 class="rp-h">Información general</h3>
      <dl class="org-dl">
        ${fila('Identificador interno', `<code>${esc(e.id)}</code>`)}
        ${fila('Referencia de Odoo', `Equipo #${e.odooId} · <a href="${esc(MT.urlOdooEquipo(e))}" target="_blank" rel="noopener noreferrer">Abrir en Odoo</a> <small class="nota">(requiere sesión)</small>`)}
        ${fila('Código · nombre', `${esc(e.codigo || '—')} · ${esc(e.nombreCorto)}`)}
        ${fila('Marca', pend('Pendiente: Odoo no tiene este dato'))}
        ${fila('Modelo', val(e.modelo))}
        ${fila('Serial', val(e.serial))}
        ${fila('Proveedor', `${val(e.proveedor)}${e.refProveedor ? ` <small class="nota">referencia del proveedor en Odoo: «${esc(e.refProveedor)}»</small>` : ''}`)}
        ${fila('Categoría', esc(e.categoria))}
        ${fila('Ubicación', (() => { const u = MT.ubicacion(e); return u.valor ? `${esc(u.valor)} <small class="nota">${esc(u.fuente)}</small>` : pend(); })())}
        ${fila('Fotografía', e.tieneFoto ? `Disponible en Odoo · <a href="${esc(MT.urlOdooEquipo(e))}" target="_blank" rel="noopener noreferrer">ver en el registro</a>` : pend('Sin foto en Odoo'))}
        ${fila('Responsable', `${val(e.responsable, 'Pendiente de definir')}${e.notaResponsable ? `<br><small class="nota">${esc(e.notaResponsable)}</small>` : ''}`)}
        ${e.departamento ? fila('Departamento', esc(e.departamento)) : ''}
        ${e.equipoMantenimiento ? fila('Equipo de mantenimiento', esc(e.equipoMantenimiento)) : ''}
        ${e.conciliacion ? fila('Máquinas de simulación', `<span class="mt-aviso-txt">${esc(e.conciliacion)}</span>`) : ''}
      </dl>
      <h3 class="rp-h">Condición actual</h3>
      ${condicionHtml(e)}
      <h3 class="rp-h">Mantenimientos</h3>
      <h4 class="pv-h4">Trabajos abiertos (${abiertas.length})</h4>
      ${abiertas.length ? `<ul class="mt-sols">${abiertas.map(solicitudItem).join('')}</ul>` : '<p class="vacio">Ningún trabajo real abierto en la captura. Esto no confirma que la máquina esté operativa.</p>'}
      <h4 class="pv-h4">Historial (${hist.length})</h4>
      ${hist.length ? `<ul class="mt-sols">${hist.map(solicitudItem).join('')}</ul><p class="nota">«Reparado» en Odoo es historial: no confirma por sí solo que el equipo esté completamente operativo.</p>` : '<p class="vacio">Sin intervenciones reales registradas en Odoo.</p>'}
      ${PREVENTIVOS_ACTIVOS ? `<h4 class="pv-h4">Preventivos (rutinas documentadas y aprobadas)</h4>${preventivosMaquinaHtml(e)}` : ''}
      ${otras.length ? `<details class="mas"><summary>Registros de prueba o plantilla en Odoo (${otras.length}) · fuera de los indicadores</summary>
        <ul class="mt-sols">${otras.map(s => `<li><b>${esc(s.asunto)}</b> <span class="nota">· ${esc(s.etapa)} · ${s.clase === 'prueba' ? 'prueba' : 'plantilla'}: ${esc(s.motivoClase)}</span></li>`).join('')}</ul></details>` : ''}
      <h3 class="rp-h">Información técnica</h3>
      <details class="mas"><summary>Descripción técnica en Odoo</summary>${e.descripcion ? `<p class="pre">${esc(e.descripcion)}</p>` : '<p class="vacio">Sin descripción.</p>'}</details>
      <details class="mas"><summary>Sistemas (${e.sistemas.length}) y componentes (${e.componentes.length})</summary>
        ${e.sistemas.length ? `<p><b>Sistemas:</b> ${e.sistemas.map(esc).join(' · ')}</p>` : '<p class="vacio">Sin sistemas registrados.</p>'}
        ${e.componentes.length ? `<p><b>Componentes:</b> ${e.componentes.map(esc).join(' · ')}</p>` : '<p class="vacio">Sin componentes registrados.</p>'}</details>
      <details class="mas"><summary>Manuales y documentos (${e.manuales.length})</summary>
        ${e.manuales.length ? `<ul class="vt-evid">${e.manuales.map(m => `<li>${esc(m.nombre)} <small class="nota">${m.kb} KB · en Odoo</small></li>`).join('')}</ul>` : '<p class="vacio">Sin manual en Odoo.</p>'}
        <p class="nota">Despieces y especificaciones: pendientes de documentar.</p></details>
    </div>`;
}

/* ── Condición actual (Etapa 3) ── */
const condCorta = e => { const c = MT.condicionActual(e); return `${chipCond(c.condicion)}${c.verificacion && c.verificada ? ` <small class="nota">verificada el ${fd(c.verificacion.fecha)}</small>` : ''}`; };
const ubiTxt = e => { const u = MT.ubicacion(e); return u.valor ? `<span title="${esc(u.fuente)}">${esc(u.valor)}</span>` : pend(); };
function condicionHtml(e) {
  const c = MT.condicionActual(e), v = c.verificacion, avisos = MT.avisosCondicion(e), hist = MT.verificaciones(e).slice(1);
  return `<dl class="org-dl">
      ${fila('Condición operativa', `${chipCond(c.condicion)} ${c.verificada ? '<span class="mq-chip c-stock">Confirmada</span>' : '<span class="mq-chip c-otra">Sin confirmar</span>'}${c.motivo ? `<br><small class="nota">${esc(c.motivo)}</small>` : ''}`)}
      ${fila('Restricciones de uso', v && v.restricciones ? `<span class="pre">${esc(v.restricciones)}</span>` : pend('Sin restricciones documentadas'))}
      ${fila('Última verificación', v ? `${esc(fd(v.fecha))} · ${esc(v.responsable)}${v.registradoPor ? ` <small class="nota">(registrada por ${esc(v.registradoPor)})</small>` : ''}` : pend('Sin verificación registrada'))}
      ${v && v.observaciones ? fila('Observaciones', `<span class="pre">${esc(v.observaciones)}</span>`) : ''}
      ${v && v.evidencia ? fila('Evidencia', /^https?:\/\//.test(v.evidencia) ? `<a href="${esc(v.evidencia)}" target="_blank" rel="noopener noreferrer">${esc(v.evidencia)}</a>` : esc(v.evidencia)) : ''}
    </dl>
    ${avisos.map(a => `<p class="mt-aviso">⚠ ${esc(a)}</p>`).join('')}
    <p><button type="button" class="btn btn-sm btn-primary" data-mt="verificar">Registrar verificación</button></p>
    <p class="nota">Las verificaciones se guardan para todo el equipo (piden el PIN y tu nombre). No se escriben en Odoo.</p>
    ${hist.length ? `<details class="mas"><summary>Verificaciones anteriores (${hist.length})</summary><ol class="hist">${hist.map(h => `<li><b>${esc(fd(h.fecha))}</b> · ${esc(h.condicion)} · ${esc(h.responsable)}${h.restricciones ? ` · restricciones: ${esc(h.restricciones)}` : ''}${h.observaciones ? `<br><small class="nota">${esc(h.observaciones)}</small>` : ''}</li>`).join('')}</ol></details>` : ''}`;
}
const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export function formVerificacionHtml(e, autor) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(e.codigo)} · ${esc(e.nombreCorto)}</p><h2 id="dlg-titulo">Registrar verificación</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Registra lo que se comprobó en la máquina. La condición no se deduce de las solicitudes de Odoo ni de su etapa.</p>
      <fieldset class="fld"><legend>Condición observada <b class="req">*</b></legend>
        ${MT.CONDICIONES.map(c => `<label class="check"><input type="radio" name="condicion" value="${esc(c)}"> ${esc(c)}</label>`).join('')}</fieldset>
      <label class="fld"><span>Restricciones de uso <small class="nota">(obligatorio si es «Operativa con restricciones»)</small></span><textarea name="restricciones" rows="2" maxlength="600" placeholder="Ej.: no superar 3.000 kg; no usar el lado derecho"></textarea></label>
      <div class="fld-row">
        <label class="fld"><span>Fecha de la verificación <b class="req">*</b></span><input type="date" name="fecha" value="${hoy()}" max="${hoy()}"></label>
        <label class="fld"><span>Verificó <b class="req">*</b></span><input name="responsable" maxlength="120" autocomplete="off" placeholder="Nombre de quien revisó la máquina"></label>
      </div>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="2" maxlength="1000"></textarea></label>
      <label class="fld"><span>Evidencia</span><input name="evidencia" maxlength="600" autocomplete="off" placeholder="Enlace a la foto o video, o descripción de la evidencia"></label>
      <label class="fld"><span>Registrado por</span><input name="registradoPor" maxlength="80" value="${esc(autor || '')}" autocomplete="name"></label>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar verificación</button></div>
  </form>`;
}

/* ── Mantenimientos (Etapa 4): trabajos abiertos, historial y registros de prueba aparte ── */
const nomEq = s => { const e = MT.equipoDeSolicitud(s); return e ? `${e.codigo ? e.codigo + ' · ' : ''}${e.nombreCorto}` : 'Sin equipo'; };
const atiendeTxt = s => { const a = MT.atiende(s); return a ? esc(a) : `${pend('Sin asignar')} <small class="nota">(en Odoo: «${esc(s.tecnico || '—')}»)</small>`; };
const proxTxt = s => { const g = MT.seguimientoDe(s); return g.proximaAccion ? esc(g.proximaAccion) : pend('Pendiente de definir'); };
export function trabajosFiltrados(S) {
  const tt = fold(S.mtTBusca).trim().split(/\s+/).filter(Boolean);
  return MT.T.solicitudes.filter(s => s.clase === 'real').filter(s => {
    const e = MT.equipoDeSolicitud(s) || {};
    return (!S.mtTEquipo || e.id === S.mtTEquipo) && (!S.mtTCat || e.categoria === S.mtTCat) && (!S.mtTPrio || s.prioridad === S.mtTPrio)
      && (!S.mtTEtapa || s.etapa === S.mtTEtapa) && (!S.mtTResp || (MT.atiende(s) || 'sin-asignar') === S.mtTResp)
      && (!tt.length || tt.every(w => fold([s.asunto, s.falla, s.modoFalla, s.accion, s.descripcion, s.sistema, s.componente, nomEq(s)].join(' ')).includes(w)));
  });
}
export function trabajosHtml(S) {
  if (MT.T.estado !== 'listo') return `${cabeceraMant('trabajos')}<p class="vacio">${MT.T.estado === 'error' ? 'Sin datos.' : 'Cargando…'}</p>`;
  const reales = MT.T.solicitudes.filter(s => s.clase === 'real'), otras = MT.T.solicitudes.filter(s => s.clase !== 'real');
  const l = trabajosFiltrados(S), filtrado = !!(S.mtTEquipo || S.mtTCat || S.mtTPrio || S.mtTEtapa || S.mtTResp || String(S.mtTBusca || '').trim());
  const abiertos = l.filter(s => s.abierta).sort((a, b) => Number(b.prioridad) - Number(a.prioridad));
  const hist = l.filter(s => !s.abierta).sort((a, b) => String(b.fechaProgramada || b.fechaSolicitud).localeCompare(String(a.fechaProgramada || a.fechaSolicitud)));
  const responsables = [...new Set(reales.map(s => MT.atiende(s) || 'sin-asignar'))];
  const opt = (v, t, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`;
  return `${cabeceraMant('trabajos')}
    <p class="nota mt-alcance" aria-live="polite">${filtrado ? `<b>Mostrando ${l.length} de ${reales.length} solicitudes reales.</b>` : `<b>${reales.length} solicitudes reales en Odoo</b>: ${plural(reales.filter(s => s.abierta).length, 'abierta', 'abiertas')} y ${reales.filter(s => !s.abierta).length} en el historial.`}
      ${otras.length ? `${otras.length} registros de prueba o plantilla quedan aparte, fuera de las cifras.` : ''}</p>
    <div class="mq-barra mt-filtros">
      <label class="mq-filtro"><span class="sr-only">Buscar trabajo</span><input type="search" data-act="mt-t-busca" value="${esc(S.mtTBusca || '')}" placeholder="Falla, causa, sistema…" autocomplete="off"></label>
      <label class="mq-filtro"><span class="sr-only">Equipo</span><select data-act="mt-t-equipo">${opt('', 'Todos los equipos', S.mtTEquipo)}${MT.maquinas().slice().sort((a, b) => (a.codigo || 'ZZ').localeCompare(b.codigo || 'ZZ')).map(e => opt(e.id, `${e.codigo} · ${e.nombreCorto}`, S.mtTEquipo)).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Categoría</span><select data-act="mt-t-cat">${opt('', 'Todas las categorías', S.mtTCat)}${MT.categorias().map(c => opt(c, c, S.mtTCat)).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Prioridad</span><select data-act="mt-t-prio">${opt('', 'Cualquier prioridad', S.mtTPrio)}${['3', '2', '1', '0'].map(p => opt(p, MT.PRIORIDAD[p], S.mtTPrio)).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Responsable</span><select data-act="mt-t-resp">${opt('', 'Cualquier responsable', S.mtTResp)}${responsables.map(r => opt(r, r === 'sin-asignar' ? 'Sin asignar' : r, S.mtTResp)).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Etapa en Odoo</span><select data-act="mt-t-etapa">${opt('', 'Cualquier etapa', S.mtTEtapa)}${MT.T.etapas.map(x => opt(x.nombre, x.nombre, S.mtTEtapa)).join('')}</select></label>
      ${filtrado ? '<button type="button" class="btn btn-sm btn-ghost" data-act="mt-t-limpiar">Quitar filtros</button>' : ''}
    </div>
    <section class="pj-sec" aria-labelledby="mt-ab"><h2 id="mt-ab">Trabajos abiertos (${abiertos.length})</h2>
      ${abiertos.length ? `<ul class="mt-trab">${abiertos.map(trabajoTarjeta).join('')}</ul>` : `<p class="vacio">${filtrado ? 'Ningún trabajo abierto coincide con los filtros.' : 'No hay trabajos reales abiertos en la captura.'}</p>`}
    </section>
    <section class="pj-sec" aria-labelledby="mt-hi"><h2 id="mt-hi">Historial (${hist.length})</h2>
      ${hist.length ? `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Equipo</th><th>Trabajo</th><th>Tipo</th><th>Prioridad</th><th>Etapa</th><th>Ejecución según Odoo</th><th>Cierre en Odoo</th></tr></thead><tbody>
        ${hist.map(s => `<tr><td>${esc(nomEq(s))}</td><td><button type="button" class="mq-link" data-act="mt-trabajo" data-sid="${esc(s.id)}"><b>${esc(s.asunto)}</b></button></td><td>${esc(s.tipoTxt)}</td><td>${esc(s.prioridadTxt)}</td>
          <td>${esc(s.etapa)}</td><td>${fd(s.fechaProgramada) || '—'}</td><td>${fd(s.fechaCierre) || '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="nota">La «ejecución según Odoo» es la fecha programada; la fecha de registro es cuando se cargó en Odoo. «Reparado» es historial y no confirma por sí solo que el equipo esté operativo.</p>`
        : `<p class="vacio">${filtrado ? 'Ningún registro del historial coincide con los filtros.' : 'Sin historial.'}</p>`}
    </section>
    ${PREVENTIVOS_ACTIVOS ? preventivosHtml(S) : ''}
    ${otras.length ? `<details class="mas"><summary>Registros de prueba o plantilla en Odoo (${otras.length}) · fuera de las cifras</summary>
      <ul class="vt-evid">${otras.map(s => `<li><b>${esc(s.asunto)}</b> <small class="nota">· ${esc(nomEq(s))} · ${esc(s.etapa)} · ${s.clase}: ${esc(s.motivoClase)}</small></li>`).join('')}</ul>
      <p class="nota">Se conservan en Odoo sin cambios; aquí solo se separan para no inflar los indicadores.</p></details>` : ''}`;
}
function trabajoTarjeta(s) {
  const g = MT.seguimientoDe(s);
  return `<li class="mq-card mt-card mt-trab-card ${g.bloqueo || s.bloqueada ? 'bloq' : ''}"><div class="mq-card-body">
    <p class="mq-tipo">${esc(nomEq(s))} · ${esc(s.tipoTxt)}</p>
    <h3><button type="button" class="mq-link" data-act="mt-trabajo" data-sid="${esc(s.id)}">${esc(s.asunto)}</button></h3>
    <p>${chipPrio(s)} <span class="mq-chip c-otra">Odoo: ${esc(s.etapa)}</span>${g.estado ? ` <span class="mq-chip c-vendida">${esc(g.estado)}</span>` : ''}${s.avisos.length ? ' <span class="mt-aviso-ico" title="Revisar">⚠</span>' : ''}</p>
    <dl class="vt-dl">
      <div><dt>Qué le ocurre</dt><dd>${esc(s.falla || s.descripcion.split('\n')[0] || s.asunto)}</dd></div>
      <div><dt>Quién lo atiende</dt><dd>${atiendeTxt(s)}</dd></div>
      <div><dt>Qué impide continuar</dt><dd>${g.bloqueo ? `<span class="mt-aviso-txt">${esc(g.bloqueo)}</span>` : s.bloqueada ? '<span class="mt-aviso-txt">Bloqueado en Odoo (sin motivo)</span>' : '<span class="nota">Sin bloqueo documentado</span>'}</dd></div>
      <div><dt>Próxima acción</dt><dd>${proxTxt(s)}</dd></div>
      <div><dt>Registrada</dt><dd>${fd(s.fechaSolicitud)}${s.fechaProgramada ? ` <small class="nota">· programada en Odoo ${fd(s.fechaProgramada)}</small>` : ''}</dd></div>
    </dl></div></li>`;
}

/* Ficha del trabajo: resumen arriba; detalle técnico en desplegables. */
export function fichaTrabajoHtml(s) {
  const e = MT.equipoDeSolicitud(s), g = MT.seguimientoDe(s);
  const det = (t, x) => (x ? `<details class="mas" open><summary>${t}</summary><p class="pre">${esc(x)}</p></details>` : '');
  return `<div class="dlg-head"><div><p class="dlg-kicker">${esc(nomEq(s))} · Solicitud #${s.odooId} en Odoo</p><h2 id="dlg-titulo">${esc(s.asunto)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha mt-ficha">
      <p class="mt-fuente-mini">Datos de Odoo al ${esc(fdt(MT.T.fuente.capturado))} (captura, no en vivo).</p>
      ${s.clase !== 'real' ? `<p class="mt-aviso">Registro de ${s.clase} en Odoo: ${esc(s.motivoClase)} Queda fuera de los indicadores.</p>` : ''}
      ${s.avisos.map(a => `<p class="mt-aviso">⚠ ${esc(a)}</p>`).join('')}
      <dl class="org-dl">
        ${fila('Equipo', e ? `<button type="button" class="mq-link" data-act="mt-ficha" data-eid="${esc(e.id)}">${esc(nomEq(s))}</button>` : 'Sin equipo')}
        ${fila('Etapa en Odoo', `${esc(s.etapa)}${s.bloqueada ? ' · <span class="mt-aviso-txt">Bloqueado</span>' : ''}`)}
        ${fila('Tipo · prioridad', `${esc(s.tipoTxt)} · ${esc(s.prioridadTxt)}`)}
        ${fila('Fecha de registro en Odoo', fd(s.fechaSolicitud) || '—')}
        ${fila('Ejecución programada', s.fechaProgramada ? `${fd(s.fechaProgramada)}${s.finProgramado ? ` → ${fd(s.finProgramado)}` : ''}` : pend('Sin fecha'))}
        ${fila('Cierre en Odoo', fd(s.fechaCierre) || (s.abierta ? '<span class="nota">Abierta</span>' : '—'))}
        ${fila('Sistema · componente', esc([s.sistema, s.componente].filter(Boolean).join(' · ')) || pend('Sin dato'))}
      </dl>
      ${s.clase === 'real' && s.abierta ? `<h3 class="rp-h">Seguimiento</h3>
        <dl class="org-dl">
          ${fila('Quién lo atiende', atiendeTxt(s))}
          ${fila('Próxima acción', proxTxt(s))}
          ${fila('Bloqueo o dependencia', g.bloqueo ? `<span class="mt-aviso-txt">${esc(g.bloqueo)}</span>` : '<span class="nota">Sin bloqueo documentado</span>')}
          ${fila('Estado de seguimiento', g.estado ? `${esc(g.estado)}${g.fechaPrevista ? ` · previsto ${fd(g.fechaPrevista)}` : ''} <small class="nota">(no cambia la etapa de Odoo)</small>` : '<span class="nota">Sin estado complementario</span>')}
        </dl>
        <p><button type="button" class="btn btn-sm btn-primary" data-mt="seguimiento">Actualizar seguimiento</button></p>
        ${g.historial.length ? `<details class="mas"><summary>Cambios de seguimiento (${g.historial.length})</summary><ol class="hist">${g.historial.slice().reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span>${h.autor ? ` · ${esc(h.autor)}` : ''}: ${h.cambios.map(c => `${esc(CAMPO_SEG[c.campo] || c.campo)} → ${esc(c.despues || 'vacío')}`).join('; ')}</li>`).join('')}</ol></details>` : ''}` : ''}
      <h3 class="rp-h">Detalle</h3>
      ${det('Descripción original', s.descripcion)}
      ${det('Falla reportada', s.falla)}
      ${det('Diagnóstico (modo de falla)', s.modoFalla)}
      ${det('Intervención realizada', s.accion)}
      ${!s.descripcion && !s.falla && !s.modoFalla && !s.accion ? '<p class="vacio">Sin descripción, diagnóstico ni intervención documentados.</p>' : ''}
      <dl class="org-dl">
        ${fila('Repuestos utilizados', pend('No registrados en la captura'))}
        ${fila('Costos registrados', s.presupuesto.length ? `<ul class="mt-pres">${s.presupuesto.map(p => `<li>${esc(p.concepto)}: ${p.precio ? esc(String(p.precio)) : '—'}${p.referencia ? ` <small class="nota">(referencia ${esc(String(p.referencia))})</small>` : ''}</li>`).join('')}</ul><small class="nota">Presupuesto en Odoo; moneda no indicada.</small>` : pend('Sin costos registrados'))}
        ${s.ticket ? fila('Documento vinculado', `${esc(s.ticket)} <small class="nota">(Incidencias de Odoo)</small>`) : ''}
        ${fila('Evidencias', s.adjuntos.length ? s.adjuntos.map(a => `${esc(a.nombre)} <small class="nota">${a.kb} KB · en Odoo</small>`).join(', ') : pend('Sin evidencias adjuntas'))}
        ${fila('Resultado de pruebas', pend('No documentado'))}
        ${fila('Registro original', `<a href="${esc(MT.urlOdooSolicitud(s))}" target="_blank" rel="noopener noreferrer">Abrir en Odoo</a> <small class="nota">(requiere sesión)</small>`)}
      </dl>
    </div>`;
}
const CAMPO_SEG = { atiende: 'Atiende', proximaAccion: 'Próxima acción', bloqueo: 'Bloqueo', estado: 'Estado', fechaPrevista: 'Fecha prevista' };
export function formSeguimientoHtml(s, autor) {
  const g = MT.seguimientoDe(s);
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(nomEq(s))} · #${s.odooId}</p><h2 id="dlg-titulo">Seguimiento: ${esc(s.asunto)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Estos datos complementan a Odoo y no lo modifican: la etapa sigue siendo «${esc(s.etapa)}».</p>
      <label class="fld"><span>Quién lo atiende</span><input name="atiende" maxlength="120" value="${esc(g.atiende)}" autocomplete="off" placeholder="Persona o proveedor responsable"></label>
      <label class="fld"><span>Próxima acción</span><textarea name="proximaAccion" rows="2" maxlength="600">${esc(g.proximaAccion)}</textarea></label>
      <label class="fld"><span>Bloqueo o dependencia</span><textarea name="bloqueo" rows="2" maxlength="600" placeholder="Qué impide continuar (repuesto, presupuesto, proveedor…). Vacío = sin bloqueo.">${esc(g.bloqueo)}</textarea></label>
      <div class="fld-row">
        <label class="fld"><span>Estado de seguimiento</span><select name="estado"><option value="">Sin estado complementario</option>${MT.ESTADOS_SEGUIMIENTO.map(x => `<option ${x === g.estado ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="fld"><span>Fecha prevista</span><input type="date" name="fechaPrevista" value="${esc(g.fechaPrevista)}"></label>
      </div>
      <label class="fld"><span>Registrado por</span><input name="autor" maxlength="80" value="${esc(autor || '')}" autocomplete="name"></label>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
/* Próxima acción de la máquina: la del trabajo abierto real de mayor prioridad (dato complementario). */
const proxMaq = e => { const s = MT.abiertaPrincipal(e); if (!s) return '<span class="nota">Sin trabajo abierto</span>'; const g = MT.seguimientoDe(s); return g.proximaAccion ? esc(g.proximaAccion) : pend('Pendiente de definir'); };

/* ── Preventivos (Etapa 5): rutinas documentadas en Odoo; fechas solo con aprobación y ejecución registradas ── */
const chipRutina = st => (!st.aprobada ? '<span class="mq-chip c-otra">Documentada · sin aprobar</span>' : st.vencida ? '<span class="mq-chip c-falta">Aprobada · vencida</span>' : '<span class="mq-chip c-stock">Aprobada</span>');
const proxRutina = st => (st.proxima ? `${st.vencida ? '<span class="mt-aviso-txt">Vencida desde ' : 'Próxima: '}${fd(st.proxima)}${st.vencida ? '</span>' : ''}` : `<span class="nota">${esc(st.motivo)}</span>`);
export function preventivosHtml(S) {
  const eqs = MT.maquinas().filter(e => (!S.mtTEquipo || e.id === S.mtTEquipo) && (!S.mtTCat || e.categoria === S.mtTCat))
    .sort((a, b) => (a.codigo || 'ZZ').localeCompare(b.codigo || 'ZZ'));
  const con = eqs.map(e => ({ e, rs: MT.rutinasDe(e) })).filter(x => x.rs.length), sin = eqs.filter(e => !MT.rutinasDe(e).length);
  const total = con.reduce((n, x) => n + x.rs.length, 0), aprob = con.reduce((n, x) => n + x.rs.filter(r => MT.estadoRutina(r).aprobada).length, 0);
  return `<section class="pj-sec" aria-labelledby="mt-pr"><h2 id="mt-pr">Preventivos</h2>
    <p class="nota">Rutinas escritas en la descripción de cada equipo en Odoo, con su frecuencia tal como figura. <b>${total} documentadas · ${aprob} aprobadas.</b> Una rutina documentada no está aprobada hasta que una persona lo registre; la próxima fecha solo se calcula con la rutina aprobada y una ejecución registrada.</p>
    ${con.length ? `<ul class="mt-prev">${con.map(({ e, rs }) => `<li class="mq-card mt-card"><div class="mq-card-body">
      <p class="mq-tipo">${esc(e.codigo)} · ${esc(e.categoria)}</p><h3><button type="button" class="mq-link" data-act="mt-ficha" data-eid="${esc(e.id)}">${esc(e.nombreCorto)}</button></h3>
      <ul class="mt-rutinas">${rs.map(r => { const st = MT.estadoRutina(r); return `<li><button type="button" class="mq-link" data-act="mt-rutina" data-rid="${esc(r.id)}"><b>${esc(r.frecuencia)}</b></button> <small class="nota">${plural(r.tareas.length, 'tarea', 'tareas')}</small> ${chipRutina(st)}<br><small>${proxRutina(st)}</small></li>`; }).join('')}</ul>
      </div></li>`).join('')}</ul>` : '<p class="vacio">Ninguna máquina con rutinas documentadas cumple los filtros.</p>'}
    ${sin.length ? `<p class="nota">Sin rutinas documentadas en Odoo: ${sin.map(e => esc(`${e.codigo} ${e.nombreCorto}`)).join(', ')}.</p>` : ''}
    <p class="nota">En Odoo no hay preventivos programados reales: los únicos recurrentes son registros de prueba.</p></section>`;
}
export function rutinaPorId(id) { const eid = id.split('|')[0], e = MT.equipoPorId(eid); return e ? { e, r: MT.rutinasDe(e).find(r => r.id === id) } : null; }
export function fichaRutinaHtml(e, r) {
  const st = MT.estadoRutina(r), reg = MT.registroRutina(r);
  return `<div class="dlg-head"><div><p class="dlg-kicker">${esc(e.codigo)} · ${esc(e.nombreCorto)} · Preventivo</p><h2 id="dlg-titulo">Rutina ${esc(r.frecuencia.toLowerCase())}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha mt-ficha">
      <dl class="org-dl">
        ${fila('Estado', chipRutina(st))}
        ${fila('Frecuencia', `${esc(r.frecuencia)} <small class="nota">tal como figura en Odoo</small>`)}
        ${fila('Fuente', `Descripción del equipo en Odoo (captura del ${esc(fdt(MT.T.fuente.capturado))})`)}
        ${fila('Aprobación', reg.aprobacion ? `${esc(fd(reg.aprobacion.fecha))} · ${esc(reg.aprobacion.por)}${reg.aprobacion.nota ? `<br><small class="nota">${esc(reg.aprobacion.nota)}</small>` : ''}` : pend('Sin aprobar'))}
        ${fila('Última ejecución', st.ultima ? `${esc(fd(st.ultima.fecha))} · ${esc(st.ultima.por)}` : pend('Sin registrar'))}
        ${fila('Próxima', proxRutina(st))}
      </dl>
      <h3 class="rp-h">Tareas (${r.tareas.length})</h3>
      <ul class="mt-tareas">${r.tareas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      ${reg.ejecuciones.length ? `<details class="mas"><summary>Ejecuciones registradas (${reg.ejecuciones.length})</summary><ol class="hist">${reg.ejecuciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(x => `<li><b>${esc(fd(x.fecha))}</b> · ${esc(x.por)}${x.observaciones ? `<br><small class="nota">${esc(x.observaciones)}</small>` : ''}</li>`).join('')}</ol></details>` : ''}
      <p class="nota">Se guarda para todo el equipo (pide el PIN y tu nombre). No se escribe en Odoo.</p>
    </div>
    <div class="dlg-foot">${reg.aprobacion ? '<button type="button" class="btn btn-primary" data-mt="ejecucion">Registrar ejecución</button>' : '<button type="button" class="btn btn-primary" data-mt="aprobar">Aprobar rutina</button>'}</div>`;
}
export function formRutinaHtml(e, r, tipo, autor) {
  const aprobar = tipo === 'aprobar';
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(e.codigo)} · rutina ${esc(r.frecuencia.toLowerCase())}</p><h2 id="dlg-titulo">${aprobar ? 'Aprobar rutina' : 'Registrar ejecución'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      ${aprobar ? `<p class="nota">Al aprobarla, la rutina pasa a contar como preventivo del equipo con la frecuencia «${esc(r.frecuencia)}». No se cambia nada en Odoo.</p>` : '<p class="nota">Registra cuándo se realizó la rutina completa. La próxima fecha se calcula con la frecuencia documentada.</p>'}
      <div class="fld-row">
        <label class="fld"><span>${aprobar ? 'Aprobada por' : 'Realizada por'} <b class="req">*</b></span><input name="por" maxlength="120" value="${esc(autor || '')}" autocomplete="off"></label>
        <label class="fld"><span>Fecha <b class="req">*</b></span><input type="date" name="fecha" value="${hoy()}" max="${hoy()}"></label>
      </div>
      <label class="fld"><span>${aprobar ? 'Nota de aprobación' : 'Observaciones'}</span><textarea name="nota" rows="2" maxlength="1000"></textarea></label>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
/* Bloque de la ficha de la máquina: rutinas con su estado y próxima fecha. */
function preventivosMaquinaHtml(e) {
  const rs = MT.rutinasDe(e); if (!rs.length) return '<p class="vacio">Sin rutinas documentadas en Odoo para este equipo.</p>';
  return `<ul class="mt-rutinas">${rs.map(r => { const st = MT.estadoRutina(r); return `<li><button type="button" class="mq-link" data-act="mt-rutina" data-rid="${esc(r.id)}"><b>${esc(r.frecuencia)}</b></button> ${chipRutina(st)} <small>${proxRutina(st)}</small></li>`; }).join('')}</ul>`;
}

/* ── Resumen (Etapa 6) ──
   Indicadores calculados desde la captura de Odoo y los datos complementarios registrados. Se cuentan EQUIPOS y
   SOLICITUDES por separado; las pruebas, la plantilla y los registros generales quedan fuera y se muestran aparte. */
export function datosResumenMant() {
  const maqs = MT.maquinas(), reales = MT.T.solicitudes.filter(s => s.clase === 'real');
  const abiertas = reales.filter(s => s.abierta);
  const porCond = Object.fromEntries(MT.CONDICIONES.map(c => [c, maqs.filter(e => MT.condicionActual(e).condicion === c)]));
  const bloqueadas = abiertas.filter(s => MT.seguimientoDe(s).bloqueo || s.bloqueada);
  const hoyS = hoy();
  const conFecha = abiertas.filter(s => MT.seguimientoDe(s).fechaPrevista);
  // Reparaciones reales cerradas sin una verificación del equipo posterior al cierre: el cierre no confirma que funcione.
  const sinComprobar = reales.filter(s => !s.abierta && s.etapa === 'Reparado').filter(s => {
    const e = MT.equipoDeSolicitud(s); if (!e) return false;
    const v = MT.verificaciones(e)[0]; return !v || v.fecha < String(s.fechaCierre || '').slice(0, 10);
  });
  return {
    maqs, reales, abiertas, porCond, bloqueadas, conFecha, sinComprobar,
    equiposAfectados: new Set(abiertas.map(s => s.equipoOdooId)).size,
    altas: abiertas.filter(s => s.prioridad === '3'),
    vencidas: conFecha.filter(s => MT.seguimientoDe(s).fechaPrevista < hoyS),
    proximas: conFecha.filter(s => { const f = MT.seguimientoDe(s).fechaPrevista; return f >= hoyS && f <= sumarDias(hoyS, 14); }),
    fuera: { generales: MT.generales(), pruebas: MT.T.solicitudes.filter(s => s.clase === 'prueba'), plantillas: MT.T.solicitudes.filter(s => s.clase === 'plantilla') }
  };
}
const sumarDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const cifraM = (n, t, act, extra = '') => `<li><a class="rs-cifra" href="${act}"><b>${n}</b><span>${t}</span>${extra ? `<small>${extra}</small>` : ''}</a></li>`;

/* Asuntos prioritarios: lo que requiere atención, con acceso directo a su ficha. */
function asuntos(r) {
  const l = [];
  r.abiertas.slice().sort((a, b) => Number(b.prioridad) - Number(a.prioridad)).forEach(s => {
    const g = MT.seguimientoDe(s), e = MT.equipoDeSolicitud(s);
    l.push({ peso: 10 + Number(s.prioridad) + (g.bloqueo || s.bloqueada ? 5 : 0), act: 'mt-trabajo', id: s.id, titulo: `${e ? e.codigo + ' · ' : ''}${s.asunto}`,
      detalle: [`Prioridad ${s.prioridadTxt.toLowerCase()} · Odoo: ${s.etapa}`, g.bloqueo ? `Bloqueo: ${g.bloqueo}` : '', g.proximaAccion ? `Próxima acción: ${g.proximaAccion}` : 'Próxima acción pendiente de definir', ...s.avisos].filter(Boolean) });
  });
  [...r.porCond['Fuera de servicio'], ...r.porCond['Operativa con restricciones']].forEach(e => {
    const v = MT.condicionActual(e).verificacion;
    l.push({ peso: v.condicion === 'Fuera de servicio' ? 14 : 9, act: 'mt-ficha', id: e.id, titulo: `${e.codigo} · ${e.nombreCorto}`,
      detalle: [`${v.condicion} (verificada el ${fd(v.fecha)} por ${v.responsable})`, v.restricciones ? `Restricciones: ${v.restricciones}` : ''].filter(Boolean) });
  });
  return l.sort((a, b) => b.peso - a.peso).slice(0, 6);
}
export function resumenMantHtml() {
  if (MT.T.estado !== 'listo') return `${cabeceraMant('resumen')}<p class="vacio">${MT.T.estado === 'error' ? 'Sin datos.' : 'Cargando…'}</p>`;
  const r = datosResumenMant(), M = '#/mantenimiento/maquinas', J = '#/mantenimiento/trabajos', a = asuntos(r);
  const pc = c => r.porCond[c].length;
  const rel = ['pi-censo', 'pi-fichas-mantenimiento'].map(id => REGISTROS[id] ? { ...REGISTROS[id], id } : null).filter(Boolean);
  return `${cabeceraMant('resumen')}
    <section class="pj-sec rs-sec" aria-labelledby="mr-eq"><div class="sec-head"><h2 id="mr-eq">Máquinas del taller</h2><a class="rg-abrir" href="${M}">Ver máquinas →</a></div>
      <ul class="mq-cifras rs-cifras">
        ${cifraM(r.maqs.length, 'Máquinas censadas', M, `${plural(r.fuera.generales.length, 'registro general', 'registros generales')} de Odoo aparte`)}
        ${cifraM(pc('Operativa'), 'Operativas', M, 'con verificación registrada')}
        ${cifraM(pc('Operativa con restricciones'), 'Operativas con restricciones', M)}
        ${cifraM(pc('Fuera de servicio'), 'Fuera de servicio', M)}
        ${cifraM(pc('Pendiente de verificar'), 'Pendientes de verificar', M, 'sin verificación o marcadas como pendientes')}
      </ul>
      <p class="nota">La condición solo cambia con una verificación registrada; no se deduce de las solicitudes de Odoo.</p>
    </section>
    <section class="pj-sec rs-sec" aria-labelledby="mr-tr"><div class="sec-head"><h2 id="mr-tr">Mantenimientos</h2><a class="rg-abrir" href="${J}">Ver mantenimientos →</a></div>
      <ul class="mq-cifras rs-cifras">
        ${cifraM(r.abiertas.length, 'Trabajos abiertos', J, `${plural(r.equiposAfectados, 'equipo afectado', 'equipos afectados')}`)}
        ${cifraM(r.altas.length, 'De prioridad alta', J, 'Odoo no usa una prioridad «crítica»')}
        ${cifraM(r.bloqueadas.length, 'Con bloqueo documentado', J)}
        ${cifraM(r.vencidas.length, 'Con fecha prevista vencida', J, `${r.proximas.length} en los próximos 14 días · solo fechas registradas en el seguimiento`)}
        ${cifraM(r.sinComprobar.length, 'Reparaciones sin verificación posterior', M, 'cerradas en Odoo; el cierre no confirma que la máquina funcione')}
      </ul>
    </section>
    <section class="pj-sec rs-sec" aria-labelledby="mr-as"><h2 id="mr-as">Asuntos prioritarios</h2>
      ${a.length ? `<ul class="rs-alertas mt-asuntos">${a.map(x => `<li><button type="button" class="mq-link" data-act="${x.act}" ${x.act === 'mt-trabajo' ? 'data-sid' : 'data-eid'}="${esc(x.id)}"><b>${esc(x.titulo)}</b></button>${x.detalle.map(d => `<span>${esc(d)}</span>`).join('')}</li>`).join('')}</ul>`
        : '<p class="vacio">No hay trabajos abiertos ni máquinas fuera de servicio o con restricciones registradas.</p>'}
      ${pc('Pendiente de verificar') ? `<p class="nota">${plural(pc('Pendiente de verificar'), 'máquina sigue', 'máquinas siguen')} pendiente de verificar: registrar su condición es el siguiente paso para que el resumen sea confiable.</p>` : ''}
    </section>
    <section class="pj-sec rs-sec" aria-labelledby="mr-fu"><h2 id="mr-fu">Fuera de los indicadores</h2>
      <ul class="vt-evid">
        <li><b>${plural(r.fuera.generales.length, 'registro general', 'registros generales')}</b> de Odoo (${r.fuera.generales.map(e => esc(e.nombre)).join(', ')}): no son máquinas.</li>
        <li><b>${plural(r.fuera.pruebas.length, 'solicitud de prueba', 'solicitudes de prueba')}</b> («Prueba: …»), de las cuales ${r.fuera.pruebas.filter(s => s.abierta).length} siguen abiertas en Odoo.</li>
        <li><b>${plural(r.fuera.plantillas.length, 'plantilla', 'plantillas')}</b> con textos guía.</li>
      </ul>
      <p class="nota">Se conservan en Odoo sin cambios. Se pueden consultar en Máquinas del taller y en Mantenimientos.</p>
    </section>
    ${rel.length ? `<section class="pj-sec rs-sec" aria-labelledby="mr-pr"><h2 id="mr-pr">Proyectos relacionados</h2>
      <p class="nota">Las tareas para construir o completar este módulo están en los proyectos de Infraestructura. Los mantenimientos reales no se copian como tarjetas del Kanban.</p>
      <ul class="pv-chips">${rel.map(x => `<li><a href="${rutaRegistro(x)}">${esc(x.nombre)}</a></li>`).join('')}</ul></section>` : ''}`;
}
