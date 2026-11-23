/* Máquinas de simulación · Registros de venta y postventa (primera carga de información real).
   · Los datos personales NO están en este código: se leen de privado/ventas-carga-inicial.json, que solo existe en el
     prototipo local (puerto 5181) y no se copia al sitio publicado.
   · Importación idempotente: cada venta tiene un identificador estable (VT-001…) y cada evidencia el identificador de
     su archivo de origen. Reimportar actualiza solo el «dato original» y nunca sobrescribe ediciones ni duplica filas.
   · Cada corrección queda en el historial de la venta (campo, valor anterior, valor nuevo, motivo).
   · Una venta NO equivale a una máquina física única ni a un kit completo: el equipo se vincula aparte, por conciliar. */
import * as D from './maq-datos.js';
import * as PV from './maq-postventa.js';

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
  dueno: 'Dueño / cliente', empresa: 'Empresa (razón social)', establecimiento: 'Establecimiento (nombre comercial)', red: 'Red o marca del taller', contactos: 'Contactos', ciudad: 'Ciudad o zona',
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
    dueno: str(o.dueno, 160), empresa: str(o.empresa, 160), establecimiento: '', red: '', contactos: [], ciudad: str(o.ciudad, 120), estadoVE: '', direccion: '',
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

/* ── Ubicación del establecimiento ──
   Vive en su propio bloque del registro (r.ubicacion), separado del dato importado (r.origen) y de las correcciones
   comerciales (r.datos): reimportar no la toca. Cada cambio guarda la ubicación anterior en su historial.
   · «aproximada»: punto representativo de la ciudad o zona conocida (no es la dirección del taller).
   · «exacta»: solo cuando una persona confirma que el punto es la entrada del taller. Nunca se marca sola. */
