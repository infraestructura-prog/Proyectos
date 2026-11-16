/* Máquinas de simulación · vistas de Postventa (talleres, máquinas desplegadas, mapa, servicios).
   Funciones puras que devuelven HTML. Sin datos de demostración: con la información sin levantar se muestran
   estados vacíos («Información pendiente de levantar»), nunca ceros presentados como confirmados. */
import { esc, plural } from './componentes.js';
import * as D from './maq-datos.js';
import * as PV from './maq-postventa.js';
import { cabecera, estadoLectura, fdt, pend, tipoTxt } from './maq-vistas.js';
import { ventasHtml } from './maq-ventas-vistas.js';

const fd = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const ubicTaller = t => [t.ciudad, t.municipio, t.estado].filter(Boolean).join(' · ');
const chipUbic = t => (t.coordConfirmadas ? '<span class="mq-chip c-stock">En el mapa</span>' : '<span class="mq-chip c-falta">Ubicación pendiente</span>');
const peorEstado = us => { const e = us.map(x => x.u.estadoOperativo); return e.includes('Fuera de servicio') ? 'Fuera de servicio' : e.includes('En revisión') ? 'En revisión' : e.includes('Operativa') ? 'Operativa' : ''; };

/* Talleres que cumplen los filtros (estado de Venezuela y estado operativo de sus equipos). */
export function talleresFiltrados(S) {
  const fEstado = S.pvEstado || '', fOper = S.pvOper || '';
  return PV.talleres().filter(t => (!fEstado || t.estado === fEstado) && (!fOper || PV.unidadesEnTaller(t.id).some(x => (x.u.estadoOperativo || 'Por confirmar') === fOper)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function postventaHtml(S) {
  const ts = PV.talleres(), desp = PV.desplegadas(), sinT = PV.vendidasSinTaller();
  const vista = ['tabla', 'mapa'].includes(S.pvVista) ? S.pvVista : 'tarjetas';
  const lista = talleresFiltrados(S);
  const maqDesp = desp.filter(x => x.u.tipo !== 'soporte'), sopDesp = desp.filter(x => x.u.tipo === 'soporte');
  const vacio = !ts.length && !desp.length;
  return `${cabecera('postventa')}${estadoLectura()}${ventasHtml(S)}
    <h2 class="vt-h2-talleres">Talleres de clientes e instalaciones</h2>
    <ul class="mq-cifras" aria-label="Postventa">
      ${vacio ? '<li class="mq-cifra-ancha"><b class="mq-nd">—</b><span>Información pendiente de levantar: todavía no hay talleres ni máquinas desplegadas registrados.</span></li>'
        : `<li><b>${maqDesp.length}</b><span>Máquinas desplegadas en talleres</span></li>
           ${sopDesp.length ? `<li><b>${sopDesp.length}</b><span>Soportes desplegados</span></li>` : ''}
           <li><b>${ts.length}</b><span>Talleres registrados</span></li>
           <li><b>${ts.filter(t => !t.coordConfirmadas).length}</b><span>Talleres con ubicación pendiente</span></li>`}
      ${sinT.length ? `<li><b>${sinT.length}</b><span>Vendidas según la hoja, sin taller registrado</span></li>` : ''}
    </ul>
    <div class="mq-barra">
      <div class="seg" role="group" aria-label="Vista">${[['tarjetas', 'Tarjetas'], ['tabla', 'Tabla'], ['mapa', 'Mapa']].map(([v, t]) => `<button type="button" data-act="pv-vista" data-vista="${v}" aria-pressed="${vista === v}">${t}</button>`).join('')}</div>
      <label class="mq-filtro"><span class="sr-only">Estado de Venezuela</span><select data-act="pv-estado"><option value="">Todos los estados</option>${PV.ESTADOS_VE.map(e => `<option ${e === (S.pvEstado || '') ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Estado de los equipos</span><select data-act="pv-oper"><option value="">Cualquier estado de equipos</option>${[...D.ESTADOS_OPERATIVOS, 'Por confirmar'].map(e => `<option ${e === (S.pvOper || '') ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
      <span class="sp"></span>
      <button type="button" class="btn btn-sm" data-act="pv-nuevo-taller">+ Agregar taller</button>
      <button type="button" class="btn btn-sm btn-primary" data-act="pv-instalar" ${ts.length ? '' : 'disabled title="Primero registra un taller"'}>+ Registrar instalación</button>
    </div>
    ${!ts.length ? '<section class="pj-sec mq-vacio"><h2>Talleres</h2><p>Información pendiente de levantar. Registra cada taller con «Agregar taller»; aparecerá en el mapa cuando marques sus coordenadas como confirmadas.</p></section>'
      : !lista.length ? '<p class="vacio">Ningún taller cumple los filtros.</p>'
        : vista === 'mapa' ? mapaHtml(lista) : vista === 'tabla' ? tablaTalleres(lista) : tarjetasTalleres(lista)}
    ${desp.length ? `<section class="pj-sec pv-desp" aria-labelledby="pv-desp-t"><h2 id="pv-desp-t">Máquinas desplegadas</h2>${tablaDesplegadas(desp)}</section>` : ''}
    ${sinT.length ? `<section class="pj-sec" aria-labelledby="pv-sint-t"><h2 id="pv-sint-t">Vendidas sin taller registrado</h2><p class="nota">La hoja las indica como vendidas, pero falta registrar dónde están instaladas.</p>
      <ul class="pv-chips">${sinT.map(u => `<li><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}">${esc(u.codigo)}</button></li>`).join('')}</ul></section>` : ''}`;
}
function tarjetasTalleres(ts) {
  return `<ul class="mq-grid pv-grid">${ts.map(t => {
    const us = PV.unidadesEnTaller(t.id), ab = PV.abiertos(PV.serviciosDe({ tallerId: t.id })).length;
    return `<li class="mq-card pv-card"><div class="mq-card-body"><p class="mq-tipo">${t.red ? esc(t.red) : 'Taller'}</p>
      <h3><button type="button" class="mq-link" data-act="pv-taller" data-tid="${esc(t.id)}">${esc(t.nombre)}</button></h3>
      <p class="nota">${esc(ubicTaller(t)) || 'Sin estado ni ciudad'}</p>
      <p>${chipUbic(t)} <span class="mq-chip c-otra">${plural(us.length, 'equipo', 'equipos')}</span>${ab ? ` <span class="mq-chip c-falta">${plural(ab, 'pendiente', 'pendientes')}</span>` : ''}</p>
      <p class="nota">${t.contactos.length ? plural(t.contactos.length, 'contacto', 'contactos') : 'Sin contactos'}</p></div></li>`; }).join('')}</ul>`;
}
function tablaTalleres(ts) {
  return `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Taller</th><th>Red / marca</th><th>Estado</th><th>Ciudad</th><th>Equipos</th><th>Estado de equipos</th><th>Ubicación</th></tr></thead><tbody>
    ${ts.map(t => { const us = PV.unidadesEnTaller(t.id); return `<tr><td><button type="button" class="mq-link" data-act="pv-taller" data-tid="${esc(t.id)}"><b>${esc(t.nombre)}</b></button></td><td>${esc(t.red || '—')}</td>
      <td>${esc(t.estado || '—')}</td><td>${esc(t.ciudad || '—')}</td><td>${us.length}</td><td>${esc(peorEstado(us) || (us.length ? 'Por confirmar' : '—'))}</td><td>${chipUbic(t)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function mapaHtml(ts) {
  const con = ts.filter(t => t.coordConfirmadas), sin = ts.filter(t => !t.coordConfirmadas);
  return `<div class="pv-mapa-wrap"><div id="pv-mapa" class="pv-mapa" role="region" aria-label="Mapa de talleres">${con.length ? '<p class="vacio">Cargando mapa…</p>' : ''}</div>
      ${!con.length ? '<p class="nota pv-mapa-nota">Ningún taller tiene todavía coordenadas confirmadas: el mapa no muestra marcadores.</p>' : ''}</div>
    ${sin.length ? `<section class="pj-sec"><h2>Ubicación pendiente</h2><p class="nota">Estos talleres no aparecen en el mapa hasta que se confirmen sus coordenadas.</p>
      <ul class="pv-chips">${sin.map(t => `<li><button type="button" class="mq-link" data-act="pv-taller" data-tid="${esc(t.id)}">${esc(t.nombre)}</button> <small class="nota">${esc(ubicTaller(t))}</small></li>`).join('')}</ul></section>` : ''}`;
}
export const marcadoresMapa = ts => ts.filter(t => t.coordConfirmadas).map(t => ({ t, n: PV.unidadesEnTaller(t.id).length }));
export function popupTallerHtml(t) {
  const us = PV.unidadesEnTaller(t.id);
  return `<div class="pv-popup"><b>${esc(t.nombre)}</b>${t.red ? `<br><small>${esc(t.red)}</small>` : ''}<br><small>${esc(ubicTaller(t))}</small>
    <p>${plural(us.length, 'equipo instalado', 'equipos instalados')}${us.length ? `: ${us.map(x => esc(x.u.codigo || x.u.id)).join(', ')}` : ''}</p>
    <button type="button" class="pv-popup-btn" data-act="pv-taller" data-tid="${esc(t.id)}">Ver ficha del taller</button></div>`;
}
function tablaDesplegadas(desp) {
  return `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Unidad</th><th>Tipo</th><th>Kit</th><th>Taller</th><th>Estado operativo</th><th>Instalación</th><th>Pendientes</th></tr></thead><tbody>
    ${desp.map(({ u, t, inst }) => { const k = D.kitDeUnidad(u.id), ab = PV.abiertos(PV.serviciosDe({ unidadId: u.id })); return `<tr>
      <td><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}"><b>${esc(u.codigo || u.id)}</b></button>${u.serial ? `<br><small class="nota">${esc(u.serial)}</small>` : ''}</td>
      <td>${esc(tipoTxt(u))}</td><td>${k ? esc(k.codigo) : '—'}</td><td>${t ? `<button type="button" class="mq-link" data-act="pv-taller" data-tid="${esc(t.id)}">${esc(t.nombre)}</button>` : '—'}</td>
      <td>${u.estadoOperativo ? esc(u.estadoOperativo) : pend('Por confirmar')}</td><td>${fd(inst.fechaInstalacion) || '<span class="nota">Sin fecha</span>'}</td>
      <td>${ab.length ? `<span class="mq-chip c-falta">${ab.length}</span> <small>${esc(ab[0].proximaAccion || ab[0].descripcion)}</small>` : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
}

const servListaHtml = l => (l.length ? `<ul class="pv-serv">${l.map(s => `<li class="${s.estado === 'Abierto' ? 'abierto' : ''}">
    <span class="mq-chip ${s.tipo === 'Incidencia' ? 'c-falta' : 'c-otra'}">${esc(s.tipo)}</span> <b>${esc(fd(s.fecha) || 'Sin fecha')}</b> · ${esc(s.estado)}
    ${s.unidadId ? ` · <button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(s.unidadId)}">${esc((D.unidadPorId(s.unidadId) || {}).codigo || s.unidadId)}</button>` : ''}
    <p>${esc(s.descripcion)}</p>${s.proximaAccion ? `<p class="nota">Próxima acción: ${esc(s.proximaAccion)}</p>` : ''}${s.responsable ? `<p class="nota">Responsable: ${esc(s.responsable)}</p>` : ''}
    <button type="button" class="btn btn-sm btn-ghost" data-pv="editar-servicio" data-sid="${esc(s.id)}">Editar</button></li>`).join('')}</ul>` : '<p class="vacio">Sin registros.</p>');

export function fichaTallerHtml(t) {
  const us = PV.unidadesEnTaller(t.id), sv = PV.serviciosDe({ tallerId: t.id });
  return `<div class="dlg-head"><div><p class="dlg-kicker">Taller${t.red ? ` · ${esc(t.red)}` : ''}</p><h2 id="dlg-titulo">${esc(t.nombre)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha">
      <dl class="org-dl">
        <div><dt>Red o marca del taller</dt><dd>${t.red ? esc(t.red) : '<span class="nota">No aplica / sin dato</span>'}</dd></div>
        <div><dt>Estado · municipio · ciudad</dt><dd>${esc([t.estado, t.municipio, t.ciudad].filter(Boolean).join(' · ')) || pend('Sin datos')}</dd></div>
        <div><dt>Dirección</dt><dd>${t.direccion ? esc(t.direccion) : pend('Sin dirección')}</dd></div>
        <div><dt>Coordenadas</dt><dd>${t.lat !== null ? `${t.lat}, ${t.lng} ${t.coordConfirmadas ? '<span class="mq-chip c-stock">Confirmadas</span>' : '<span class="mq-chip c-falta">Sin confirmar</span>'}` : pend('Ubicación pendiente')}</dd></div>
        ${t.observaciones ? `<div><dt>Observaciones</dt><dd class="pre">${esc(t.observaciones)}</dd></div>` : ''}
      </dl>
      <h3 class="rp-h">Contactos</h3>
      ${t.contactos.length ? `<ul class="pv-contactos">${t.contactos.map(c => `<li><b>${esc(c.nombre || 'Sin nombre')}</b>${c.cargo ? ` · ${esc(c.cargo)}` : ''}
        ${c.telefono ? `<br><a href="tel:${esc(c.telefono.replace(/[^\d+]/g, ''))}">${esc(c.telefono)}</a>` : ''}${c.correo ? `<br><a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a>` : ''}</li>`).join('')}</ul>` : '<p class="vacio">Sin contactos registrados.</p>'}
      <h3 class="rp-h">Máquinas instaladas</h3>
      ${us.length ? `<ul class="pv-chips">${us.map(({ u, inst }) => `<li><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}">${esc(u.codigo || u.id)}</button> <small class="nota">${esc(tipoTxt(u))}${inst.fechaInstalacion ? ` · desde ${fd(inst.fechaInstalacion)}` : ''}</small></li>`).join('')}</ul>` : '<p class="vacio">Ninguna máquina registrada en este taller.</p>'}
      <h3 class="rp-h">Visitas, servicios e incidencias</h3>
      ${servListaHtml(sv)}
      ${t.historial.length ? `<details class="mas"><summary>Historial del taller (${t.historial.length})</summary><ol class="hist">${[...t.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol></details>` : ''}
    </div>
    <div class="dlg-foot"><button type="button" class="btn btn-ghost" data-pv="servicio">+ Visita, servicio o incidencia</button><span class="sp"></span>
      <button type="button" class="btn" data-pv="instalar">Registrar instalación</button><button type="button" class="btn btn-primary" data-pv="editar">Editar taller</button></div>`;
}

export const contactoFilaHtml = (c = {}, i = 0) => `<fieldset class="pv-contacto" data-contacto><legend class="sr-only">Contacto ${i + 1}</legend>
  <input name="c-nombre" maxlength="120" value="${esc(c.nombre || '')}" placeholder="Nombre" autocomplete="off" aria-label="Nombre del contacto">
  <input name="c-cargo" maxlength="120" value="${esc(c.cargo || '')}" placeholder="Cargo" autocomplete="off" aria-label="Cargo">
  <input name="c-telefono" maxlength="60" value="${esc(c.telefono || '')}" placeholder="Teléfono" autocomplete="off" inputmode="tel" aria-label="Teléfono">
  <input name="c-correo" maxlength="160" value="${esc(c.correo || '')}" placeholder="Correo" autocomplete="off" type="email" aria-label="Correo">
  <button type="button" class="icon-btn sm" data-pv-quitar-contacto aria-label="Quitar contacto">×</button></fieldset>`;
export function formTallerHtml(t) {
  const v = t || { nombre: '', red: '', estado: '', municipio: '', ciudad: '', direccion: '', lat: null, lng: null, coordConfirmadas: false, contactos: [], observaciones: '' };
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Postventa</p><h2 id="dlg-titulo">${t ? `Editar «${esc(t.nombre)}»` : 'Agregar taller'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <div class="fld-row">
        <label class="fld"><span>Nombre comercial <b class="req">*</b></span><input name="nombre" maxlength="160" value="${esc(v.nombre)}" required autocomplete="off"><small class="err" hidden>Escribe el nombre comercial.</small></label>
        <label class="fld"><span>Red o marca del taller</span><input name="red" maxlength="160" value="${esc(v.red)}" autocomplete="off" placeholder="Solo si pertenece a una red o franquicia"></label>
      </div>
      <div class="fld-row">
        <label class="fld"><span>Estado</span><select name="estado"><option value="">Sin definir</option>${PV.ESTADOS_VE.map(e => `<option ${e === v.estado ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
        <label class="fld"><span>Municipio</span><input name="municipio" maxlength="120" value="${esc(v.municipio)}" autocomplete="off"></label>
        <label class="fld"><span>Ciudad</span><input name="ciudad" maxlength="120" value="${esc(v.ciudad)}" autocomplete="off"></label>
      </div>
      <label class="fld"><span>Dirección</span><input name="direccion" maxlength="400" value="${esc(v.direccion)}" autocomplete="off"></label>
      <fieldset class="fld"><legend>Ubicación en el mapa</legend>
        <p class="hint">Acércate en el mapa hasta ver la calle y haz clic en la entrada del taller, o pega sus coordenadas (por ejemplo, copiadas de Google Maps). No uses el centro de la ciudad.</p>
        <div class="pv-minimapa" data-minimapa></div>
        <div class="fld-row">
          <label class="fld"><span>Latitud</span><input name="lat" inputmode="decimal" value="${v.lat ?? ''}" autocomplete="off" placeholder="10.4806"></label>
          <label class="fld"><span>Longitud</span><input name="lng" inputmode="decimal" value="${v.lng ?? ''}" autocomplete="off" placeholder="-66.9036"></label>
        </div>
        <label class="check"><input type="checkbox" name="coordConfirmadas" ${v.coordConfirmadas ? 'checked' : ''}> Coordenadas confirmadas (verificadas en el lugar o con el taller)</label>
        <small class="err" data-err-coord hidden></small>
      </fieldset>
      <fieldset class="fld"><legend>Contactos</legend><div data-contactos>${(v.contactos.length ? v.contactos : [{}]).map(contactoFilaHtml).join('')}</div>
        <button type="button" class="btn btn-sm" data-pv-agregar-contacto>+ Agregar contacto</button></fieldset>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="2" maxlength="2000">${esc(v.observaciones)}</textarea></label>
    </div>
    <div class="dlg-foot">${t ? '<button type="button" class="btn btn-ghost tk-borrar" data-pv-borrar>Eliminar taller</button><span class="sp"></span>' : ''}<button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

export function formInstalacionHtml(tallerId) {
  const ts = PV.talleres().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const libres = PV.instalables().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  const kitsLibres = D.kitsActivos().filter(k => Object.values(k.posiciones).some(id => id && libres.some(u => u.id === id)));
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Postventa</p><h2 id="dlg-titulo">Registrar instalación</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">La máquina no se copia: deja de contar en stock y conserva su ficha, su kit y su historial.</p>
      <label class="fld"><span>Taller <b class="req">*</b></span><select name="tallerId"><option value="">Elige…</option>${ts.map(t => `<option value="${esc(t.id)}" ${t.id === tallerId ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select><small class="err" hidden>Elige el taller.</small></label>
      ${kitsLibres.length ? `<label class="fld"><span>Marcar las unidades de un kit (opcional)</span><select name="kit" data-pv-kit><option value="">—</option>${kitsLibres.map(k => `<option value="${esc(k.id)}">Kit ${esc(k.codigo)} (${D.evaluarKit(k).asignadas} de 4 unidades)</option>`).join('')}</select></label>` : ''}
      <fieldset class="fld"><legend>Unidades instaladas <b class="req">*</b></legend>
        <div class="pv-unidades">${libres.map(u => `<label class="check"><input type="checkbox" name="unidad" value="${esc(u.id)}" data-kit="${esc((D.kitDeUnidad(u.id) || {}).id || '')}"> ${esc(u.codigo || u.id)} <small class="nota">${esc(tipoTxt(u))}${u.condicionHoja === 'Vendida' ? ' · vendida en la hoja' : ''}</small></label>`).join('') || '<p class="vacio">No hay unidades disponibles.</p>'}</div>
        <small class="err" data-err-unidad hidden>Marca al menos una unidad.</small></fieldset>
      <div class="fld-row">
        <label class="fld"><span>Fecha de venta</span><input type="date" name="fechaVenta"></label>
        <label class="fld"><span>Fecha de instalación</span><input type="date" name="fechaInstalacion"></label>
      </div>
      <label class="fld"><span>Garantía</span><input name="garantia" maxlength="300" autocomplete="off" placeholder="Solo si está documentada"></label>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="2" maxlength="1000"></textarea></label>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar</button></div>
  </form>`;
}

export function formServicioHtml(s, ctx) {
  const v = s || { tipo: 'Servicio', fecha: new Date().toISOString().slice(0, 10), estado: 'Abierto', descripcion: '', proximaAccion: '', responsable: '', unidadId: ctx.unidadId || '', tallerId: ctx.tallerId || '', ventaId: ctx.ventaId || '' };
  const unidadesTaller = v.tallerId ? PV.unidadesEnTaller(v.tallerId).map(x => x.u) : [];
  const opc = v.unidadId && !unidadesTaller.some(u => u.id === v.unidadId) ? [D.unidadPorId(v.unidadId), ...unidadesTaller].filter(Boolean) : unidadesTaller;
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Servicios e incidencias</p><h2 id="dlg-titulo">${s ? 'Editar registro' : 'Nuevo registro'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <input type="hidden" name="tallerId" value="${esc(v.tallerId)}"><input type="hidden" name="ventaId" value="${esc(v.ventaId || '')}">
      <div class="fld-row">
        <label class="fld"><span>Tipo</span><select name="tipo">${PV.TIPOS_SERVICIO.map(x => `<option ${x === v.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="fld"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}"></label>
        <label class="fld"><span>Estado</span><select name="estado">${PV.ESTADOS_SERVICIO.map(x => `<option ${x === v.estado ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      </div>
      <label class="fld"><span>Máquina</span><select name="unidadId"><option value="">${v.tallerId ? 'Todo el taller (sin máquina específica)' : v.ventaId ? 'Sin máquina identificada' : 'Sin máquina'}</option>${opc.map(u => `<option value="${esc(u.id)}" ${u.id === v.unidadId ? 'selected' : ''}>${esc(u.codigo || u.id)}</option>`).join('')}</select></label>
      <label class="fld"><span>Descripción <b class="req">*</b></span><textarea name="descripcion" rows="3" maxlength="2000">${esc(v.descripcion)}</textarea></label>
      <div class="fld-row">
        <label class="fld"><span>Próxima acción</span><input name="proximaAccion" maxlength="600" value="${esc(v.proximaAccion)}" autocomplete="off"></label>
        <label class="fld"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(v.responsable)}" autocomplete="off"></label>
      </div>
      <p class="nota">Registrar un servicio no cambia la ubicación ni la propiedad de la máquina.</p>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
export function formRetiroHtml(u) {
  const t = PV.tallerPorId(u.tallerId);
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Postventa</p><h2 id="dlg-titulo">Registrar retiro de ${esc(u.codigo || u.id)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body"><p>La máquina deja de figurar en ${esc(t ? t.nombre : 'el taller')}. La instalación queda en su historial.</p>
      <label class="fld"><span>Fecha del retiro</span><input type="date" name="fecha" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="fld"><span>Motivo</span><input name="motivo" maxlength="400" autocomplete="off" placeholder="Devolución, traslado, error de registro…"></label></div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar retiro</button></div>
  </form>`;
}

/* Bloque de postventa dentro de la ficha de una unidad: instalación actual, trayectoria y servicios. */
export function postventaUnidadHtml(u) {
  const act = PV.instalacionActiva(u.id), hist = PV.historialInstalaciones(u.id).filter(x => !x.activa), sv = PV.serviciosDe({ unidadId: u.id });
  const t = act && PV.tallerPorId(act.tallerId);
  return `<h3 class="rp-h">Postventa</h3>
    ${act ? `<dl class="org-dl">
        <div><dt>Instalada en</dt><dd>${t ? `<button type="button" class="mq-link" data-act="pv-taller" data-tid="${esc(t.id)}">${esc(t.nombre)}</button> <small class="nota">${esc(ubicTaller(t))}</small>` : '—'}</dd></div>
        <div><dt>Fecha de venta</dt><dd>${fd(act.fechaVenta) || '<span class="nota">No registrada</span>'}</dd></div>
        <div><dt>Fecha de instalación</dt><dd>${fd(act.fechaInstalacion) || '<span class="nota">No registrada</span>'}</dd></div>
        <div><dt>Garantía</dt><dd>${act.garantia ? esc(act.garantia) : '<span class="nota">No documentada</span>'}</dd></div>
      </dl>${u.diferenciaHoja ? '<p class="aviso cond-aviso">La hoja de máquinas todavía la indica «En stock». La aplicación no la modifica: actualiza la condición en la hoja cuando corresponda.</p>' : ''}`
      : '<p class="nota">No está instalada en ningún taller de cliente.</p>'}
    ${hist.length ? `<p class="nota">Instalaciones anteriores: ${hist.map(x => `${esc((PV.tallerPorId(x.tallerId) || {}).nombre || 'taller')} (${fd(x.fechaInstalacion) || 'sin fecha'} → retiro ${fd(x.retiro && x.retiro.fecha) || 'sin fecha'})`).join('; ')}.</p>` : ''}
    <h4 class="pv-h4">Servicios e incidencias</h4>${servListaHtml(sv)}`;
}
