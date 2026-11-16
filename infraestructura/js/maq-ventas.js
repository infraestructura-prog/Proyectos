/* Máquinas de simulación · Registros de venta y postventa (primera carga de información real).
   · Los datos personales NO están en este código: se leen de privado/ventas-carga-inicial.json, que solo existe en el
     prototipo local (puerto 5181) y no se copia al sitio publicado.
   · Importación idempotente: cada venta tiene un identificador estable (VT-001…) y cada evidencia el identificador de
     su archivo de origen. Reimportar actualiza solo el «dato original» y nunca sobrescribe ediciones ni duplica filas.
   · Cada corrección queda en el historial de la venta (campo, valor anterior, valor nuevo, motivo).
   · Una venta NO equivale a una máquina física única ni a un kit completo: el equipo se vincula aparte, por conciliar. */
import * as D from './maq-datos.js';

const PREFIJO = 'ccs-infraestructura-v2:';
export const K = { ventas: PREFIJO + 'maq-ventas', evidencias: PREFIJO + 'maq-evidencias', sinClasificar: PREFIJO + 'maq-evid-sin-clasificar', meta: PREFIJO + 'maq-ventas-importacion' };
const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const ahora = () => new Date().toISOString();
const str = (v, n = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : (typeof v === 'number' ? String(v) : ''));
const fecha = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };

export const ARCHIVO_CARGA = 'privado/ventas-carga-inicial.json';
export const esLocal = () => location.hostname === 'localhost' && location.port === '5181';
export const FORMAS_PAGO = ['Contado', 'Transferencia', 'Crédito', 'Pendiente', 'Otro'];
export const ESTADOS_DOC = ['Pendiente', 'Completa según la fuente', 'Verificada'];
export const DUP = 'Serial duplicado: pendiente de conciliación';

/* Campos editables y su etiqueta (para el historial). */
export const CAMPOS = {
  dueno: 'Dueño / cliente', empresa: 'Empresa (razón social)', establecimiento: 'Establecimiento (nombre comercial)', ciudad: 'Ciudad o zona',
  estadoVE: 'Estado', direccion: 'Dirección', lat: 'Latitud', lng: 'Longitud', ubicacionConfirmada: 'Ubicación confirmada',
  telefono: 'Teléfono', telefonoVerificado: 'Teléfono verificado', formaPago: 'Forma de pago', vendedor: 'Vendedor',
  precio: 'Precio', moneda: 'Moneda', garantiaMeses: 'Garantía (meses)', inicioGarantia: 'Inicio de garantía', inicioGarantiaConfirmado: 'Inicio de garantía confirmado',
  docEstado: 'Estado de la documentación', docFaltantes: 'Documentos faltantes', docNota: 'Nota de documentación',
  unidadId: 'Unidad del inventario vinculada', serialConciliado: 'Serial conciliado', conciliacionNota: 'Nota de conciliación', notas: 'Notas internas'
};

/* Valores iniciales editables a partir del registro de origen (sin inventar: lo que falta queda vacío). */
function datosDesdeOrigen(o) {
  const d = o.documentacion || {};
  return {
    dueno: str(o.dueno, 160), empresa: str(o.empresa, 160), establecimiento: '', ciudad: str(o.ciudad, 120), estadoVE: '', direccion: '',
    lat: null, lng: null, ubicacionConfirmada: false, telefono: str(o.telefono, 60), telefonoVerificado: false,
    formaPago: str(o.formaPago, 40), vendedor: str(o.vendedor, 120), precio: num(o.precio), moneda: '',
    garantiaMeses: num(o.garantiaMeses), inicioGarantia: '', inicioGarantiaConfirmado: false,
    docEstado: ESTADOS_DOC.includes(d.estado) ? d.estado : 'Pendiente', docFaltantes: (Array.isArray(d.faltantes) ? d.faltantes : d.faltantes ? [d.faltantes] : []).join(', '),
    docNota: str(d.nota, 600), unidadId: '', serialConciliado: false, conciliacionNota: '', notas: ''
  };
}
const normOrigen = o => ({
  filaOrigen: Number(o.filaOrigen) || null, fechaVenta: fecha(o.fechaVenta), serial: str(o.serial, 80), dueno: str(o.dueno, 160), empresa: str(o.empresa, 160),
  telefono: str(o.telefono, 60), telefonoComoSeGuardo: str(o.telefonoComoSeGuardo, 60), ciudad: str(o.ciudad, 120), precio: num(o.precio),
  formaPago: str(o.formaPago, 40), vendedor: str(o.vendedor, 120), observaciones: str(o.observaciones, 600), garantiaMeses: num(o.garantiaMeses),
  condicionComercial: str(o.condicionComercial, 60), alertaOrigen: str(o.alertaOrigen, 200),
  documentacion: { estado: str((o.documentacion || {}).estado, 60), legible: str((o.documentacion || {}).legible, 400), nota: str((o.documentacion || {}).nota, 400),
    faltantes: Array.isArray((o.documentacion || {}).faltantes) ? o.documentacion.faltantes.map(x => str(x, 80)) : [] }
});