export const PRECISIONES = { aproximada: 'Aproximada', exacta: 'Exacta confirmada' };
const plegar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/* Puntos representativos de ciudades/zonas (plazas o centros urbanos de referencia). No son direcciones de talleres. */
export const REFERENCIAS = {
  'puerto ordaz': { lat: 8.2833, lng: -62.7333, ciudad: 'Puerto Ordaz', estado: 'Bolívar', referencia: 'Puerto Ordaz, estado Bolívar (centro de la ciudad)' },
  caracas: { lat: 10.5061, lng: -66.9146, ciudad: 'Caracas', estado: 'Distrito Capital', referencia: 'Caracas (Plaza Bolívar), Distrito Capital', nota: 'Distrito Capital es una referencia provisional: falta confirmar la jurisdicción exacta.' },
  barinas: { lat: 8.6226, lng: -70.2075, ciudad: 'Barinas', estado: 'Barinas', referencia: 'Barinas (Plaza Bolívar), estado Barinas' },
  'san cristobal': { lat: 7.7669, lng: -72.2250, ciudad: 'San Cristóbal', estado: 'Táchira', referencia: 'San Cristóbal, estado Táchira (centro de la ciudad)' },
  margarita: { lat: 10.9577, lng: -63.8697, ciudad: 'Isla de Margarita', estado: 'Nueva Esparta', referencia: 'Isla de Margarita, estado Nueva Esparta (punto representativo: Porlamar)' }
};
const coord = v => { const n = Number(String(v ?? '').trim().replace(',', '.')); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };
function normUbic(u) {
  if (!u || typeof u !== 'object') return null;
  const lat = coord(u.lat), lng = coord(u.lng);
  return { lat, lng, precision: u.precision === 'exacta' && lat !== null ? 'exacta' : 'aproximada', referencia: str(u.referencia, 300), direccion: str(u.direccion, 300),
    ciudad: str(u.ciudad, 120), estado: str(u.estado, 60), enlace: str(u.enlace, 2000), enlaceNota: str(u.enlaceNota, 400), nota: str(u.nota, 400),
    origen: str(u.origen, 80), actualizado: str(u.actualizado, 40), autor: str(u.autor, 80),
    historial: (Array.isArray(u.historial) ? u.historial : []).slice(-50) };
}
export const ubicacionDe = r => normUbic(r.ubicacion);
/* Asigna la referencia provisional a las ventas que todavía no tienen ubicación (una sola vez; no pisa nada). */
export function asegurarUbicaciones() {
  const l = registros(); let n = 0;
  l.forEach(r => {
    if (r.ubicacion) return;
    const d = r.datos || {};
    if (coord(d.lat) !== null && coord(d.lng) !== null) {
      r.ubicacion = { lat: d.lat, lng: d.lng, precision: d.ubicacionConfirmada ? 'exacta' : 'aproximada', referencia: 'Coordenadas cargadas antes en la ficha', direccion: d.direccion || '',
        ciudad: d.ciudad || '', estado: d.estadoVE || '', origen: 'Trasladada desde la ficha', actualizado: ahora(), historial: [] };
    } else {
      const ref = REFERENCIAS[plegar(d.ciudad || r.origen.ciudad)]; if (!ref) return;
      r.ubicacion = { lat: ref.lat, lng: ref.lng, precision: 'aproximada', referencia: ref.referencia, direccion: '', ciudad: ref.ciudad, estado: ref.estado, nota: ref.nota || '',
        origen: 'Referencia provisional por ciudad', actualizado: ahora(), historial: [] };
    }
    r.historial.push({ fecha: ahora(), nota: `Ubicación aproximada asignada: ${r.ubicacion.referencia}.` }); n++;
  });
  if (n) escribir(K.ventas, l);
  return n;
}
/* Guarda una ubicación nueva. La precisión debe venir confirmada por la persona (no hay valor por defecto). */
export function guardarUbicacion(id, nueva, autor) {
  const l = registros(), r = l.find(x => x.id === id); if (!r) return { error: 'La venta no existe.' };
  const lat = coord(nueva.lat), lng = coord(nueva.lng);
  if (lat === null || lng === null) return { error: 'Indica el punto: haz clic en el mapa, arrastra el marcador o escribe latitud y longitud.' };
  if (!PV.dentroDeVenezuela(lat, lng)) return { error: 'Ese punto queda fuera de Venezuela. Revisa el orden (latitud primero) y el signo de la longitud.' };
  if (!['aproximada', 'exacta'].includes(nueva.precision)) return { error: 'Confirma si el punto es una referencia aproximada o la ubicación exacta del taller.' };
  const ant = normUbic(r.ubicacion);
  const u = normUbic({ ...nueva, lat, lng, origen: 'Editada en la aplicación', actualizado: ahora(), autor, historial: ant ? [...ant.historial, { ...ant, historial: undefined, reemplazada: ahora() }] : [] });
  r.ubicacion = u;
  r.historial.push({ fecha: ahora(), nota: `Ubicación ${u.precision === 'exacta' ? 'exacta confirmada' : 'aproximada'} guardada${ant ? ` (antes: ${ant.precision}, ${ant.referencia || `${ant.lat}, ${ant.lng}`})` : ''}.` });
  escribir(K.ventas, l); return { ok: true, ubicacion: u };
}

/* ── Enlaces de Google Maps ──
   Solo se aceptan dominios de Google Maps. Se distingue qué representan las coordenadas del enlace:
   · «lugar» (!3d…!4d…): coordenadas del sitio marcado.  · «consulta» (q=, query=, /search/lat,lng): punto pedido explícitamente.
   · «camara» (@lat,lng): solo el centro de la vista; NO se asume que sea el taller.
   · «corto» (maps.app.goo.gl, goo.gl/maps): no se puede leer desde el navegador; hay que abrirlo y copiar el enlace completo.
   En ningún caso se guarda solo: la persona revisa el punto y confirma su precisión. */
