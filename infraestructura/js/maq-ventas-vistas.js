/* Máquinas de simulación · vistas de los registros de venta y postventa (tarjetas, tabla, mapa, ficha y formularios).
   Reglas de presentación: lo que falta se muestra como «Pendiente de levantar» o «Sin información registrada», nunca
   como cero ni como dato inventado. «Con dueño» es una condición comercial: no significa instalada ni operativa. */
import { esc, plural } from './componentes.js';
import * as D from './maq-datos.js';
import * as PV from './maq-postventa.js';
import * as V from './maq-ventas.js';
import { fdt, pend, tipoTxt } from './maq-vistas.js';

const fd = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SININFO = 'Sin información registrada';
const PENDLEV = 'Pendiente de levantar';
const mb = n => (n ? `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB` : '');
const driveUrl = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
const chipGar = g => `<span class="mq-chip ${g.estado === 'Vigente' ? 'c-stock' : g.estado === 'No calculable' ? 'c-otra' : 'c-falta'}">${esc(g.estado)}</span>`;
const chipAlerta = a => `<span class="mq-chip ${a.nivel === 'alta' ? 'c-falta vt-alta' : a.nivel === 'media' ? 'c-falta' : 'c-otra'}">${esc(a.t)}</span>`;
const precioTxt = v => (v.datos.precio === null ? pend('Precio no registrado') : `${esc(String(v.datos.precio))}${v.datos.moneda ? ` ${esc(v.datos.moneda)}` : ''}`);
const lugar = v => [v.datos.ciudad, (v.ubicacion && v.ubicacion.estado) || v.datos.estadoVE].filter(Boolean).join(' · ');
export const ALERTAS = [V.DUP, 'Documentación pendiente', 'Documentación por verificar', 'Precio no registrado', 'Teléfono por verificar', 'Ubicación exacta pendiente', 'Inicio de garantía pendiente de confirmar', 'Garantía por vencer', 'Garantía vencida', 'Garantía no calculable'];

/* Ventas que cumplen la búsqueda y los filtros. */
export function ventasFiltradas(S) {
  const tt = fold(S.vtBusca).trim().split(/\s+/).filter(Boolean);
  return V.ventas().filter(v => (!S.vtCiudad || v.datos.ciudad === S.vtCiudad) && (!S.vtDoc || v.datos.docEstado === S.vtDoc)
    && (!S.vtAlerta || v.alertas.some(a => a.t === S.vtAlerta))
    && (!tt.length || tt.every(w => fold([v.id, v.datos.dueno, v.datos.empresa, v.datos.establecimiento, v.datos.ciudad, v.origen.serial, v.datos.telefono, v.datos.vendedor, v.datos.formaPago].join(' ')).includes(w))));
}
const hayFiltro = S => !!(S.vtCiudad || S.vtDoc || S.vtAlerta || String(S.vtBusca || '').trim());

/* ── Sección de registros de venta dentro de Postventa ──
   Orden: indicadores y filtros → panel «Ubicación de las ventas» (mapa siempre visible, contraíble) → listado
   (tarjetas o tabla). Los filtros se aplican a la vez al listado y a los marcadores. */
