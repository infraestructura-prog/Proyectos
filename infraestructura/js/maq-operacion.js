/* Máquinas de simulación · Equipos en operación (Etapa 4): equipos PROPIOS instalados y usados en nuestro taller.
   No son máquinas pendientes de reparación ni se deduce que el inventario esté operando: cada equipo se registra
   explícitamente a partir de una unidad existente (no se copia). Mientras está en operación no cuenta en stock
   ni puede instalarse en un taller de cliente. Los servicios e incidencias se relacionan por el identificador
   de la unidad (los mismos registros de Postventa, sin taller de cliente). */
import * as D from './maq-datos.js';

const PREFIJO = 'ccs-infraestructura-v2:';
export const K = { operacion: PREFIJO + 'maq-operacion' };
const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const ahora = () => new Date().toISOString();
const str = (v, n = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const fecha = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');

const norm = x => ({ id: str(x.id, 40), unidadId: str(x.unidadId, 60), ubicacion: str(x.ubicacion, 200), responsable: str(x.responsable, 120),
  desde: fecha(x.desde), activa: x.activa !== false, fin: x.fin && typeof x.fin === 'object' ? { fecha: fecha(x.fin.fecha), motivo: str(x.fin.motivo, 400) } : null,
  ultimaInspeccion: fecha(x.ultimaInspeccion), proximaAccion: str(x.proximaAccion, 600), fichaTecnica: str(x.fichaTecnica, 2000),
  creado: str(x.creado, 40), historial: (Array.isArray(x.historial) ? x.historial : []).slice(-300) });
export const registros = () => { const v = leer(K.operacion); return Array.isArray(v) ? v.map(norm).filter(x => x.id && x.unidadId) : []; };
export const activos = () => registros().filter(x => x.activa);
export const deUnidad = unidadId => activos().find(x => x.unidadId === unidadId) || null;
export const historialDe = unidadId => registros().filter(x => x.unidadId === unidadId);

/* Unidades que pueden pasar a operación: existen, no están en otro registro activo ni instaladas en un cliente. */
export const disponibles = () => D.unidades().filter(u => !u.instalada && !u.enOperacion);

export function registrar(unidadId, datos) {
  const u = D.unidadPorId(unidadId); if (!u) return { error: 'Elige un equipo del inventario.' };
  if (u.instalada) return { error: `${u.codigo || u.id} está entregada a un cliente.` };
  if (deUnidad(unidadId)) return { error: `${u.codigo || u.id} ya está registrada en operación.` };
  if (!str(datos.ubicacion)) return { error: 'Indica la ubicación dentro del taller.' };
  const l = registros();
  const r = norm({ id: 'OP-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)), unidadId, ...datos, activa: true, creado: ahora(),
    historial: [{ fecha: ahora(), nota: `Puesta en operación en el taller${datos.ubicacion ? ` (${str(datos.ubicacion, 200)})` : ''}.` }] });
  l.push(r); escribir(K.operacion, l); return { registro: r };
}
export function editar(id, datos) {
  const l = registros(), r = l.find(x => x.id === id); if (!r) return 'El registro no existe.';
  if (!str(datos.ubicacion)) return 'Indica la ubicación dentro del taller.';
  const antes = { ...r };
  Object.assign(r, norm({ ...r, ...datos, id: r.id, unidadId: r.unidadId, activa: r.activa, creado: r.creado, historial: r.historial }));
  const cambios = [antes.ubicacion !== r.ubicacion && `Ubicación: ${r.ubicacion}`, antes.responsable !== r.responsable && `Responsable: ${r.responsable || 'sin asignar'}`,
    antes.proximaAccion !== r.proximaAccion && `Próxima acción: ${r.proximaAccion || '—'}`].filter(Boolean);
  r.historial.push({ fecha: ahora(), nota: cambios.length ? cambios.join(' · ') + '.' : 'Datos de operación editados.' });
  escribir(K.operacion, l); return '';
}
/* Inspección o mantenimiento: actualiza la fecha de la última y deja la nota en el historial. */
export function inspeccion(id, f, nota) {
  const l = registros(), r = l.find(x => x.id === id); if (!r) return 'El registro no existe.';
  if (!fecha(f)) return 'Indica la fecha de la inspección o el mantenimiento.';
  if (!r.ultimaInspeccion || f >= r.ultimaInspeccion) r.ultimaInspeccion = f;
  r.historial.push({ fecha: ahora(), nota: `Inspección / mantenimiento del ${f.split('-').reverse().join('/')}${nota ? `: ${str(nota, 600)}` : '.'}` });
  escribir(K.operacion, l); return '';
}
/* Fin de operación: el registro queda cerrado (no se borra); la unidad vuelve a contar según la hoja. */
export function retirar(id, f, motivo) {
  const l = registros(), r = l.find(x => x.id === id && x.activa); if (!r) return 'El registro no está activo.';
  r.activa = false; r.fin = { fecha: fecha(f) || ahora().slice(0, 10), motivo: str(motivo, 400) };
  r.historial.push({ fecha: ahora(), nota: `Retirado de operación${motivo ? `: ${str(motivo, 400)}` : '.'}` });
  escribir(K.operacion, l); return '';
}