export function analizarEnlaceMaps(texto) {
  const t = String(texto || '').trim(); if (!t) return { tipo: 'vacio' };
  const par = t.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (par) return { tipo: 'coordenadas', lat: Number(par[1].replace(',', '.')), lng: Number(par[2].replace(',', '.')), mensaje: 'Coordenadas escritas a mano. Revisa el punto en el mapa antes de guardar.' };
  let u; try { u = new URL(t); } catch { return { tipo: 'invalido', mensaje: 'No parece un enlace. Pega el enlace completo de Google Maps o escribe «latitud, longitud».' }; }
  const host = u.hostname.toLowerCase(), ruta = decodeURIComponent(u.pathname + u.search + u.hash).replace(/\+/g, ' ');
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { tipo: 'invalido', mensaje: 'El enlace no es una dirección web.' };
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && /^\/maps/.test(u.pathname)) || host === 'g.co')
    return { tipo: 'corto', mensaje: 'Es un enlace corto de Google Maps: no se puede leer desde la página. Ábrelo, espera a que cargue el lugar y copia el enlace completo de la barra de direcciones; o marca el punto a mano. El enlace se conserva como referencia.' };
  const esGoogle = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) && (/^\/maps/.test(u.pathname) || host.startsWith('maps.'));
  if (!esGoogle) return { tipo: 'invalido', mensaje: 'Solo se aceptan enlaces de Google Maps.' };
  const n = '(-?\\d{1,2}\\.\\d+)', m = '(-?\\d{1,3}\\.\\d+)';
  let x = ruta.match(new RegExp(`!3d${n}!4d${m}`));
  if (x) return { tipo: 'lugar', lat: +x[1], lng: +x[2], mensaje: 'El enlace trae las coordenadas del lugar marcado en Google Maps. Confirma en el mapa que es el taller.' };
  x = ruta.match(new RegExp(`[?&](?:q|query|ll|destination)=${n}\\s*,\\s*${m}`)) || ruta.match(new RegExp(`/maps/search/${n}\\s*,\\s*${m}`)) || ruta.match(new RegExp(`/maps/place/${n}\\s*,\\s*${m}`));
  if (x) return { tipo: 'consulta', lat: +x[1], lng: +x[2], mensaje: 'El enlace apunta a unas coordenadas concretas. Confirma en el mapa que es el taller.' };
  x = ruta.match(new RegExp(`@${n},${m}`));
  if (x) return { tipo: 'camara', lat: +x[1], lng: +x[2], mensaje: 'Las coordenadas de este enlace son solo el centro de la vista del mapa, no necesariamente el taller. No se usan solas: puedes tomarlas como punto de partida y ajustar el marcador.' };
  return { tipo: 'sin-coordenadas', mensaje: 'El enlace no contiene coordenadas que se puedan leer con seguridad. Se conserva como referencia; marca el punto en el mapa o escribe las coordenadas.' };
}

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
    if (i < 0) { l.push({ id, origen: orig, datos: datosDesdeOrigen(orig), importado: ahora(), historial: [{ fecha: ahora(), nota: `Importada desde el registro de ventas (fila ${orig.filaOrigen}).` }] }); res.nuevas++; continue; }
    // Reparación: si el teléfono quedó reemplazado por la marca de protegido («•••»), se recupera del archivo de origen.
    if (i >= 0 && l[i].datos && l[i].datos.telefono === '•••' && orig.telefono) { l[i].datos.telefono = orig.telefono; res.reparadas = (res.reparadas || 0) + 1; }
    if (i >= 0 && JSON.stringify(l[i].origen) !== JSON.stringify(orig) && JSON.stringify(l[i].origen).includes('•••')) { l[i].origen = orig; continue; }
    else if (i >= 0 && JSON.stringify(l[i].origen) !== JSON.stringify(orig)) { l[i].origen = orig; l[i].historial.push({ fecha: ahora(), nota: 'Dato original actualizado al reimportar. Las ediciones se conservan.' }); res.actualizadas++; }
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
  res.ubicaciones = asegurarUbicaciones();
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
    const g = garantia(r), entregados = PV.unidadesEnVenta(r.id);
    const alertas = [];
    if (dup) alertas.push({ t: DUP, nivel: 'alta' });
    if (!r.origen.serial) alertas.push({ t: 'Sin serial consignado', nivel: 'alta' });
    if (r.datos.docEstado === 'Pendiente') alertas.push({ t: 'Documentación pendiente', nivel: 'media' });
    else if (r.datos.docEstado === 'Completa según la fuente') alertas.push({ t: 'Documentación por verificar', nivel: 'baja' });
    if (r.datos.precio === null) alertas.push({ t: 'Precio no registrado', nivel: 'baja' });
    if (r.datos.telefono && !r.datos.telefonoVerificado) alertas.push({ t: 'Teléfono por verificar', nivel: 'baja' });
    const ub = ubicacionDe(r);
    if (!ub || ub.precision !== 'exacta') alertas.push({ t: 'Ubicación exacta pendiente', nivel: 'baja' });
    if (g.estado === 'Por vencer' || g.estado === 'Vencida') alertas.push({ t: `Garantía ${g.estado.toLowerCase()}`, nivel: 'alta' });
    else if (g.estado === 'No calculable') alertas.push({ t: 'Garantía no calculable', nivel: 'media' });
    else if (!g.confirmada) alertas.push({ t: 'Inicio de garantía pendiente de confirmar', nivel: 'baja' });
    return { ...r, datos: { red: '', contactos: [], ...r.datos }, ubicacion: ub, dup, garantia: g, entregados, alertas, nombre: r.datos.establecimiento || r.datos.empresa || r.datos.dueno || r.id };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