/* ── Lectura ── */
const registros = () => { const v = leer(K.ventas); return Array.isArray(v) ? v.filter(r => r && r.id && r.origen && r.datos) : []; };
export const meta = () => leer(K.meta) || null;
export const parametros = () => ({ garantiaMeses: 12, diasPorVencer: 30, ...((meta() || {}).parametros || {}) });
export const evidencias = () => { const v = leer(K.evidencias); return Array.isArray(v) ? v.filter(e => e && e.id) : []; };
export const sinClasificar = () => { const v = leer(K.sinClasificar); return Array.isArray(v) ? v.filter(e => e && e.id && !e.resuelto) : []; };
export const evidenciasDe = ventaId => evidencias().filter(e => e.ventaId === ventaId);

/* ── Importación idempotente ── */
export async function importar() {
  const r = await fetch(ARCHIVO_CARGA, { cache: 'no-store' });
  if (!r.ok) throw new Error('No se encontró el archivo privado de carga en este equipo.');
  const c = await r.json();
  const res = { nuevas: 0, actualizadas: 0, evidNuevas: 0, pendNuevos: 0 };
  // Ventas: se crean una sola vez; si ya existen, solo se refresca el dato original.
  const l = registros();
  for (const o of c.ventas || []) {
    const id = str(o.id, 20); if (!/^VT-\d{3}$/.test(id)) continue;
    const orig = normOrigen(o), i = l.findIndex(x => x.id === id);
    if (i < 0) { l.push({ id, origen: orig, datos: datosDesdeOrigen(orig), importado: ahora(), historial: [{ fecha: ahora(), nota: `Importada desde el registro de ventas (fila ${orig.filaOrigen}).` }] }); res.nuevas++; }
    else if (JSON.stringify(l[i].origen) !== JSON.stringify(orig)) { l[i].origen = orig; l[i].historial.push({ fecha: ahora(), nota: 'Dato original actualizado al reimportar. Las ediciones se conservan.' }); res.actualizadas++; }
  }
  escribir(K.ventas, l);
  // Evidencias: por identificador del archivo de origen; nunca se duplican ni se pisa la descripción editada.
  const ev = evidencias(), ids = new Set(ev.map(e => e.id));
  for (const e of c.evidencias || []) {
    if (!e.id || ids.has(e.id)) continue;
    ev.push({ id: str(e.id, 80), ventaId: str(e.ventaId, 20), nombre: str(e.nombre, 200), tipo: str(e.tipo, 40), mime: str(e.mime, 80), tam: Number(e.tam) || 0,
      fechaEnNombre: fecha(e.fechaEnNombre), subidoDrive: fecha(e.subidoDrive), carpeta: str(e.carpeta, 200), asociacion: str(e.asociacion, 80), descripcion: str(e.descripcion, 600) });
    ids.add(e.id); res.evidNuevas++;
  }
  escribir(K.evidencias, ev);
  const sc = leer(K.sinClasificar), lsc = Array.isArray(sc) ? sc : [], idsSc = new Set(lsc.map(e => e.id));
  for (const e of c.sinClasificar || []) {
    if (!e.id || idsSc.has(e.id) || ids.has(e.id)) continue;
    lsc.push({ id: str(e.id, 80), nombre: str(e.nombre, 200), tam: Number(e.tam) || 0, ventaSugerida: str(e.ventaSugerida, 20), motivo: str(e.motivo, 400), resuelto: '' });
    res.pendNuevos++;
  }
  escribir(K.sinClasificar, lsc);
  escribir(K.meta, { version: c.version || 1, fecha: ahora(), fuente: str(c.fuente, 300), parametros: c.parametros || {}, noImportados: Array.isArray(c.noImportados) ? c.noImportados : [] });
  return res;
}

