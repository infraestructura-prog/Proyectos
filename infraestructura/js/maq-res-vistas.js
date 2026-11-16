/* Máquinas de simulación · Resumen (entrada del módulo).
   Todo se calcula desde los registros; no hay cifras escritas a mano. Se distinguen unidades individuales, kits,
   referencias de repuestos y cantidades: nunca se suman en un «total de máquinas». Lo que todavía no se ha censado
   se muestra como «Información pendiente de levantar», no como un cero confirmado. */
import { esc, plural } from './componentes.js';
import * as D from './maq-datos.js';
import * as RP from './maq-repuestos.js';
import * as PV from './maq-postventa.js';
import * as OP from './maq-operacion.js';
import * as VT from './maq-ventas.js';
import { cabecera, estadoLectura } from './maq-vistas.js';

const PEND = 'Información pendiente de levantar';
const cifra = (n, t, ruta, extra = '') => `<li><a class="rs-cifra" href="${ruta}"><b>${n}</b><span>${t}</span>${extra ? `<small>${extra}</small>` : ''}</a></li>`;
const pendiente = (t, ruta) => `<li><a class="rs-cifra pend" href="${ruta}"><b class="mq-nd">—</b><span>${t}</span><small>${PEND}</small></a></li>`;

export function datosResumen() {
  const us = D.unidades();
  const enStock = t => us.filter(u => u.tipo === t && u.condicion === 'En stock');
  const kits = D.kitsActivos().map(k => ({ k, e: D.evaluarKit(k) }));
  const desp = PV.desplegadas(), talleres = PV.talleres(), serv = PV.servicios(), oper = OP.activos();
  const reps = RP.repuestos();
  return {
    cc: enStock('maquina-cc').length, sc: enStock('maquina-sc').length, sopCensados: us.some(u => u.tipo === 'soporte'), sop: enStock('soporte').length,
    // Kit completo DISPONIBLE: sus cuatro unidades existen y están en stock (no vendidas ni en operación).
    kitsCompletosDisp: kits.filter(x => x.e.completo && x.e.disponibilidad === 'En stock').length,
    kitsCompletos: kits.filter(x => x.e.completo).length, kitsIncompletos: kits.filter(x => !x.e.completo).length, kitsRegistrados: kits.length,
    estimacion: D.estimacionArmables(),
    repEstado: RP.R.estado, refs: reps.length, refsSin: reps.filter(r => r.existencia === 0).length, refsInc: reps.filter(RP.tieneIncidencia).length,
    maqDesp: desp.filter(x => x.u.tipo !== 'soporte').length, sopDesp: desp.filter(x => x.u.tipo === 'soporte').length,
    talleres: talleres.length,
    // Talleres atendidos: con equipos instalados o con al menos una visita, servicio o incidencia registrada.
    talleresAtendidos: talleres.filter(t => PV.unidadesEnTaller(t.id).length || serv.some(s => s.tallerId === t.id)).length,
    operacion: oper.length,
    incidenciasAbiertas: serv.filter(s => s.estado === 'Abierto' && s.tipo === 'Incidencia').length,
    serviciosPendientes: serv.filter(s => s.estado === 'Abierto' && s.tipo !== 'Incidencia').length,
    hayServicios: serv.length > 0,
    alertas: alertas(us, kits, talleres, reps)
  };
}

