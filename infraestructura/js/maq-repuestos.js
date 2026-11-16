/* Máquinas de simulación · Stock › Repuestos (Etapa 2).
   Fuente: hoja de repuestos, pestaña «Table 1» (solo lectura). «Table 2» y «Table 3» son borradores con las mismas
   referencias en otra estructura: no se leen, para no duplicar. Las columnas sin encabezado de «Table 1» (tamaño,
   cálculos de volumen) son de trabajo interno y no se usan.
   Existencia (acordado con Cristian, 16/11/2026): se parte de «Stock Actual» de la hoja y se puede modificar en la
   aplicación; cada cambio queda en el historial. Una nueva lectura de la hoja nunca pisa la existencia ajustada:
   si la hoja cambia después, se muestran ambos valores. No se corrigen diferencias entre lo pedido y lo recibido,
   ni se inventan unidades de medida, ubicaciones, compatibilidades o mínimos. */
import { parseCSV } from '../assets/js/sheets-public.js';

/* Lectura con la primera fila como encabezado (headers=1). Sin ese parámetro, Google vacía el encabezado de las
   columnas numéricas (precio, cantidades, «Stock Actual») y no se podrían reconocer. */
async function leerTabla(hoja, pestana) {
  const p = new URLSearchParams({ tqx: 'out:csv', headers: '1', sheet: pestana });
  let res;
  try { res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(hoja)}/gviz/tq?${p}`, { cache: 'no-store' }); }
  catch { throw Object.assign(new Error(navigator.onLine === false ? 'No hay conexión a internet.' : 'No se pudo leer la hoja de repuestos.'), { code: 'NETWORK' }); }
  if (!res.ok) throw Object.assign(new Error(`La hoja de repuestos respondió HTTP ${res.status}.`), { code: 'SHEETS_HTTP' });
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw Object.assign(new Error('La hoja de repuestos no es pública.'), { code: 'NOT_PUBLIC' });
  return parseCSV(text);
}

// Configuración técnica (no se muestra en la interfaz).
const FUENTE = { hoja: '1DUjn25HPnvnj-kFVWfv2aeaM418qdoNY7bx74jlej7Q', pestana: 'Table 1' };
const PREFIJO = 'ccs-infraestructura-v2:';
const K = { cache: PREFIJO + 'rep-hoja-cache', datos: PREFIJO + 'rep-datos' };
const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const ahora = () => new Date().toISOString();
const str = (v, n = 500) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/* Números de la hoja: « $ 4.00 », «$8.19», «0.0546», «16», «-1». Vacío o ilegible → null (no se inventa un cero). */
export function numero(v) {
  const s = String(v ?? '').replace(/[$\s]/g, '').replace(/,/g, '');
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const COLUMNAS = {
  ref: ['no.', 'no', 'n°', 'numero'], descEn: ['description'], descEs: ['descripcion'], imagen: ['image', 'imagen'],
  precio: ['unit price', 'precio unitario'], cbm: ['cbm'], envioUnit: ['precio envio unit'], costoConEnvio: ['costo + envio'],
  envioTotal: ['costo envio total'], pedido: ['order qty'], recibido: ['qty recibida'], incidencia: ['incidencia/garantia'],
  stockHoja: ['stock actual'], pronosticado: ['pronosticado'], total: ['total price']
};

function deFilas(filas) {
  const head = (filas[0] || []).map(sinTildes), col = {};
  Object.entries(COLUMNAS).forEach(([f, ns]) => { const i = head.findIndex(h => ns.includes(h)); if (i >= 0) col[f] = i; });
  if (col.ref === undefined || col.stockHoja === undefined || col.descEs === undefined)
    throw Object.assign(new Error('La hoja de repuestos no tiene la estructura esperada.'), { code: 'TABLE_MISSING' });
  const vistos = new Set(), out = [];
  filas.slice(1).forEach(f => {
    const v = k => (col[k] === undefined ? '' : String(f[col[k]] ?? ''));
    const ref = str(v('ref'), 40);
    // Una referencia necesita número y descripción (la fila de totales no tiene ninguno de los dos).
    if (!ref || !(str(v('descEs')) || str(v('descEn')))) return;
    if (vistos.has(ref)) return;   // sin duplicados por referencia
    vistos.add(ref);
    const r = {
      id: 'RP-' + ref, ref, descEs: str(v('descEs')), descEn: str(v('descEn')),
      imagenHoja: /^https:\/\//.test(str(v('imagen'), 1000)) ? str(v('imagen'), 1000) : '',
      precio: numero(v('precio')), cbm: numero(v('cbm')), envioUnit: numero(v('envioUnit')), costoConEnvio: numero(v('costoConEnvio')),
      envioTotal: numero(v('envioTotal')), pedido: numero(v('pedido')), recibido: numero(v('recibido')),
      incidencia: str(v('incidencia'), 200), stockHoja: numero(v('stockHoja')), pronosticado: str(v('pronosticado'), 200), total: numero(v('total'))
    };
    out.push(r);
  });
  return out.sort((a, b) => (Number(a.ref) || 0) - (Number(b.ref) || 0) || a.ref.localeCompare(b.ref));
}

export const R = { lista: [], estado: 'inicial', error: null, leido: null, desdeCache: false };
export async function cargar() {
  R.estado = 'cargando'; R.error = null;
  try {
    const filas = await leerTabla(FUENTE.hoja, FUENTE.pestana);
    R.lista = deFilas(filas); R.leido = ahora(); R.desdeCache = false; R.estado = 'listo';
    escribir(K.cache, { fecha: R.leido, filas });
  } catch (e) {
    const c = leer(K.cache);
    if (c && Array.isArray(c.filas)) { R.lista = deFilas(c.filas); R.leido = c.fecha; R.desdeCache = true; R.estado = 'listo'; } else R.estado = 'error';
    R.error = e;
  }
  return R;
}

/* ── Datos de la aplicación por referencia: existencia ajustada, ubicación, compatibilidad, unidad, imagen y notas ── */
const datos = () => { const v = leer(K.datos); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
export function repuestos() {
  const d = datos();
  return R.lista.map(r => {
    const a = d[r.id] || {};
    const ajustada = Number.isFinite(a.existencia);
    return { ...r, existencia: ajustada ? a.existencia : r.stockHoja, ajustada, existenciaHojaAlAjustar: a.hojaAlAjustar ?? null,
      ubicacion: a.ubicacion || '', compatibilidad: a.compatibilidad || '', unidad: a.unidad || '', imagen: a.imagen || r.imagenHoja || '',
      observaciones: a.observaciones || '', historial: Array.isArray(a.historial) ? a.historial : [] };
  });
}
export const repuestoPorId = id => repuestos().find(r => r.id === id);

/* Cambia la existencia (entero ≥ 0) con un motivo; queda en el historial con el valor anterior. */
export function ajustarExistencia(id, nueva, motivo) {
  const r = repuestoPorId(id); if (!r) return 'La referencia no existe.';
  if (!Number.isInteger(nueva) || nueva < 0) return 'La existencia debe ser un número entero igual o mayor que cero.';
  if (nueva === r.existencia) return 'La existencia no cambió.';
  const d = datos(), a = d[id] || { historial: [] };
  a.existencia = nueva; a.hojaAlAjustar = r.stockHoja;
  a.historial = [...(a.historial || []), { fecha: ahora(), nota: `Existencia: ${r.existencia ?? 'sin dato'} → ${nueva}.${motivo ? ` Motivo: ${str(motivo, 300)}` : ''}` }].slice(-300);
  d[id] = a; escribir(K.datos, d); return '';
}
export function guardarDatos(id, campos) {
  const d = datos(), a = d[id] || { historial: [] };
  const img = str(campos.imagen, 1000);
  Object.assign(a, { ubicacion: str(campos.ubicacion, 200), compatibilidad: str(campos.compatibilidad, 600), unidad: str(campos.unidad, 40),
    imagen: /^https:\/\//.test(img) ? img : '', observaciones: str(campos.observaciones, 2000) });
  a.historial = [...(a.historial || []), { fecha: ahora(), nota: 'Datos de la referencia editados (ubicación, compatibilidad, unidad, imagen u observaciones).' }].slice(-300);
  d[id] = a; return escribir(K.datos, d);
}

/* Indicadores calculados (para Stock y luego para el Resumen). */
export const tieneIncidencia = r => !!r.incidencia;
export const difiereRecibido = r => r.pedido !== null && r.recibido !== null && r.pedido !== r.recibido;
export function indicadores(lista = repuestos()) {
  return { referencias: lista.length, sinExistencias: lista.filter(r => r.existencia === 0).length, sinDato: lista.filter(r => r.existencia === null).length,
    unidades: lista.reduce((s, r) => s + (r.existencia || 0), 0), incidencias: lista.filter(tieneIncidencia).length,
    diferencias: lista.filter(difiereRecibido).length, ajustadas: lista.filter(r => r.ajustada).length };
}