/* ── Garantía calculada (no se copian los días guardados en la fuente) ── */
const sumarMeses = (iso, m) => { const [y, mo, d] = iso.split('-').map(Number); const f = new Date(Date.UTC(y, mo - 1 + m, d)); if (f.getUTCDate() !== d) f.setUTCDate(0); return f.toISOString().slice(0, 10); };
const hoyIso = () => { const h = new Date(); return new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())).toISOString().slice(0, 10); };
export function garantia(v, hoy = hoyIso()) {
  const p = parametros(), meses = v.datos.garantiaMeses ?? p.garantiaMeses;
  const confirmada = v.datos.inicioGarantiaConfirmado && fecha(v.datos.inicioGarantia);
  const inicio = confirmada ? v.datos.inicioGarantia : v.origen.fechaVenta;
  if (!inicio || !meses) return { estado: 'No calculable', motivo: !inicio ? 'Falta la fecha de venta.' : 'Falta la duración.', meses };
  const fin = sumarMeses(inicio, meses), dias = Math.round((Date.parse(fin) - Date.parse(hoy)) / 864e5);
  return { estado: dias < 0 ? 'Vencida' : dias <= p.diasPorVencer ? 'Por vencer' : 'Vigente', inicio, fin, dias, meses, base: confirmada ? 'Inicio confirmado' : 'Calculada desde la fecha de venta', confirmada: !!confirmada };
}