export function ventasHtml(S, mapaEstado) {
  const todas = V.ventas();
  if (!todas.length) return `<section class="pj-sec mq-vacio" aria-labelledby="vt-t"><h2 id="vt-t">Registros de venta</h2>
    <p>Información pendiente de levantar: todavía no hay registros de venta cargados.</p>
    ${V.esLocal() ? '<p><button type="button" class="btn btn-primary" data-act="vt-importar">Importar registros de venta</button></p><p class="nota">Se leen del archivo privado de este equipo. No se publica ni se envía a ningún servicio.</p>' : ''}</section>`;
  const lista = ventasFiltradas(S), filtrado = hayFiltro(S);
  const vista = S.vtVista === 'tabla' ? 'tabla' : 'tarjetas';
  const ciudades = [...new Set(todas.map(v => v.datos.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const n = f => lista.filter(f).length;
  const m = V.meta(), sc = V.sinClasificar();
  return `<section class="pj-sec vt-sec" aria-labelledby="vt-t">
    <div class="sec-head"><h2 id="vt-t">Registros de venta</h2>${V.esLocal() ? '<button type="button" class="btn btn-sm btn-ghost" data-act="vt-importar" title="Agrega lo nuevo sin duplicar ni sobrescribir tus correcciones">Reimportar sin duplicar</button>' : ''}</div>
    <p class="nota vt-alcance" aria-live="polite">${filtrado ? `<b>Cifras filtradas:</b> ${lista.length} de ${plural(todas.length, 'registro', 'registros')}.` : `<b>Cifras totales:</b> ${plural(todas.length, 'registro de venta', 'registros de venta')}.`} Cada registro es una venta; no equivale a una máquina física única ni a un kit completo.</p>
    <ul class="mq-cifras" aria-label="Registros de venta">
      <li><b>${lista.length}</b><span>Registros de venta${filtrado ? ' (filtrados)' : ''}</span></li>
      <li><b>${n(v => v.dup)}</b><span>Con serial duplicado por conciliar</span></li>
      <li><b>${n(v => v.datos.docEstado === 'Pendiente')}</b><span>Con documentación pendiente</span></li>
    </ul>
    <div class="mq-barra">
      <label class="mq-filtro"><span class="sr-only">Buscar registro</span><input type="search" data-act="vt-busca" value="${esc(S.vtBusca || '')}" placeholder="Cliente, empresa, serial, ciudad…" autocomplete="off"></label>
      <label class="mq-filtro"><span class="sr-only">Ciudad</span><select data-act="vt-ciudad"><option value="">Todas las ciudades</option>${ciudades.map(c => `<option ${c === S.vtCiudad ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Documentación</span><select data-act="vt-doc"><option value="">Cualquier documentación</option>${V.ESTADOS_DOC.map(c => `<option ${c === S.vtDoc ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="mq-filtro"><span class="sr-only">Alerta</span><select data-act="vt-alerta"><option value="">Cualquier alerta</option>${ALERTAS.map(c => `<option ${c === S.vtAlerta ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${filtrado ? '<button type="button" class="btn btn-sm btn-ghost" data-act="vt-limpiar">Quitar filtros</button>' : ''}
    </div>
    ${panelMapaHtml(S, lista, todas, mapaEstado)}
    <div class="mq-barra vt-barra-lista">
      <h3 class="vt-h3">Ventas <small class="nota">${filtrado ? `${lista.length} de ${todas.length}` : todas.length}</small></h3>
      <span class="sp"></span>
      <div class="seg" role="group" aria-label="Vista del listado">${[['tarjetas', 'Tarjetas'], ['tabla', 'Tabla']].map(([x, t]) => `<button type="button" data-act="vt-vista" data-vista="${x}" aria-pressed="${vista === x}">${t}</button>`).join('')}</div>
    </div>
    ${!lista.length ? '<p class="vacio">Los filtros no coinciden con ningún registro de venta.</p>' : vista === 'tabla' ? tablaVentas(lista) : tarjetasVentas(lista)}
    ${sc.length ? sinClasificarHtml(sc, todas) : ''}
    ${m && m.noImportados && m.noImportados.length ? `<details class="mas"><summary>Filas de la fuente no importadas como venta (${m.noImportados.length})</summary><ul class="vt-noimp">${m.noImportados.map(x => `<li>${x.fila ? `Fila ${esc(String(x.fila))}` : 'Fila'}${x.serial ? ` · serial ${esc(x.serial)}` : ''}: ${esc(x.motivo)}</li>`).join('')}</ul></details>` : ''}
    ${m ? `<p class="nota">Última importación: ${esc(fdt(m.fecha))}.</p>` : ''}
  </section>`;
}

/* Panel del mapa. El mapa (Leaflet + OpenStreetMap) lo coloca app.js dentro de #vt-gmap-slot después de pintar. */
function mensajeMaps(e) {
  if (!e || e.fase === 'inicial' || e.fase === 'cargando') return '<p class="vt-gmap-msg">Cargando mapa…</p>';
  if (e.fase === 'error') return `<div class="vt-gmap-msg"><p><b>Mapa no disponible.</b> ${esc(e.mensaje || 'No se pudo cargar el mapa.')} Las ventas siguen disponibles en el listado.</p><p><button type="button" class="btn btn-sm" data-act="vt-mapa-reintentar">Reintentar</button></p></div>`;
  return '';
}
function panelMapaHtml(S, lista, todas, e) {
  const con = lista.filter(v => v.ubicacion && v.ubicacion.lat !== null);
  const ap = con.filter(v => v.ubicacion.precision === 'aproximada').length, ex = con.length - ap, sin = lista.length - con.length;
  const contraido = !!S.vtMapaContraido, listo = e && e.fase === 'listo';
  return `<section class="vt-mapa-panel ${contraido ? 'contraido' : ''}" aria-labelledby="vt-mapa-t">
    <div class="vt-mapa-cab">
      <h3 id="vt-mapa-t">Ubicación de las ventas</h3>
      <p class="vt-mapa-cuenta" aria-live="polite">Mostrando ${plural(lista.length, 'venta', 'ventas')}${hayFiltro(S) ? ` de ${todas.length}` : ''} · <span class="vt-ley-aprox">≈ ${ap} ${ap === 1 ? 'aproximada' : 'aproximadas'}</span> · <span class="vt-ley-exacta">✓ ${ex} ${ex === 1 ? 'confirmada' : 'confirmadas'}</span>${sin ? ` · ${sin} sin ubicación` : ''}</p>
      <span class="sp"></span>
      ${contraido || !listo ? '' : `<button type="button" class="btn btn-sm" data-act="vt-mapa-todas" ${lista.length ? '' : 'disabled'}>Ver todas las ubicaciones</button>`}
      <button type="button" class="btn btn-sm btn-ghost" data-act="vt-mapa-contraer" aria-expanded="${!contraido}" aria-controls="vt-gmap-slot">${contraido ? 'Mostrar mapa' : 'Contraer mapa'}</button>
    </div>
    ${contraido ? '' : `${ap ? '<p class="vt-mapa-aviso">Ubicaciones aproximadas según la información disponible. Los marcadores no representan todavía la dirección exacta de los talleres.</p>' : ''}
    <div class="vt-gmap-wrap">
      <div id="vt-gmap-slot" class="vt-gmap-slot ${listo ? '' : 'sin-mapa'}">${listo ? '' : mensajeMaps(e)}</div>
      ${!lista.length && listo ? '<p class="vt-gmap-vacio">Los filtros no coinciden con ningún registro de venta.</p>' : ''}
    </div>
    <ul class="vt-leyenda" aria-label="Leyenda de precisión">
      <li><span class="vt-pin vt-pin-aprox"><span class="vt-pin-ico" aria-hidden="true">≈</span><b>VT</b><small>Aprox.</small></span> Aproximada: punto representativo de la ciudad o zona.</li>
      <li><span class="vt-pin vt-pin-exacta"><span class="vt-pin-ico" aria-hidden="true">✓</span><b>VT</b><small>Exacta</small></span> Exacta: entrada del taller, confirmada por una persona.</li>
    </ul>
    <p class="nota vt-mapa-tactil">En el celular, mueve y acerca el mapa con dos dedos o con los botones + y −; con un dedo se desplaza la página.</p>
    <p class="nota vt-mapa-guardado">Las ubicaciones se guardan en este navegador y se comparten con el equipo al pulsar «Sincronizar».</p>`}
  </section>`;
}
/* Ventana del marcador: sin teléfonos ni otros datos personales. */
export const popupMapaHtml = v => {
  const u = v.ubicacion;
  return `<div class="vt-info"><p class="vt-info-id">${esc(v.id)}</p><b>${esc(v.nombre)}</b>
    <p>${esc([u.ciudad || v.datos.ciudad, u.estado].filter(Boolean).join(', ')) || 'Ciudad pendiente'}</p>
    <p>Serial consignado: <code>${esc(v.origen.serial || '—')}</code>${v.dup ? ' <small>(duplicado, por conciliar)</small>' : ''}</p>
    <p>Precisión: <b>${u.precision === 'exacta' ? '✓ Exacta confirmada' : '≈ Aproximada'}</b></p>
    <div class="vt-info-acc"><button type="button" data-act="vt-ficha" data-vid="${esc(v.id)}">Ver ficha</button><button type="button" data-act="vt-ubicacion" data-vid="${esc(v.id)}">Editar ubicación</button></div></div>`;
};

const PIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>';
function tarjetasVentas(l) {
  // Tarjeta limpia: solo identificación, ciudad, serial, fecha y garantía. Los avisos se ven en la ficha.
  return `<ul class="mq-grid pv-grid vt-grid">${l.map(v => `<li class="mq-card pv-card vt-card" data-vid="${esc(v.id)}"><div class="mq-card-body">
      <p class="mq-tipo">${esc(v.id)} · Venta ${v.datos.empresa || v.datos.establecimiento ? '· Empresa' : '· Cliente'}</p>
      ${v.ubicacion ? `<button type="button" class="vt-ubicar" data-act="vt-localizar" data-vid="${esc(v.id)}" aria-label="Ubicar ${esc(v.id)} en el mapa" title="Ubicar en el mapa">${PIN_SVG}</button>` : ''}
      <h3><button type="button" class="mq-link" data-act="vt-ficha" data-vid="${esc(v.id)}">${esc(v.nombre)}</button></h3>
      <dl class="vt-dl">
        <div><dt>Ciudad o zona</dt><dd>${esc(lugar(v)) || pend(PENDLEV)}</dd></div>
        <div><dt>Serial consignado</dt><dd><code>${esc(v.origen.serial) || '—'}</code></dd></div>
        <div><dt>Fecha de venta</dt><dd>${fd(v.origen.fechaVenta) || pend('Sin fecha')}</dd></div>
        <div><dt>Garantía</dt><dd>${chipGar(v.garantia)}${v.garantia.fin ? ` <small class="nota">hasta ${fd(v.garantia.fin)}${v.garantia.confirmada ? '' : ' · estimada'}</small>` : ''}</dd></div>
      </dl>
    </div></li>`).join('')}</ul>`;
}
function tablaVentas(l) {
  return `<div class="tabla-wrap"><table class="map-tabla mq-tabla vt-tabla"><thead><tr><th>Registro</th><th>Cliente / empresa</th><th>Ciudad</th><th>Serial consignado</th><th>Fecha de venta</th><th>Pago</th><th>Precio</th><th>Documentación</th><th>Garantía</th><th>Ubicación</th></tr></thead><tbody>
    ${l.map(v => `<tr${v.dup ? ' class="vt-dup"' : ''}><td>${esc(v.id)}</td>
      <td><button type="button" class="mq-link" data-act="vt-ficha" data-vid="${esc(v.id)}"><b>${esc(v.nombre)}</b></button>${v.nombre !== v.datos.dueno && v.datos.dueno ? `<br><small class="nota">${esc(v.datos.dueno)}</small>` : ''}</td>
      <td>${esc(lugar(v)) || '—'}</td><td><code>${esc(v.origen.serial) || '—'}</code>${v.dup ? '<br><small class="vt-txt-alerta">Duplicado, por conciliar</small>' : ''}</td>
      <td>${fd(v.origen.fechaVenta) || '—'}</td><td>${esc(v.datos.formaPago) || '—'}</td><td>${precioTxt(v)}</td>
      <td>${esc(v.datos.docEstado)}</td><td>${chipGar(v.garantia)}${v.garantia.fin ? `<br><small class="nota">${fd(v.garantia.fin)}</small>` : ''}</td>
      <td>${v.ubicacion ? `${chipPrec(v.ubicacion)} <button type="button" class="btn btn-sm btn-ghost" data-act="vt-localizar" data-vid="${esc(v.id)}">Ubicar</button>` : pend('Sin ubicación')}</td></tr>`).join('')}</tbody></table></div>`;
}
export const chipPrec = u => (u.precision === 'exacta' ? '<span class="mq-chip c-stock">✓ Exacta</span>' : '<span class="mq-chip c-falta">≈ Aproximada</span>');

function sinClasificarHtml(sc, todas) {
  const nom = id => (todas.find(v => v.id === id) || {}).nombre || id;
  return `<details class="mas vt-sinclas"><summary>Archivos pendientes de clasificación (${sc.length})</summary>
    <p class="nota">Están en la carpeta general y no en la carpeta de un cliente. No se asocian hasta que lo decidas.</p>
    <ul class="vt-evid">${sc.map(e => `<li><b>${esc(e.nombre)}</b> <small class="nota">${mb(e.tam)}</small><br><small>${esc(e.motivo)}</small>
      <div class="vt-acciones"><a class="btn btn-sm btn-ghost" href="${driveUrl(e.id)}" target="_blank" rel="noopener noreferrer">Abrir original</a>
      ${e.ventaSugerida ? `<button type="button" class="btn btn-sm" data-act="vt-clasificar" data-eid="${esc(e.id)}" data-accion="asociar" data-vid="${esc(e.ventaSugerida)}">Asociar a ${esc(nom(e.ventaSugerida))} (${esc(e.ventaSugerida)})</button>` : ''}
      <button type="button" class="btn btn-sm btn-ghost" data-act="vt-clasificar" data-eid="${esc(e.id)}" data-accion="descartar">Es una copia: no asociar</button></div></li>`).join('')}</ul></details>`;
}

/* ── Ficha de la venta (6 secciones) ── */
const fila = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
const val = (x, t = SININFO) => (x === null || x === undefined || x === '' ? pend(t) : esc(String(x)));
function telefonoHtml(v) {
  const t = v.datos.telefono; if (!t) return pend(SININFO);
  const dig = t.replace(/\D/g, '');
  const notas = [];
  if (!v.datos.telefonoVerificado) notas.push('Por verificar');
  if (dig.length !== 10) notas.push(`${dig.length} dígitos: formato distinto al de los demás registros`);
  if (v.origen.telefonoComoSeGuardo && v.origen.telefonoComoSeGuardo !== v.origen.telefono && t === v.origen.telefono) notas.push(`en la fuente quedó guardado como número (${v.origen.telefonoComoSeGuardo})`);
  return `<span class="vt-tel">${esc(t)}</span>${notas.length ? ` <small class="vt-txt-alerta">${esc(notas.join(' · '))}</small>` : ' <span class="mq-chip c-stock">Verificado</span>'}`;
}
export function fichaVentaHtml(v) {
  const g = v.garantia, ev = V.evidenciasDe(v.id), sv = PV.serviciosDe({ ventaId: v.id }), coinc = V.coincidenciasInventario(v);
  const p = V.parametros(), o = v.origen, d = v.datos;
  const porTipo = {}; ev.forEach(e => { porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1; });
  const cambios = v.historial.filter(h => h.campo);
  return `<div class="dlg-head"><div><p class="dlg-kicker">Registro de venta · ${esc(v.id)}${o.filaOrigen ? ` · fila ${o.filaOrigen} de la fuente` : ''}</p><h2 id="dlg-titulo">${esc(v.nombre)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha vt-ficha">
      ${v.alertas.length ? `<p class="vt-alertas">${v.alertas.map(chipAlerta).join(' ')}</p>` : ''}
      <h3 class="rp-h">1 · Cliente y establecimiento</h3>
      <dl class="org-dl">
        ${fila('Dueño / cliente', val(d.dueno))}
        ${fila('Empresa (razón social)', val(d.empresa))}
        ${fila('Establecimiento (nombre comercial)', val(d.establecimiento, PENDLEV))}
        ${d.red ? fila('Red o marca del taller', esc(d.red)) : ''}
        ${fila('Teléfono del dueño', telefonoHtml(v))}
        ${fila('Contactos', d.contactos.length ? `<ul class="pv-contactos">${d.contactos.map(c => `<li><b>${esc(c.nombre || 'Sin nombre')}</b>${c.cargo ? ` · ${esc(c.cargo)}` : ''}${c.telefono ? `<br>${esc(c.telefono)}` : ''}${c.correo ? `<br><a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a>` : ''}</li>`).join('')}</ul>` : pend(SININFO))}
        ${fila('Ciudad o zona', val(d.ciudad, PENDLEV))}
        ${ubicacionFilas(v)}
      </dl>
      <h3 class="rp-h">2 · Equipo y venta</h3>
      <dl class="org-dl">
        ${fila('Serial consignado', `<code>${esc(o.serial) || '—'}</code>${v.dup ? ` <span class="mq-chip c-falta vt-alta">${esc(V.DUP)}</span>` : d.serialConciliado ? ' <span class="mq-chip c-stock">Conciliado</span>' : ''}`)}
        ${v.dup ? fila('Otros registros con el mismo serial', V.ventas().filter(x => x.id !== v.id && x.origen.serial === o.serial).map(x => `<button type="button" class="mq-link" data-act="vt-ficha" data-vid="${esc(x.id)}">${esc(x.id)} · ${esc(x.nombre)}</button>`).join(', ')) : ''}
        ${fila('Equipos entregados', v.entregados.length ? `<ul class="vt-entregados">${v.entregados.map(({ u, inst }) => `<li><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}">${esc(u.codigo || u.id)}</button>
            <small class="nota">${esc(tipoTxt(u))}${u.serial ? ` · serial ${esc(u.serial)}` : ''}${inst.fechaInstalacion ? ` · desde ${fd(inst.fechaInstalacion)}` : ''}</small>
            <button type="button" class="btn btn-sm btn-ghost" data-vt="retirar" data-uid="${esc(u.id)}">Registrar retiro</button></li>`).join('')}</ul>`
          : `${pend('Pendiente de conciliar: no se asume un kit completo')}${coinc.length ? `<br><small class="nota">En el inventario ${coinc.length === 1 ? 'hay una unidad' : `hay ${coinc.length} unidades`} con ese serial (${coinc.map(u => esc(u.codigo || u.id)).join(', ')}). No se vinculan automáticamente.</small>` : ''}`)}
        ${historialEntregas(v)}
        ${d.conciliacionNota ? fila('Nota de conciliación', `<span class="pre">${esc(d.conciliacionNota)}</span>`) : ''}
        ${fila('Condición comercial', `${esc(o.condicionComercial || '—')} <small class="nota">(no indica instalación ni funcionamiento)</small>`)}
        ${fila('Fecha de venta', fd(o.fechaVenta) || pend('Sin fecha'))}
        ${fila('Forma de pago', val(d.formaPago))}
        ${fila('Vendedor', val(d.vendedor))}
        ${fila('Precio', precioTxt(v))}
        ${fila('Observaciones de la fuente', o.observaciones ? `«${esc(o.observaciones)}»` : pend(SININFO))}
      </dl>
      <h3 class="rp-h">3 · Garantía</h3>
      <dl class="org-dl">
        ${fila('Estado', `${chipGar(g)}${g.estado === 'No calculable' ? ` <small class="nota">${esc(g.motivo)}</small>` : ''}`)}
        ${g.inicio ? fila('Base del cálculo', `${esc(g.base)}${g.confirmada ? '' : ' · <span class="vt-txt-alerta">Inicio de garantía pendiente de confirmar</span>'}`) : ''}
        ${fila('Duración', `${g.meses ? `${g.meses} meses` : '—'} <small class="nota">${d.garantiaMeses !== null ? 'según el registro' : `predeterminada (${p.garantiaMeses} meses)`}</small>`)}
        ${g.inicio ? fila('Desde', fd(g.inicio)) + fila('Hasta', fd(g.fin)) + fila('Días restantes', `${g.dias < 0 ? `vencida hace ${-g.dias}` : g.dias} <small class="nota">calculados hoy; «Por vencer» con ${p.diasPorVencer} días o menos</small>`) : ''}
      </dl>
      <h3 class="rp-h">4 · Documentación</h3>
      <dl class="org-dl">
        ${fila('Estado', `${esc(d.docEstado)}${d.docEstado === 'Completa según la fuente' ? ' <small class="nota">(no auditada por la aplicación)</small>' : ''}`)}
        ${o.documentacion.legible ? fila('Resumen', esc(o.documentacion.legible)) : ''}
        ${fila('Documentos faltantes', d.docFaltantes ? esc(d.docFaltantes) : d.docEstado === 'Pendiente' ? pend('Detalle pendiente de levantar') : '—')}
        ${fila('Nota original', o.observaciones ? `«${esc(o.observaciones)}»` : pend(SININFO))}
        ${d.docNota ? fila('Nota', esc(d.docNota)) : ''}
      </dl>
      <h3 class="rp-h">5 · Evidencias</h3>
      ${ev.length ? `<p class="nota">${Object.entries(porTipo).map(([t, n]) => plural(n, { Video: 'video', Foto: 'foto', 'Documento PDF': 'documento PDF' }[t] || 'archivo', { Video: 'videos', Foto: 'fotos', 'Documento PDF': 'documentos PDF' }[t] || 'archivos')).join(' · ')}. Asociadas por estar en la carpeta del cliente. Un video o una foto no prueban por sí solos una instalación, una reparación ni una prueba.</p>
        <details class="mas" ${ev.length <= 6 ? 'open' : ''}><summary>Ver archivos (${ev.length})</summary><ul class="vt-evid">${ev.sort((a, b) => (a.tipo + a.nombre).localeCompare(b.tipo + b.nombre, 'es', { numeric: true })).map(e => `<li>
          <span class="mq-chip c-otra">${esc(e.tipo)}</span> <b>${esc(e.nombre)}</b> <small class="nota">${[mb(e.tam), e.fechaEnNombre ? `fecha en el nombre: ${fd(e.fechaEnNombre)}` : '', e.asociacion].filter(Boolean).map(esc).join(' · ')}</small>
          ${e.descripcion ? `<br><small>${esc(e.descripcion)}</small>` : ''}<br><small class="nota">${esc(e.carpeta)}</small>
          · <a href="${driveUrl(e.id)}" target="_blank" rel="noopener noreferrer">Abrir original</a></li>`).join('')}</ul></details>`
        : `<p class="vacio">${SININFO}.</p>`}
      <h3 class="rp-h">6 · Servicios e incidencias</h3>
      ${sv.length ? `<ul class="pv-serv">${sv.map(s => `<li class="${s.estado === 'Abierto' ? 'abierto' : ''}"><span class="mq-chip ${s.tipo === 'Incidencia' ? 'c-falta' : 'c-otra'}">${esc(s.tipo)}</span> <b>${esc(fd(s.fecha) || 'Sin fecha')}</b> · ${esc(s.estado)}
        <p>${esc(s.descripcion)}</p>${s.proximaAccion ? `<p class="nota">Próxima acción: ${esc(s.proximaAccion)}</p>` : ''}${s.responsable ? `<p class="nota">Responsable: ${esc(s.responsable)}</p>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" data-vt="editar-servicio" data-sid="${esc(s.id)}">Editar</button></li>`).join('')}</ul>` : `<p class="vacio">${SININFO}.</p>`}
      ${d.notas ? `<h3 class="rp-h">Notas internas</h3><p class="pre">${esc(d.notas)}</p>` : ''}
      <details class="mas"><summary>Datos originales de la fuente</summary><dl class="org-dl vt-orig">
        ${fila('Dueño', esc(o.dueno) || '—')}${fila('Empresa', esc(o.empresa) || '—')}${fila('Teléfono', esc(o.telefono) || '—')}${fila('Ciudad', esc(o.ciudad) || '—')}
        ${fila('Forma de pago', esc(o.formaPago) || '—')}${fila('Vendedor', esc(o.vendedor) || '—')}${fila('Precio', o.precio === null ? 'vacío' : esc(String(o.precio)))}
        ${fila('Garantía', o.garantiaMeses ? `${o.garantiaMeses} meses` : 'vacío')}${o.alertaOrigen ? fila('Alerta en la fuente', esc(o.alertaOrigen)) : ''}
      </dl><p class="nota">La fecha de fin de garantía y los días restantes guardados en la fuente no se copian: se calculan aquí.</p></details>
      <details class="mas"><summary>Historial de cambios (${cambios.length})</summary>${cambios.length || v.historial.length ? `<ol class="hist">${[...v.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${h.campo
        ? `<b>${esc(V.CAMPOS[h.campo] || h.campo)}</b>: ${esc(fmt(h.antes))} → ${esc(fmt(h.despues))}${h.motivo ? ` <small class="nota">(${esc(h.motivo)})</small>` : ''}` : esc(h.nota)}</li>`).join('')}</ol>` : '<p class="vacio">Sin cambios.</p>'}</details>
    </div>
    <div class="dlg-foot"><button type="button" class="btn btn-ghost" data-vt="servicio">+ Servicio o incidencia</button><button type="button" class="btn btn-ghost" data-vt="entregar">+ Equipos entregados</button><span class="sp"></span>
      <button type="button" class="btn btn-primary" data-vt="editar">Corregir o completar datos</button></div>`;
}
const fmt = x => (x === null || x === undefined || x === '' ? 'vacío' : x === true ? 'sí' : x === false ? 'no'
  : Array.isArray(x) ? (x.length ? x.map(c => c.nombre || c.telefono || c.correo || '').join(', ') : 'ninguno') : String(x));
const historialEntregas = v => { const h = PV.historialDeVenta(v.id); return h.length ? fila('Entregas anteriores', h.map(x => `${esc((D.unidadPorId(x.unidadId) || {}).codigo || x.unidadId)} (retirada ${fd(x.retiro && x.retiro.fecha) || 'sin fecha'}${x.retiro && x.retiro.motivo ? `: ${esc(x.retiro.motivo)}` : ''})`).join('; ')) : ''; };

/* ── Registrar equipos del inventario entregados en esta venta (salen de Stock y conservan su ficha) ── */
export function formEntregaHtml(v) {
  const libres = PV.instalables().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  const kitsLibres = D.kitsActivos().filter(k => Object.values(k.posiciones).some(id => id && libres.some(u => u.id === id)));
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(v.id)} · ${esc(v.nombre)}</p><h2 id="dlg-titulo">Registrar equipos entregados</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Marca las unidades del inventario que recibió este cliente. Dejan de contar en Stock y conservan su ficha, su kit y su historial. Serial consignado en la venta: <code>${esc(v.origen.serial) || '—'}</code>.</p>
      ${kitsLibres.length ? `<label class="fld"><span>Marcar las unidades de un kit (opcional)</span><select data-pv-kit><option value="">—</option>${kitsLibres.map(k => `<option value="${esc(k.id)}">Kit ${esc(k.codigo)} (${D.evaluarKit(k).asignadas} de 4 unidades)</option>`).join('')}</select></label>` : ''}
      <fieldset class="fld"><legend>Unidades entregadas <b class="req">*</b></legend>
        <div class="pv-unidades">${libres.map(u => `<label class="check"><input type="checkbox" name="unidad" value="${esc(u.id)}" data-kit="${esc((D.kitDeUnidad(u.id) || {}).id || '')}"> ${esc(u.codigo || u.id)} <small class="nota">${esc(tipoTxt(u))}${u.serial ? ` · ${esc(u.serial)}` : ''}${u.serial && v.origen.serial && u.serial.toUpperCase() === v.origen.serial.toUpperCase() ? ' · <b>coincide con el serial de la venta</b>' : ''}</small></label>`).join('') || '<p class="vacio">No hay unidades disponibles en el inventario.</p>'}</div>
        <small class="err" data-err-unidad hidden>Marca al menos una unidad.</small></fieldset>
      <label class="fld"><span>Fecha de entrega o instalación</span><input type="date" name="fechaInstalacion"></label>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="2" maxlength="1000"></textarea></label>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar</button></div>
  </form>`;
}
const contactoFila = (c = {}) => `<fieldset class="pv-contacto" data-contacto><legend class="sr-only">Contacto</legend>
  <input name="c-nombre" maxlength="120" value="${esc(c.nombre || '')}" placeholder="Nombre" autocomplete="off" aria-label="Nombre del contacto">
  <input name="c-cargo" maxlength="120" value="${esc(c.cargo || '')}" placeholder="Cargo" autocomplete="off" aria-label="Cargo">
  <input name="c-telefono" maxlength="60" value="${esc(c.telefono || '')}" placeholder="Teléfono" autocomplete="off" inputmode="tel" aria-label="Teléfono">
  <input name="c-correo" maxlength="160" value="${esc(c.correo || '')}" placeholder="Correo" autocomplete="off" type="email" aria-label="Correo">
  <button type="button" class="icon-btn sm" data-vt-quitar-contacto aria-label="Quitar contacto">×</button></fieldset>`;
export const contactoFilaVentaHtml = contactoFila;

/* ── Formulario de corrección (cada cambio queda en el historial con su motivo) ── */
export function formVentaHtml(v) {
  const d = v.datos;
  const inp = (n, t, extra = '') => `<label class="fld"><span>${t}</span><input name="${n}" value="${esc(d[n] === null ? '' : String(d[n]))}" autocomplete="off" ${extra}></label>`;
  const chk = (n, t) => `<label class="check"><input type="checkbox" name="${n}" ${d[n] ? 'checked' : ''}> ${t}</label>`;
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(v.id)} · corregir o completar</p><h2 id="dlg-titulo">${esc(v.nombre)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">El dato original de la fuente se conserva aparte. Deja vacío lo que no sepas: no se rellenará con supuestos.</p>
      <fieldset class="fld"><legend>Cliente y establecimiento</legend>
        <div class="fld-row">${inp('dueno', 'Dueño / cliente', 'maxlength="160"')}${inp('empresa', 'Empresa (razón social)', 'maxlength="160"')}</div>
        <div class="fld-row">${inp('establecimiento', 'Establecimiento (nombre comercial)', 'maxlength="160"')}${inp('red', 'Red o marca del taller', 'maxlength="160" placeholder="Solo si pertenece a una red o franquicia"')}</div>
        ${inp('telefono', 'Teléfono del dueño', 'maxlength="60" inputmode="tel"')}
        ${chk('telefonoVerificado', 'Teléfono verificado con el cliente')}
        <fieldset class="fld"><legend>Contactos del establecimiento</legend><div data-contactos>${(d.contactos.length ? d.contactos : [{}]).map(c => contactoFila(c)).join('')}</div>
          <button type="button" class="btn btn-sm" data-vt-agregar-contacto>+ Agregar contacto</button></fieldset>
        ${inp('ciudad', 'Ciudad o zona (dato comercial)', 'maxlength="120"')}
        <p class="nota">La dirección, el estado y el punto en el mapa se cambian con «Editar ubicación» en la ficha.</p>
      </fieldset>
      <fieldset class="fld"><legend>Equipo y venta</legend>
        ${chk('serialConciliado', 'Serial conciliado (se resolvió la duplicidad o se confirmó el equipo)')}
        <label class="fld"><span>Nota de conciliación</span><textarea name="conciliacionNota" rows="2" maxlength="1000">${esc(d.conciliacionNota)}</textarea></label>
        <div class="fld-row">
          <label class="fld"><span>Forma de pago</span><select name="formaPago"><option value="">Sin dato</option>${[...new Set([...V.FORMAS_PAGO, d.formaPago].filter(Boolean))].map(f => `<option ${f === d.formaPago ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
          ${inp('vendedor', 'Vendedor', 'maxlength="120"')}</div>
        <div class="fld-row">${inp('precio', 'Precio', 'inputmode="decimal" placeholder="Vacío = no registrado"')}${inp('moneda', 'Moneda', 'maxlength="10" placeholder="USD, Bs…"')}</div>
      </fieldset>
      <fieldset class="fld"><legend>Garantía</legend>
        <div class="fld-row">${inp('garantiaMeses', 'Duración (meses)', 'inputmode="numeric"')}${inp('inicioGarantia', 'Inicio de garantía', 'type="date"')}</div>
        ${chk('inicioGarantiaConfirmado', 'Inicio de garantía confirmado (si no, se calcula desde la fecha de venta)')}
      </fieldset>
      <fieldset class="fld"><legend>Documentación</legend>
        <label class="fld"><span>Estado</span><select name="docEstado">${V.ESTADOS_DOC.map(e => `<option ${e === d.docEstado ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
        ${inp('docFaltantes', 'Documentos faltantes', 'maxlength="200"')}
        <label class="fld"><span>Nota</span><textarea name="docNota" rows="2" maxlength="1000">${esc(d.docNota)}</textarea></label>
      </fieldset>
      <label class="fld"><span>Notas internas</span><textarea name="notas" rows="2" maxlength="1000">${esc(d.notas)}</textarea></label>
      <label class="fld"><span>Motivo o fuente del cambio</span><input name="motivo" maxlength="400" autocomplete="off" placeholder="Ej.: confirmado por teléfono con el cliente"></label>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

/* ── Ubicación en la ficha ── */
function ubicacionFilas(v) {
  const u = v.ubicacion;
  if (!u) return fila('Ubicación', `${pend('Sin ubicación')} <button type="button" class="btn btn-sm" data-vt="ubicacion">Editar ubicación</button>`);
  const hist = u.historial || [];
  return `${fila('Ubicación', `${chipPrec(u)} <button type="button" class="btn btn-sm" data-vt="ubicacion">Editar ubicación</button>`)}
    ${fila('Referencia utilizada', esc(u.referencia) || pend(SININFO))}
    ${u.nota ? fila('Nota', esc(u.nota)) : ''}
    ${fila('Estado', val(u.estado, PENDLEV))}
    ${fila('Dirección exacta', val(u.direccion, 'Pendiente'))}
    ${fila('Coordenadas', u.lat !== null ? `${u.lat}, ${u.lng}` : pend('Pendiente'))}
    ${u.enlace ? fila('Enlace de Google Maps', `<a href="${esc(u.enlace)}" target="_blank" rel="noopener noreferrer">Abrir el enlace guardado</a>${u.enlaceNota ? `<br><small class="nota">${esc(u.enlaceNota)}</small>` : ''}`) : ''}
    ${fila('Actualizada', `${esc(fdt(u.actualizado)) || '—'} <small class="nota">${esc(u.origen || '')}${u.autor ? ` · ${esc(u.autor)}` : ''}</small>`)}
    ${hist.length ? fila('Ubicaciones anteriores', `<details><summary>${hist.length}</summary><ol class="hist">${[...hist].reverse().map(h => `<li><span class="nota">${esc(fdt(h.reemplazada))}</span> ${h.precision === 'exacta' ? '✓ exacta' : '≈ aproximada'} · ${esc(h.referencia || '')} (${h.lat}, ${h.lng})${h.enlace ? ' · con enlace' : ''}</li>`).join('')}</ol></details>`) : ''}`;
}

/* ── Editor de ubicación ──
   Mapa de vista previa con marcador arrastrable (solo aquí), clic para colocar el punto, enlace de Google Maps (solo referencia)
   y coordenadas manuales. La precisión no tiene valor por defecto: hay que confirmar qué representa el punto. */
export function formUbicacionHtml(v, mapaListo) {
  const u = v.ubicacion || {}, ref = u.referencia || '';
  return `<form class="dlg-form vt-ub-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(v.id)} · ${esc(v.nombre)}</p><h2 id="dlg-titulo">Editar ubicación</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Ubicación guardada: ${u.lat !== undefined && u.lat !== null ? `${chipPrec(u)} ${esc(ref)} (${u.lat}, ${u.lng})` : 'ninguna'}. Nada cambia hasta que pulses «Guardar ubicación».</p>
      <label class="fld"><span>Enlace de Google Maps</span>
        <div class="vt-enlace"><input name="enlace" maxlength="2000" value="${esc(u.enlace || '')}" placeholder="https://www.google.com/maps/place/…" autocomplete="off" inputmode="url"><button type="button" class="btn btn-sm" data-ub="leer">Leer enlace</button></div>
        <small class="hint">Se guarda como referencia (no se consulta a Google). Si el enlace trae las coordenadas del lugar, se proponen en el mapa para que las confirmes; si no, coloca el punto a mano. También puedes escribir «latitud, longitud».</small></label>
      <div class="vt-enlace-msg" data-enlace-msg aria-live="polite"></div>
      <div class="vt-ub-mapa" data-ub-mapa>${mapaListo ? '' : '<p class="vt-gmap-msg">No se pudo cargar el mapa. Puedes escribir las coordenadas a mano.</p>'}</div>
      <p class="hint">${mapaListo ? 'Haz clic en el mapa para colocar el punto o arrastra el marcador. Acércate hasta ver la calle.' : ''}</p>
      <div class="fld-row">
        <label class="fld"><span>Latitud</span><input name="lat" inputmode="decimal" value="${u.lat ?? ''}" autocomplete="off" placeholder="10.4806"></label>
        <label class="fld"><span>Longitud</span><input name="lng" inputmode="decimal" value="${u.lng ?? ''}" autocomplete="off" placeholder="-66.9036"></label>
      </div>
      <label class="fld"><span>Dirección</span><input name="direccion" maxlength="300" value="${esc(u.direccion || '')}" autocomplete="off" placeholder="Calle, sector, punto de referencia"></label>
      <div class="fld-row">
        <label class="fld"><span>Ciudad o zona</span><input name="ciudad" maxlength="120" value="${esc(u.ciudad || v.datos.ciudad || '')}" autocomplete="off"></label>
        <label class="fld"><span>Estado</span><select name="estado"><option value="">Sin definir</option>${PV.ESTADOS_VE.map(e => `<option ${e === u.estado ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
      </div>
      <label class="fld"><span>Referencia utilizada</span><input name="referencia" maxlength="300" value="${esc(ref)}" autocomplete="off" placeholder="Ej.: entrada del taller, verificada con el cliente"></label>
      <fieldset class="fld vt-precision"><legend>¿Qué representa este punto? <b class="req">*</b></legend>
        <label class="check"><input type="radio" name="precision" value="aproximada"> <span><b>≈ Referencia aproximada</b>: zona o ciudad; no es la entrada del taller.</span></label>
        <label class="check"><input type="radio" name="precision" value="exacta"> <span><b>✓ Ubicación exacta del taller</b>: confirmé que el punto es el establecimiento.</span></label>
        <small class="hint">Pegar un enlace no confirma la ubicación: elige tú la opción que corresponde.</small>
      </fieldset>
      <p class="nota">Se guarda en este navegador (la ubicación anterior queda en el historial) y se comparte con el equipo al pulsar «Sincronizar».</p>
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar ubicación</button></div>
  </form>`;
}
