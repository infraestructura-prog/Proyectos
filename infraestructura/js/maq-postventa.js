/* Máquinas de simulación · Postventa (Etapa 3): talleres de clientes, instalaciones y servicios.
   Todo se guarda en la aplicación (este navegador, prefijo ccs-infraestructura-v2:). No hay datos iniciales:
   no se inventan talleres, contactos ni máquinas vendidas.
   · Instalación: une una unidad existente (por su identificador) con un taller. La unidad NO se copia: deja de
     estar en stock y conserva su ficha, su kit y su historial. Al retirarla, la instalación queda cerrada en el historial.
   · Servicio: visita, servicio o incidencia ligada al identificador de la unidad y/o al taller. Un servicio no cambia
     por sí solo la ubicación ni la propiedad de la máquina.
   · Coordenadas: solo se ubican en el mapa las marcadas como confirmadas. No se geocodifican direcciones. */
import * as D from './maq-datos.js';

const PREFIJO = 'ccs-infraestructura-v2:';
export const K = { talleres: PREFIJO + 'maq-talleres', instalaciones: PREFIJO + 'maq-instalaciones', servicios: PREFIJO + 'maq-servicios' };
const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const ahora = () => new Date().toISOString();
const str = (v, n = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const fecha = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const nuevoId = p => p + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));

export const ESTADOS_VE = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital',
  'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia', 'Dependencias Federales'];
export const TIPOS_SERVICIO = ['Visita', 'Servicio', 'Incidencia'];
export const ESTADOS_SERVICIO = ['Abierto', 'Cerrado'];
// Límites aproximados de Venezuela: solo para advertir de un posible error al escribir coordenadas.
export const dentroDeVenezuela = (lat, lng) => lat >= 0.5 && lat <= 12.6 && lng >= -73.5 && lng <= -59.5;

/* ── Talleres ── */
const normContacto = c => ({ nombre: str(c.nombre, 120), cargo: str(c.cargo, 120), telefono: str(c.telefono, 60), correo: str(c.correo, 160) });
function normTaller(t) {
  const lat = Number(t.lat), lng = Number(t.lng), hay = t.lat !== '' && t.lng !== '' && t.lat !== null && t.lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  return { id: str(t.id, 40), nombre: str(t.nombre, 160), red: str(t.red, 160), estado: ESTADOS_VE.includes(t.estado) ? t.estado : '',
    municipio: str(t.municipio, 120), ciudad: str(t.ciudad, 120), direccion: str(t.direccion, 400),
    lat: hay ? lat : null, lng: hay ? lng : null, coordConfirmadas: hay && !!t.coordConfirmadas,
    contactos: (Array.isArray(t.contactos) ? t.contactos : []).map(normContacto).filter(c => c.nombre || c.telefono || c.correo).slice(0, 20),
    observaciones: str(t.observaciones, 2000), creado: str(t.creado, 40), historial: (Array.isArray(t.historial) ? t.historial : []).slice(-300) };
}
export const talleres = () => { const v = leer(K.talleres); return Array.isArray(v) ? v.map(normTaller).filter(t => t.id) : []; };
export const tallerPorId = id => talleres().find(t => t.id === id);
export function guardarTaller(datos, id) {
  const l = talleres(), i = id ? l.findIndex(t => t.id === id) : -1;
  const base = i >= 0 ? l[i] : { id: nuevoId('TL'), creado: ahora(), historial: [] };
  const t = normTaller({ ...base, ...datos, id: base.id, creado: base.creado, historial: base.historial });
  t.historial.push({ fecha: ahora(), tipo: 'edicion', nota: i >= 0 ? 'Datos del taller editados.' : 'Taller registrado.' });
  if (i >= 0) l[i] = t; else l.push(t);
  escribir(K.talleres, l); return t;
}
export function eliminarTaller(id) {
  if (instalaciones().some(x => x.activa && x.tallerId === id)) return 'El taller tiene máquinas instaladas. Registra primero su retiro.';
  if (servicios().some(s => s.tallerId === id)) return 'El taller tiene servicios registrados; se conserva por su historial.';
  escribir(K.talleres, talleres().filter(t => t.id !== id)); return '';
}

/* ── Instalaciones (trayectoria de cada unidad fuera de stock) ── */
const normInst = x => ({ id: str(x.id, 40), unidadId: str(x.unidadId, 60), tallerId: str(x.tallerId, 40), ventaId: str(x.ventaId, 20), fechaVenta: fecha(x.fechaVenta), fechaInstalacion: fecha(x.fechaInstalacion),
  garantia: str(x.garantia, 300), activa: x.activa !== false, retiro: x.retiro && typeof x.retiro === 'object' ? { fecha: fecha(x.retiro.fecha), motivo: str(x.retiro.motivo, 400) } : null,
  observaciones: str(x.observaciones, 1000), creado: str(x.creado, 40) });
export const instalaciones = () => { const v = leer(K.instalaciones); return Array.isArray(v) ? v.map(normInst).filter(x => x.id && x.unidadId) : []; };
export const instalacionActiva = unidadId => instalaciones().find(x => x.activa && x.unidadId === unidadId) || null;
export const historialInstalaciones = unidadId => instalaciones().filter(x => x.unidadId === unidadId);

/* Registra la entrega/instalación de una o varias unidades a una venta (ventaId) o a un taller (tallerId).
   Devuelve { error } o { registradas }. */