/* ── Vista derivada de cada venta ── */
export function ventas() {
  const l = registros();
  const cuenta = {}; l.forEach(r => { const s = r.origen.serial; if (s) cuenta[s] = (cuenta[s] || 0) + 1; });
  return l.map(r => {
    const dup = r.origen.serial && cuenta[r.origen.serial] > 1 && !r.datos.serialConciliado;
    const g = garantia(r), unidad = r.datos.unidadId ? D.unidadPorId(r.datos.unidadId) : null;
    const alertas = [];
    if (dup) alertas.push({ t: DUP, nivel: 'alta' });
    if (!r.origen.serial) alertas.push({ t: 'Sin serial consignado', nivel: 'alta' });
    if (r.datos.docEstado === 'Pendiente') alertas.push({ t: 'Documentación pendiente', nivel: 'media' });
    else if (r.datos.docEstado === 'Completa según la fuente') alertas.push({ t: 'Documentación por verificar', nivel: 'baja' });
    if (r.datos.precio === null) alertas.push({ t: 'Precio no registrado', nivel: 'baja' });
    if (r.datos.telefono && !r.datos.telefonoVerificado) alertas.push({ t: 'Teléfono por verificar', nivel: 'baja' });
    if (!r.datos.ubicacionConfirmada) alertas.push({ t: 'Ubicación exacta pendiente', nivel: 'baja' });
    if (g.estado === 'Por vencer' || g.estado === 'Vencida') alertas.push({ t: `Garantía ${g.estado.toLowerCase()}`, nivel: 'alta' });
    else if (g.estado === 'No calculable') alertas.push({ t: 'Garantía no calculable', nivel: 'media' });
    else if (!g.confirmada) alertas.push({ t: 'Inicio de garantía pendiente de confirmar', nivel: 'baja' });
    return { ...r, dup, garantia: g, unidad, alertas, nombre: r.datos.establecimiento || r.datos.empresa || r.datos.dueno || r.id };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
export const ventaPorId = id => ventas().find(v => v.id === id);
/* Unidades del inventario cuyo serial coincide con el consignado: solo sugerencias, nunca se vinculan solas. */
export const coincidenciasInventario = v => (v.origen.serial ? D.unidades().filter(u => u.serial && u.serial.replace(/\s/g, '').toUpperCase() === v.origen.serial.toUpperCase()) : []);

/* ── Edición con trazabilidad ── */
export function editar(id, cambios, motivo) {
  const l = registros(), r = l.find(x => x.id === id); if (!r) return { error: 'La venta no existe.' };
  const n = { ...r.datos };
  for (const [k, v] of Object.entries(cambios)) {
    if (!(k in CAMPOS)) continue;
    n[k] = ['lat', 'lng', 'precio', 'garantiaMeses'].includes(k) ? num(v)
      : ['ubicacionConfirmada', 'telefonoVerificado', 'inicioGarantiaConfirmado', 'serialConciliado'].includes(k) ? !!v
        : k === 'inicioGarantia' ? fecha(v) : k === 'docEstado' ? (ESTADOS_DOC.includes(v) ? v : r.datos.docEstado) : str(v, k === 'notas' || k === 'docNota' || k === 'conciliacionNota' ? 1000 : 200);
  }
  if (n.garantiaMeses !== null && (n.garantiaMeses <= 0 || n.garantiaMeses > 120)) return { error: 'La garantía debe estar entre 1 y 120 meses.' };
  if (n.precio !== null && n.precio < 0) return { error: 'El precio no puede ser negativo.' };
  if (n.ubicacionConfirmada && (n.lat === null || n.lng === null)) return { error: 'Para confirmar la ubicación escribe latitud y longitud del establecimiento.' };
  if (n.inicioGarantiaConfirmado && !n.inicioGarantia) return { error: 'Indica la fecha de inicio de garantía para marcarla como confirmada.' };
  if (n.unidadId && !D.unidadPorId(n.unidadId)) return { error: 'La unidad elegida no existe en el inventario.' };
  if (n.unidadId && registros().some(x => x.id !== id && x.datos.unidadId === n.unidadId)) return { error: 'Esa unidad ya está vinculada a otra venta.' };
  const dif = Object.keys(CAMPOS).filter(k => JSON.stringify(n[k]) !== JSON.stringify(r.datos[k]));
  if (!dif.length) return { sinCambios: true };
  const m = str(motivo, 400);
  dif.forEach(k => r.historial.push({ fecha: ahora(), campo: k, antes: r.datos[k], despues: n[k], motivo: m }));
  r.datos = n; escribir(K.ventas, l); return { ok: dif.length };
}

/* ── Evidencias ── */
export function editarEvidencia(id, descripcion) {
  const l = evidencias(), e = l.find(x => x.id === id); if (!e) return;
  e.descripcion = str(descripcion, 600); escribir(K.evidencias, l);
}
/* Resolver un archivo sin clasificar: asociarlo a una venta (decisión manual) o descartarlo como copia. Nada se borra. */
export function resolverSinClasificar(id, accion, ventaId) {
  const lsc = leer(K.sinClasificar) || [], e = lsc.find(x => x.id === id); if (!e) return 'El archivo ya no está pendiente.';
  if (accion === 'asociar') {
    if (!registros().some(r => r.id === ventaId)) return 'Elige la venta.';
    const ev = evidencias();
    if (!ev.some(x => x.id === id)) ev.push({ id, ventaId, nombre: e.nombre, tipo: 'Documento PDF', mime: 'application/pdf', tam: e.tam, fechaEnNombre: '', subidoDrive: '', carpeta: 'Carpeta general', asociacion: 'Asociado manualmente', descripcion: '' });
    escribir(K.evidencias, ev); e.resuelto = `Asociado a ${ventaId}`;
  } else e.resuelto = 'Descartado como copia';
  e.fechaResuelto = ahora(); escribir(K.sinClasificar, lsc); return '';
}

/* ── Indicadores para el Resumen (siempre sobre el total de registros) ── */
export function indicadores() {
  const vs = ventas(); if (!vs.length) return null;
  return {
    ventas: vs.length,
    dupSerial: vs.filter(v => v.dup).length,
    sinUnidad: vs.filter(v => !v.unidad).length,
    conEmpresa: vs.filter(v => v.datos.empresa || v.datos.establecimiento).length,
    sinPrecio: vs.filter(v => v.datos.precio === null).length,
    docPendiente: vs.filter(v => v.datos.docEstado === 'Pendiente').length,
    docPorVerificar: vs.filter(v => v.datos.docEstado === 'Completa según la fuente').length,
    ubicConfirmada: vs.filter(v => v.datos.ubicacionConfirmada).length,
    garCalculadas: vs.filter(v => v.garantia.estado !== 'No calculable').length,
    garConfirmadas: vs.filter(v => v.garantia.confirmada).length,
    garPorVencer: vs.filter(v => v.garantia.estado === 'Por vencer').length,
    garVencidas: vs.filter(v => v.garantia.estado === 'Vencida').length,
    evidencias: evidencias().length, sinClasificar: sinClasificar().length,
    noImportados: ((meta() || {}).noImportados || []).length
  };
}