/* Alertas de información incompleta (seriales, composición de kits, contactos y ubicaciones), con acceso directo. */
function alertas(us, kits, talleres, reps) {
  const a = [];
  const maqSinSerial = us.filter(u => u.origen === 'hoja' && !u.serial);
  if (maqSinSerial.length) a.push({ t: `${plural(maqSinSerial.length, 'máquina sin serial', 'máquinas sin serial')}`, d: maqSinSerial.map(u => u.codigo).join(', '), ruta: '#/maquinas/stock' });
  if (!us.some(u => u.tipo === 'soporte')) a.push({ t: 'Soportes sin censar', d: 'Ningún soporte registrado: los kits no pueden completarse.', ruta: '#/maquinas/stock' });
  const inc = kits.filter(x => !x.e.completo);
  if (inc.length) a.push({ t: `${plural(inc.length, 'kit incompleto', 'kits incompletos')}`, d: inc.map(x => `${x.k.codigo} (${x.e.asignadas}/4)`).join(', '), ruta: '#/maquinas/stock' });
  const avisosKit = kits.filter(x => x.e.avisos.length);
  if (avisosKit.length) a.push({ t: 'Kits con problemas de composición', d: avisosKit.map(x => `${x.k.codigo}: ${x.e.avisos[0]}`).join(' · '), ruta: '#/maquinas/stock' });
  const genericas = us.filter(u => u.origen === 'hoja' && u.imagen);
  const urls = new Set(genericas.map(u => u.imagen));
  if (genericas.length > 1 && urls.size < genericas.length) a.push({ t: 'Fotos genéricas', d: `${genericas.length} máquinas comparten ${plural(urls.size, 'foto', 'fotos')}; no son fotos de cada unidad.`, ruta: '#/maquinas/stock' });
  const sinUbic = us.filter(u => u.condicion === 'En stock' && !u.ubicacion);
  if (sinUbic.length) a.push({ t: `${plural(sinUbic.length, 'unidad en stock sin ubicación', 'unidades en stock sin ubicación')}`, d: 'Indica dónde está cada una (almacén, estante…).', ruta: '#/maquinas/stock' });
  const sinCoord = talleres.filter(t => !t.coordConfirmadas);
  if (sinCoord.length) a.push({ t: `${plural(sinCoord.length, 'taller con ubicación pendiente', 'talleres con ubicación pendiente')}`, d: sinCoord.map(t => t.nombre).join(', '), ruta: '#/maquinas/postventa' });
  const sinCont = talleres.filter(t => !t.contactos.length);
  if (sinCont.length) a.push({ t: `${plural(sinCont.length, 'taller sin contactos', 'talleres sin contactos')}`, d: sinCont.map(t => t.nombre).join(', '), ruta: '#/maquinas/postventa' });
  const sinTaller = PV.vendidasSinTaller();
  if (sinTaller.length) a.push({ t: `${plural(sinTaller.length, 'máquina vendida en la hoja sin venta asociada', 'máquinas vendidas en la hoja sin venta asociada')}`, d: sinTaller.map(u => u.codigo).join(', '), ruta: '#/maquinas/postventa' });
  const difHoja = us.filter(u => u.diferenciaHoja);
  if (difHoja.length) a.push({ t: 'Ventas no reflejadas en la hoja', d: `${difHoja.map(u => u.codigo).join(', ')}: instaladas en un cliente, pero la hoja las indica «En stock».`, ruta: '#/maquinas/postventa' });
  const sinFoto = reps.filter(r => !r.imagen);
  if (reps.length && sinFoto.length) a.push({ t: `${plural(sinFoto.length, 'repuesto sin foto', 'repuestos sin foto')}`, d: 'Espacio reservado a la espera de las imágenes.', ruta: '#/maquinas/stock/repuestos' });
  return a;
}

/* Registros de venta: cifras totales respaldadas por los registros cargados. Lo que esos registros no permiten
   afirmar se muestra como «Información insuficiente», no como un número. */
const insuficiente = (t, motivo) => `<li><a class="rs-cifra pend" href="#/maquinas/postventa"><b class="mq-nd">—</b><span>${t}</span><small>Información insuficiente · ${motivo}</small></a></li>`;
function ventasResumenHtml() {
  const i = VT.indicadores(), R = '#/maquinas/postventa';
  if (!i) return `<section class="pj-sec rs-sec" aria-labelledby="rs-vt"><div class="sec-head"><h2 id="rs-vt">Postventa · registros de venta</h2><a class="rg-abrir" href="${R}">Ir a Postventa →</a></div>
    <ul class="mq-cifras rs-cifras">${pendiente('Registros de venta', R)}</ul></section>`;
  return `<section class="pj-sec rs-sec" aria-labelledby="rs-vt"><div class="sec-head"><h2 id="rs-vt">Postventa · registros de venta</h2><a class="rg-abrir" href="${R}">Ir a Postventa →</a></div>
    <p class="nota">Cifras totales (sin filtros). Un registro de venta no equivale a una máquina física única ni a un kit completo.</p>
    <ul class="mq-cifras rs-cifras">
      ${cifra(i.ventas, 'Registros de venta cargados', R, i.noImportados ? `${plural(i.noImportados, 'fila no importada', 'filas no importadas')} (no eran ventas)` : '')}
      ${cifra(i.dupSerial, 'Con identificación de equipo por conciliar', R, `serial duplicado · ${i.sinUnidad} sin equipos entregados registrados`)}
      ${cifra(i.conEmpresa, 'Con empresa o nombre comercial', R)}
      ${cifra(i.sinPrecio, 'Sin precio registrado', R)}
      ${cifra(i.docPendiente, 'Documentación pendiente', R, i.docPorVerificar ? `${i.docPorVerificar} completa según la fuente, por verificar` : '')}
      ${cifra(i.ubicConfirmada, 'Establecimientos con ubicación confirmada', R)}
      ${cifra(i.garCalculadas, 'Garantías calculadas', R, i.garConfirmadas < i.garCalculadas ? `desde la fecha de venta · inicio por confirmar en ${i.garCalculadas - i.garConfirmadas}` : '')}
      ${i.garPorVencer || i.garVencidas ? cifra(i.garPorVencer + i.garVencidas, 'Garantías por vencer o vencidas', R) : ''}
    </ul>
    <ul class="mq-cifras rs-cifras rs-insuf" aria-label="Indicadores sin datos suficientes">
      ${i.entregados ? cifra(i.entregados, 'Equipos del inventario entregados', R, `registrados en ${i.ventas - i.sinUnidad} de ${i.ventas} ventas`) : insuficiente('Equipos únicos desplegados', 'hay seriales duplicados y ninguna venta tiene equipos entregados registrados')}
      ${insuficiente('Kits vendidos', 'no se registró qué componentes se entregaron')}
      ${insuficiente('Máquinas operativas', '«Con dueño» es una condición comercial, no de funcionamiento')}
      ${insuficiente('Ingresos', 'ningún registro tiene precio')}
      ${(n => n ? cifra(n, 'Servicios realizados (registrados en las ventas)', R) : insuficiente('Servicios realizados', 'no hay servicios registrados en las ventas'))(PV.servicios().filter(s => s.ventaId && s.estado === 'Cerrado').length)}
    </ul></section>`;
}