export const ventaPorId = id => ventas().find(v => v.id === id);
/* Unidades del inventario cuyo serial coincide con el consignado: solo sugerencias, nunca se vinculan solas. */
export const coincidenciasInventario = v => (v.origen.serial ? D.unidades().filter(u => u.serial && u.serial.replace(/\s/g, '').toUpperCase() === v.origen.serial.toUpperCase()) : []);

/* ── Edición con trazabilidad ── */
export function editar(id, cambios, motivo) {
  const l = registros(), r = l.find(x => x.id === id); if (!r) return { error: 'La venta no existe.' };
  const actual = { red: '', contactos: [], ...r.datos }, n = { ...actual };
  for (const [k, v] of Object.entries(cambios)) {
    if (!(k in CAMPOS)) continue;
    n[k] = k === 'contactos' ? (Array.isArray(v) ? v : []).map(c => ({ nombre: str(c.nombre, 120), cargo: str(c.cargo, 120), telefono: str(c.telefono, 60), correo: str(c.correo, 160) })).filter(c => c.nombre || c.telefono || c.correo).slice(0, 20)
      : ['lat', 'lng', 'precio', 'garantiaMeses'].includes(k) ? num(v)
      : ['ubicacionConfirmada', 'telefonoVerificado', 'inicioGarantiaConfirmado', 'serialConciliado'].includes(k) ? !!v
        : k === 'inicioGarantia' ? fecha(v) : k === 'docEstado' ? (ESTADOS_DOC.includes(v) ? v : r.datos.docEstado) : str(v, k === 'notas' || k === 'docNota' || k === 'conciliacionNota' ? 1000 : 200);
  }
  if (n.garantiaMeses !== null && (n.garantiaMeses <= 0 || n.garantiaMeses > 120)) return { error: 'La garantía debe estar entre 1 y 120 meses.' };
  if (n.precio !== null && n.precio < 0) return { error: 'El precio no puede ser negativo.' };
  if (n.ubicacionConfirmada && (n.lat === null || n.lng === null)) return { error: 'Para confirmar la ubicación escribe latitud y longitud del establecimiento.' };
  if ((n.lat === null) !== (n.lng === null)) return { error: 'Escribe latitud y longitud, o deja las dos vacías.' };
  if (n.lat !== null && !PV.dentroDeVenezuela(n.lat, n.lng)) return { error: 'Esas coordenadas quedan fuera de Venezuela. Revisa el orden (latitud primero) y el signo de la longitud.' };
  if (n.inicioGarantiaConfirmado && !n.inicioGarantia) return { error: 'Indica la fecha de inicio de garantía para marcarla como confirmada.' };
  if (n.unidadId && !D.unidadPorId(n.unidadId)) return { error: 'La unidad elegida no existe en el inventario.' };
  if (n.unidadId && registros().some(x => x.id !== id && x.datos.unidadId === n.unidadId)) return { error: 'Esa unidad ya está vinculada a otra venta.' };
  const dif = Object.keys(CAMPOS).filter(k => JSON.stringify(n[k]) !== JSON.stringify(actual[k]));
  if (!dif.length) return { sinCambios: true };
  const m = str(motivo, 400);
  dif.forEach(k => r.historial.push({ fecha: ahora(), campo: k, antes: actual[k], despues: n[k], motivo: m }));
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
    sinUnidad: vs.filter(v => !v.entregados.length).length,
    entregados: vs.reduce((s, v) => s + v.entregados.length, 0),
    conEmpresa: vs.filter(v => v.datos.empresa || v.datos.establecimiento).length,
    sinPrecio: vs.filter(v => v.datos.precio === null).length,
    docPendiente: vs.filter(v => v.datos.docEstado === 'Pendiente').length,
    docPorVerificar: vs.filter(v => v.datos.docEstado === 'Completa según la fuente').length,
    ubicConfirmada: vs.filter(v => v.ubicacion && v.ubicacion.precision === 'exacta').length,
    ubicAproximada: vs.filter(v => v.ubicacion && v.ubicacion.precision === 'aproximada').length,
    garCalculadas: vs.filter(v => v.garantia.estado !== 'No calculable').length,
    garConfirmadas: vs.filter(v => v.garantia.confirmada).length,
    garPorVencer: vs.filter(v => v.garantia.estado === 'Por vencer').length,
    garVencidas: vs.filter(v => v.garantia.estado === 'Vencida').length,
    evidencias: evidencias().length, sinClasificar: sinClasificar().length,
    noImportados: ((meta() || {}).noImportados || []).length
  };
}