export function registrarInstalacion(unidadIds, datos) {
  const t = datos.tallerId ? tallerPorId(datos.tallerId) : null, ventaId = str(datos.ventaId, 20);
  if (!t && !ventaId) return { error: 'Elige la venta o el taller.' };
  const ids = [...new Set(unidadIds.filter(Boolean))]; if (!ids.length) return { error: 'Elige al menos una unidad.' };
  for (const id of ids) {
    const u = D.unidadPorId(id); if (!u) return { error: `La unidad ${id} no existe.` };
    const act = instalacionActiva(id); if (act) return { error: `${u.codigo || u.id} ya está entregada${act.ventaId ? ` en la venta ${act.ventaId}` : ` en ${(tallerPorId(act.tallerId) || {}).nombre || 'otro lugar'}`}.` };
    if (u.enOperacion) return { error: `${u.codigo || u.id} está en operación en nuestro taller. Retírala de operación primero.` };
  }
  const l = instalaciones();
  ids.forEach(id => l.push(normInst({ id: nuevoId('IN'), unidadId: id, tallerId: t ? t.id : '', ventaId, fechaVenta: datos.fechaVenta, fechaInstalacion: datos.fechaInstalacion,
    garantia: datos.garantia, observaciones: datos.observaciones, activa: true, creado: ahora() })));
  escribir(K.instalaciones, l);
  if (t) {
    const tl = talleres(), ti = tl.findIndex(x => x.id === t.id);
    tl[ti].historial.push({ fecha: ahora(), tipo: 'instalacion', nota: `Instalación registrada: ${ids.map(id => (D.unidadPorId(id) || {}).codigo || id).join(', ')}.` });
    escribir(K.talleres, tl);
  }
  return { registradas: ids.length };
}
/* Retiro: la instalación queda cerrada (no se borra) y la unidad vuelve a contar según la hoja. */
export function retirar(unidadId, datos) {
  const l = instalaciones(), x = l.find(i => i.activa && i.unidadId === unidadId); if (!x) return 'La unidad no tiene una instalación activa.';
  x.activa = false; x.retiro = { fecha: fecha(datos.fecha) || ahora().slice(0, 10), motivo: str(datos.motivo, 400) };
  escribir(K.instalaciones, l); return '';
}

/* ── Servicios, visitas e incidencias ── */
const normServ = s => ({ id: str(s.id, 40), tipo: TIPOS_SERVICIO.includes(s.tipo) ? s.tipo : 'Servicio', fecha: fecha(s.fecha), unidadId: str(s.unidadId, 60), tallerId: str(s.tallerId, 40), ventaId: str(s.ventaId, 20),
  estado: ESTADOS_SERVICIO.includes(s.estado) ? s.estado : 'Abierto', descripcion: str(s.descripcion, 2000), proximaAccion: str(s.proximaAccion, 600),
  responsable: str(s.responsable, 120), creado: str(s.creado, 40), historial: (Array.isArray(s.historial) ? s.historial : []).slice(-100) });
export const servicios = () => { const v = leer(K.servicios); return Array.isArray(v) ? v.map(normServ).filter(s => s.id) : []; };
export function guardarServicio(datos, id) {
  if (!datos.unidadId && !datos.tallerId && !datos.ventaId) return { error: 'Relaciona el registro con una máquina, un taller o una venta.' };
  if (!str(datos.descripcion)) return { error: 'Describe el servicio, la visita o la incidencia.' };
  const l = servicios(), i = id ? l.findIndex(s => s.id === id) : -1;
  const base = i >= 0 ? l[i] : { id: nuevoId('SV'), creado: ahora(), historial: [] };
  const s = normServ({ ...base, ...datos, id: base.id, creado: base.creado, historial: base.historial });
  s.historial.push({ fecha: ahora(), nota: i >= 0 ? `Editado · estado ${s.estado}.` : `Registrado · estado ${s.estado}.` });
  if (i >= 0) l[i] = s; else l.push(s);
  escribir(K.servicios, l); return { servicio: s };
}
export const serviciosDe = ({ unidadId, tallerId, ventaId }) => servicios().filter(s => (unidadId && s.unidadId === unidadId) || (tallerId && s.tallerId === tallerId) || (ventaId && s.ventaId === ventaId))
  .sort((a, b) => (b.fecha || b.creado).localeCompare(a.fecha || a.creado));
export const abiertos = l => l.filter(s => s.estado === 'Abierto');

/* ── Consultas para las vistas ── */
export const unidadesEnTaller = tallerId => instalaciones().filter(x => x.activa && x.tallerId === tallerId).map(x => ({ inst: x, u: D.unidadPorId(x.unidadId) })).filter(x => x.u);
export const desplegadas = () => instalaciones().filter(x => x.activa).map(x => ({ inst: x, u: D.unidadPorId(x.unidadId), t: tallerPorId(x.tallerId) })).filter(x => x.u);
// Vendidas según la hoja, pero sin instalación registrada en la aplicación: falta saber dónde están.
export const vendidasSinTaller = () => D.unidades().filter(u => u.condicionHoja === 'Vendida' && !instalacionActiva(u.id));
export const instalables = () => D.unidades().filter(u => !instalacionActiva(u.id) && !u.enOperacion);
export const unidadesEnVenta = ventaId => instalaciones().filter(x => x.activa && x.ventaId === ventaId).map(x => ({ inst: x, u: D.unidadPorId(x.unidadId) })).filter(x => x.u);
export const historialDeVenta = ventaId => instalaciones().filter(x => !x.activa && x.ventaId === ventaId);
