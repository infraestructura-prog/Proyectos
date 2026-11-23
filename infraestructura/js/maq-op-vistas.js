/* Máquinas de simulación · vistas de Equipos en operación (equipos propios usados en nuestro taller). */
import { esc, plural } from './componentes.js';
import * as D from './maq-datos.js';
import * as OP from './maq-operacion.js';
import * as PV from './maq-postventa.js';
import { cabecera, estadoLectura, fdt, pend, tipoTxt, kitsListaHtml } from './maq-vistas.js';

const fd = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const filas = () => OP.activos().map(r => ({ r, u: D.unidadPorId(r.unidadId) })).filter(x => x.u)
  .sort((a, b) => String(a.u.codigo || a.u.id).localeCompare(String(b.u.codigo || b.u.id), 'es', { numeric: true }));

export function operacionHtml(S) {
  const todas = filas(), vista = S.opVista === 'tabla' ? 'tabla' : 'tarjetas', modo = S.opModo === 'kits' ? 'kits' : 'individual', filtro = S.opFiltro || '';
  const l = todas;
  // Mismos filtros que Stock: por tipo de unidad o solo las que no están en un kit.
  const lf = todas.filter(({ u }) => !filtro || (filtro === 'sueltas' ? !D.kitDeUnidad(u.id) : u.tipo === filtro));
  // Kits con al menos una unidad en operación (la composición se gestiona en Stock).
  const kitsOp = D.kitsActivos().filter(k => Object.values(k.posiciones).some(id => id && OP.deUnidad(id)));
  const conInc = l.filter(x => PV.abiertos(PV.serviciosDe({ unidadId: x.u.id })).length).length;
  const sinInsp = l.filter(x => !x.r.ultimaInspeccion).length;
  return `${cabecera('operacion')}${estadoLectura()}
    <p class="nota">Equipos propios instalados y usados en nuestro taller. No incluye máquinas pendientes de reparación ni se deduce del inventario: cada equipo se registra aquí.</p>
    <ul class="mq-cifras" aria-label="Equipos en operación">
      ${!l.length ? '<li class="mq-cifra-ancha"><b class="mq-nd">—</b><span>Información pendiente de levantar: todavía no hay equipos registrados en operación.</span></li>'
        : `<li><b>${l.filter(x => x.u.tipo !== 'soporte').length}</b><span>Máquinas en operación</span></li>
           ${l.some(x => x.u.tipo === 'soporte') ? `<li><b>${l.filter(x => x.u.tipo === 'soporte').length}</b><span>Soportes en operación</span></li>` : ''}
           <li><b>${conInc}</b><span>Con incidencias o servicios pendientes</span></li>
           <li><b>${sinInsp}</b><span>Sin inspección registrada</span></li>`}
    </ul>
    <div class="mq-barra">
      <div class="seg" role="group" aria-label="Modo"><button type="button" data-act="op-modo" data-modo="individual" aria-pressed="${modo === 'individual'}">Individual</button><button type="button" data-act="op-modo" data-modo="kits" aria-pressed="${modo === 'kits'}">Kits</button></div>
      <div class="seg" role="group" aria-label="Vista"><button type="button" data-act="op-vista" data-vista="tarjetas" aria-pressed="${vista === 'tarjetas'}">Tarjetas</button><button type="button" data-act="op-vista" data-vista="tabla" aria-pressed="${vista === 'tabla'}">Tabla</button></div>
      ${modo === 'individual' ? `<label class="mq-filtro"><span class="sr-only">Tipo de unidad</span><select data-act="op-filtro-tipo">
          ${[['', 'Todos los tipos'], ['maquina-cc', 'Máquinas con chapa'], ['maquina-sc', 'Máquinas sin chapa'], ['soporte', 'Soportes'], ['sueltas', 'Solo unidades sueltas']].map(([v, t]) => `<option value="${v}" ${filtro === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      <span class="sp"></span>
      <button type="button" class="btn btn-sm btn-primary" data-act="op-nuevo">+ Registrar equipo en operación</button>
    </div>
    ${!l.length ? '<section class="pj-sec mq-vacio"><h2>Equipos en operación</h2><p>Información pendiente de levantar. Usa «Registrar equipo en operación» y elige la unidad del inventario que se usa en el taller.</p></section>'
      : modo === 'kits' ? (kitsOp.length ? kitsListaHtml(kitsOp, vista, false) : '<p class="vacio">Ningún kit tiene unidades en operación.</p>')
      : !lf.length ? '<p class="vacio">No hay equipos en operación con este filtro.</p>'
      : vista === 'tabla' ? `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Equipo</th><th>Tipo</th><th>Kit</th><th>Ubicación en el taller</th><th>Responsable</th><th>Estado operativo</th><th>Última inspección</th><th>Próxima acción</th><th>Pendientes</th></tr></thead><tbody>
        ${lf.map(({ r, u }) => { const k = D.kitDeUnidad(u.id), ab = PV.abiertos(PV.serviciosDe({ unidadId: u.id })).length; return `<tr>
          <td><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}"><b>${esc(u.codigo || u.id)}</b></button>${u.serial ? `<br><small class="nota">${esc(u.serial)}</small>` : ''}</td>
          <td>${esc(tipoTxt(u))}</td><td>${k ? esc(k.codigo) : '—'}</td><td>${esc(r.ubicacion)}</td><td>${r.responsable ? esc(r.responsable) : pend('Sin asignar')}</td>
          <td>${u.estadoOperativo ? esc(u.estadoOperativo) : pend('Por confirmar')}</td><td>${fd(r.ultimaInspeccion) || pend('Sin registro')}</td><td>${r.proximaAccion ? esc(r.proximaAccion) : '—'}</td>
          <td>${ab ? `<span class="mq-chip c-falta">${ab}</span>` : '—'}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<ul class="mq-grid op-grid">${lf.map(({ r, u }) => { const ab = PV.abiertos(PV.serviciosDe({ unidadId: u.id })).length; return `<li class="mq-card op-card"><div class="mq-card-body">
          <p class="mq-tipo">${esc(tipoTxt(u))}</p><h3><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}">${esc(u.codigo || u.id)}</button></h3>
          <details class="mas mq-mas" data-keep="op-${esc(u.id)}"><summary>Ver datos</summary><dl class="mq-dl"><div><dt>Ubicación</dt><dd>${esc(r.ubicacion)}</dd></div><div><dt>Responsable</dt><dd>${r.responsable ? esc(r.responsable) : pend('Sin asignar')}</dd></div>
            <div><dt>Última inspección</dt><dd>${fd(r.ultimaInspeccion) || pend('Sin registro')}</dd></div>${r.proximaAccion ? `<div><dt>Próxima acción</dt><dd>${esc(r.proximaAccion)}</dd></div>` : ''}</dl></details>
          <p>${u.estadoOperativo ? `<span class="mq-chip c-otra">${esc(u.estadoOperativo)}</span>` : pend('Estado por confirmar')}${ab ? ` <span class="mq-chip c-falta">${plural(ab, 'pendiente', 'pendientes')}</span>` : ''}</p>
        </div></li>`; }).join('')}</ul>`}`;
}

/* Bloque de operación dentro de la ficha de la unidad. */
export function operacionUnidadHtml(u) {
  const r = OP.deUnidad(u.id), hist = OP.historialDe(u.id).filter(x => !x.activa);
  if (!r && !hist.length) return '';
  return `<details class="mas mq-mas" data-keep="ficha-op"><summary>Operación en nuestro taller${r ? ` · ${esc(r.ubicacion)}` : ''}</summary>
    ${r ? `<dl class="org-dl">
      <div><dt>Ubicación en el taller</dt><dd>${esc(r.ubicacion)}</dd></div>
      <div><dt>Responsable</dt><dd>${r.responsable ? esc(r.responsable) : pend('Sin asignar')}</dd></div>
      <div><dt>En operación desde</dt><dd>${fd(r.desde) || '<span class="nota">Sin fecha</span>'}</dd></div>
      <div><dt>Última inspección o mantenimiento</dt><dd>${fd(r.ultimaInspeccion) || pend('Sin registro')}</dd></div>
      <div><dt>Próxima acción</dt><dd>${r.proximaAccion ? esc(r.proximaAccion) : '<span class="nota">—</span>'}</dd></div>
      ${r.fichaTecnica ? `<div><dt>Ficha técnica</dt><dd class="pre">${/^https:\/\//.test(r.fichaTecnica) ? `<a href="${esc(r.fichaTecnica)}" target="_blank" rel="noopener noreferrer">${esc(r.fichaTecnica)}</a>` : esc(r.fichaTecnica)}</dd></div>` : ''}
    </dl>
    <details class="mas"><summary>Historial de operación (${r.historial.length})</summary><ol class="hist">${[...r.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol></details>` : ''}
    ${hist.length ? `<p class="nota">Operaciones anteriores: ${hist.map(x => `${esc(x.ubicacion)} (${fd(x.desde) || 'sin fecha'} → ${fd(x.fin && x.fin.fecha) || 'sin fecha'})`).join('; ')}.</p>` : ''}</details>`;
}

export function formOperacionHtml(r) {
  const u = r && D.unidadPorId(r.unidadId);
  const opc = OP.disponibles().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  const v = r || { ubicacion: '', responsable: '', desde: '', proximaAccion: '', fichaTecnica: '' };
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Equipos en operación</p><h2 id="dlg-titulo">${r ? `Editar ${esc(u ? u.codigo || u.id : '')}` : 'Registrar equipo en operación'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      ${r ? '' : `<label class="fld"><span>Equipo del inventario <b class="req">*</b></span><select name="unidadId"><option value="">Elige…</option>${opc.map(x => `<option value="${esc(x.id)}">${esc(x.codigo || x.id)} · ${esc(tipoTxt(x))}</option>`).join('')}</select>
        <small class="hint">Solo unidades que no están instaladas en un cliente. Al registrarla deja de contar en stock.</small></label>`}
      <div class="fld-row">
        <label class="fld"><span>Ubicación en el taller <b class="req">*</b></span><input name="ubicacion" maxlength="200" value="${esc(v.ubicacion)}" autocomplete="off" placeholder="Área, puesto…"></label>
        <label class="fld"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(v.responsable)}" autocomplete="off"></label>
        <label class="fld"><span>En operación desde</span><input type="date" name="desde" value="${esc(v.desde)}"></label>
      </div>
      <label class="fld"><span>Próxima acción</span><input name="proximaAccion" maxlength="600" value="${esc(v.proximaAccion)}" autocomplete="off"></label>
      <label class="fld"><span>Ficha técnica</span><textarea name="fichaTecnica" rows="2" maxlength="2000" placeholder="Datos técnicos o enlace https al documento">${esc(v.fichaTecnica)}</textarea></label>
      <p class="nota">El estado operativo, la marca y el modelo se editan en la ficha del equipo («Editar datos complementarios»).</p>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">${r ? 'Guardar' : 'Registrar'}</button></div>
  </form>`;
}
export function formInspeccionHtml(r, u) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Inspección o mantenimiento</p><h2 id="dlg-titulo">${esc(u.codigo || u.id)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <label class="fld"><span>Fecha <b class="req">*</b></span><input type="date" name="fecha" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="fld"><span>Qué se revisó o hizo</span><textarea name="nota" rows="3" maxlength="600"></textarea></label>
      <p class="nota">Si se encontró una falla, regístrala también como incidencia para darle seguimiento.</p>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar</button></div>
  </form>`;
}
export function formFinOperacionHtml(u) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Equipos en operación</p><h2 id="dlg-titulo">Retirar ${esc(u.codigo || u.id)} de operación</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body"><p>El equipo deja de figurar en operación y vuelve a contar según la hoja. El registro queda en su historial.</p>
      <label class="fld"><span>Fecha</span><input type="date" name="fecha" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="fld"><span>Motivo</span><input name="motivo" maxlength="400" autocomplete="off"></label></div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Retirar de operación</button></div>
  </form>`;
}