export function resumenHtml() {
  const r = datosResumen(), M = D.M;
  if (M.estado === 'cargando' && !M.maquinas.length) return `${cabecera('resumen')}${estadoLectura()}<p class="vacio">Cargando…</p>`;
  return `${cabecera('resumen')}${estadoLectura()}
    <section class="pj-sec rs-sec" aria-labelledby="rs-stock"><div class="sec-head"><h2 id="rs-stock">Stock · equipos y kits</h2><a class="rg-abrir" href="#/maquinas/stock">Ir a Stock →</a></div>
      <ul class="mq-cifras rs-cifras">
        ${cifra(r.cc, 'Máquinas con chapa en stock', '#/maquinas/stock')}
        ${cifra(r.sc, 'Máquinas sin chapa en stock', '#/maquinas/stock')}
        ${r.sopCensados ? cifra(r.sop, 'Soportes en stock', '#/maquinas/stock') : pendiente('Soportes en stock', '#/maquinas/stock')}
        ${cifra(r.kitsCompletosDisp, 'Kits completos disponibles', '#/maquinas/stock', `${plural(r.kitsRegistrados, 'kit registrado', 'kits registrados')} · ${r.kitsCompletos} completos en total`)}
        ${cifra(r.kitsIncompletos, 'Kits incompletos', '#/maquinas/stock')}
      </ul>
      <p class="nota">Estimación aparte (no son kits registrados): con las unidades sueltas en stock se podrían armar ${r.estimacion.kits} kit(s) más.</p>
    </section>
    <section class="pj-sec rs-sec" aria-labelledby="rs-rep"><div class="sec-head"><h2 id="rs-rep">Stock · repuestos</h2><a class="rg-abrir" href="#/maquinas/stock/repuestos">Ir a Repuestos →</a></div>
      <ul class="mq-cifras rs-cifras">${r.repEstado === 'listo' || r.refs
        ? `${cifra(r.refs, 'Referencias de repuestos', '#/maquinas/stock/repuestos')}${cifra(r.refsSin, 'Referencias sin existencias', '#/maquinas/stock/repuestos')}${r.refsInc ? cifra(r.refsInc, 'Con incidencia o garantía', '#/maquinas/stock/repuestos') : ''}`
        : `<li class="mq-cifra-ancha"><span class="nota">${r.repEstado === 'error' ? 'No se pudieron leer los repuestos.' : 'Cargando repuestos…'}</span></li>`}</ul>
    </section>
    ${ventasResumenHtml()}
    <section class="pj-sec rs-sec" aria-labelledby="rs-op"><div class="sec-head"><h2 id="rs-op">Equipos en operación</h2><a class="rg-abrir" href="#/maquinas/operacion">Ir a Equipos en operación →</a></div>
      <ul class="mq-cifras rs-cifras">${r.operacion ? cifra(r.operacion, 'Equipos propios en operación', '#/maquinas/operacion') : pendiente('Equipos propios en operación', '#/maquinas/operacion')}</ul>
    </section>
    ${r.hayServicios ? `<section class="pj-sec rs-sec" aria-labelledby="rs-sv"><h2 id="rs-sv">Servicios e incidencias</h2>
      <ul class="mq-cifras rs-cifras">${cifra(r.incidenciasAbiertas, 'Incidencias abiertas', '#/maquinas/postventa')}${cifra(r.serviciosPendientes, 'Servicios y visitas pendientes', '#/maquinas/postventa')}</ul></section>` : ''}
    <section class="pj-sec rs-sec" aria-labelledby="rs-al"><h2 id="rs-al">Información incompleta</h2>
      ${r.alertas.length ? `<ul class="rs-alertas">${r.alertas.map(x => `<li><a href="${x.ruta}"><b>${esc(x.t)}</b></a><span>${esc(x.d)}</span></li>`).join('')}</ul>` : '<p class="vacio">No hay alertas.</p>'}
    </section>`;
}