/* ── Venta registrada desde Stock (indicación de Cristian, 23/11/2026) ──
   Crea la venta (VT-siguiente) con sus datos y entrega en el mismo paso las unidades elegidas: dejan de contar en stock
   y pasan a Postventa. No modifica la hoja de máquinas. Devuelve { error } o { id }. */
export function registrarVenta(d, unidadIds, autor, origenTxt = '') {
  const ids = [...new Set((unidadIds || []).filter(Boolean))];
  if (!ids.length) return { error: 'Elige al menos una unidad vendida.' };
  const us = ids.map(id => D.unidadPorId(id));
  for (let i = 0; i < ids.length; i++) {
    const u = us[i]; if (!u) return { error: `La unidad ${ids[i]} no existe.` };
    if (PV.instalacionActiva(u.id)) return { error: `${u.codigo || u.id} ya está entregada en otra venta.` };
    if (u.enOperacion) return { error: `${u.codigo || u.id} está en operación en nuestro taller. Retírala de operación primero.` };
  }
  const dueno = str(d.dueno, 160), empresa = str(d.empresa, 160), establecimiento = str(d.establecimiento, 160);
  if (!dueno && !empresa && !establecimiento) return { error: 'Escribe el cliente: dueño, empresa o establecimiento.' };
  const fv = fecha(d.fechaVenta); if (!fv) return { error: 'Indica la fecha de venta.' };
  const fe = fecha(d.fechaEntrega); if (fe && fe < fv) return { error: 'La fecha de entrega no puede ser anterior a la de venta.' };
  const meses = num(d.garantiaMeses); if (meses !== null && (meses <= 0 || meses > 120)) return { error: 'La garantía debe estar entre 1 y 120 meses.' };
  const precio = num(d.precio); if (precio !== null && precio < 0) return { error: 'El precio no puede ser negativo.' };
  const l = registros();
  const n = Math.max(0, ...l.map(r => Number((r.id.match(/^VT-(\d+)$/) || [])[1]) || 0)) + 1, id = `VT-${String(n).padStart(3, '0')}`;
  const seriales = us.filter(u => u.tipo !== 'soporte' && u.serial).map(u => u.serial);
  const orig = normOrigen({ fechaVenta: fv, serial: seriales.join(' / '), dueno, empresa, telefono: d.telefono, ciudad: d.ciudad, precio, formaPago: d.formaPago,
    vendedor: d.vendedor, garantiaMeses: meses, condicionComercial: 'Vendida', observaciones: '', documentacion: { estado: ESTADOS_DOC.includes(d.docEstado) ? d.docEstado : 'Pendiente' } });
  const datos = { ...datosDesdeOrigen(orig), establecimiento, moneda: str(d.moneda, 10), notas: str(d.notas, 1000),
    inicioGarantia: fe, inicioGarantiaConfirmado: !!fe, serialConciliado: true, conciliacionNota: `Equipos vinculados al registrar la venta: ${us.map(u => u.codigo || u.id).join(', ')}.` };
  const quien = str(autor, 120);
  l.push({ id, origen: { ...orig, registradaEn: 'app' }, datos, importado: ahora(),
    historial: [{ fecha: ahora(), nota: `Venta registrada desde Stock${origenTxt ? ` (${origenTxt})` : ''}${quien ? ` por ${quien}` : ''}. Equipos: ${us.map(u => u.codigo || u.id).join(', ')}.` }] });
  if (!escribir(K.ventas, l)) return { error: 'No se pudo guardar en este navegador.' };
  const r = PV.registrarInstalacion(ids, { ventaId: id, fechaVenta: fv, fechaInstalacion: fe, garantia: meses ? `${meses} meses` : '', observaciones: 'Entrega registrada junto con la venta.' });
  if (r.error) { escribir(K.ventas, registros().filter(x => x.id !== id)); return { error: r.error }; }
  return { id };
}
