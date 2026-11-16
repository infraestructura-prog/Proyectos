/* Máquinas de simulación · sincronización con la hoja privada compartida (Apps Script «Postventa.gs»).
   · Se sigue trabajando sobre este navegador; «Sincronizar» envía lo cambiado desde la última vez y trae lo de
     los demás, en una sola ventana de Google (hace falta la clave; se guarda solo en memoria mientras la página
     está abierta).
   · Cada registro lleva la versión compartida en la que se basó. Si otra persona lo cambió antes, se conserva
     la versión compartida y la tuya queda guardada en «Cambios no aplicados» para revisarla: nada se pierde.
   · Un registro que nunca se sincronizó y que ya existe en la hoja (p. ej. kits A–G propuestos en otro navegador)
     se reemplaza por la versión compartida sin aviso. */
import { MAQUINAS as CFG } from '../assets/js/config.js';
import { llamarScript } from './maq-datos.js';

const P = 'ccs-infraestructura-v2:';
/* Colección compartida → clave local y forma: lista de objetos con id, mapa {id: valor} u objeto único. */
const COLS = [
  ['ventas', 'maq-ventas', 'lista'], ['evidencias', 'maq-evidencias', 'lista'], ['evid-sin-clasificar', 'maq-evid-sin-clasificar', 'lista'],
  ['ventas-importacion', 'maq-ventas-importacion', 'unico'], ['talleres', 'maq-talleres', 'lista'], ['instalaciones', 'maq-instalaciones', 'lista'],
  ['servicios', 'maq-servicios', 'lista'], ['operacion', 'maq-operacion', 'lista'], ['complementos', 'maq-complementos', 'mapa'],
  ['soportes', 'maq-soportes', 'lista'], ['kits', 'maq-kits', 'lista'], ['kits-sembrados', 'maq-kits-sembrados', 'unico'], ['rep-datos', 'rep-datos', 'mapa']
].map(([col, k, forma]) => ({ col, key: P + k, forma }));
const KB = P + 'sync-base', KM = P + 'sync-meta', KC = P + 'sync-no-aplicados';
const leerRaw = k => { try { return localStorage.getItem(k); } catch { return null; } };
const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const enc = s => encodeURIComponent(String(s)).replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

let clave = '';
export const disponible = () => !!CFG.DATOS_URL;
export const tieneClave = () => !!clave;
export const meta = () => leer(KM) || null;
export const noAplicados = () => { const v = leer(KC); return Array.isArray(v) ? v : []; };

/* Valor local → { id: json } (ids codificados para que viajen y se guarden como texto). */
function registros(c, v) {
  const o = {};
  if (v === undefined || v === null) return o;
  if (c.forma === 'lista') { if (Array.isArray(v)) v.forEach(x => { if (x && x.id) o[enc(x.id)] = JSON.stringify(x); }); }
  else if (c.forma === 'mapa') { if (typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([id, x]) => { if (x && typeof x === 'object') o[enc(id)] = JSON.stringify(x); }); }
  else if (typeof v === 'object') o._ = JSON.stringify(v);
  return o;
}
/* Registros compartidos → valor local con la forma que espera cada módulo. */
function valor(c, regs) {
  const vivos = regs.filter(r => r.datos), parse = r => { try { return JSON.parse(r.datos); } catch { return null; } };
  if (c.forma === 'lista') return vivos.map(parse).filter(x => x && typeof x === 'object');
  if (c.forma === 'mapa') { const o = {}; vivos.forEach(r => { const x = parse(r); if (x) o[decodeURIComponent(r.id)] = x; }); return o; }
  const r = vivos.find(x => x.id === '_'); return r ? parse(r) : undefined;
}

/* Cambios locales desde la última sincronización (comparando con la copia base). */
export function pendientes() {
  const base = leer(KB) || {}, l = [];
  COLS.forEach(c => {
    const loc = registros(c, leer(c.key)), b = base[c.col] || {};
    Object.entries(loc).forEach(([id, datos]) => { if (!b[id] || b[id].h !== datos) l.push({ coleccion: c.col, id, datos, base: b[id] ? b[id].v : 0 }); });
    Object.keys(b).forEach(id => { if (b[id].h !== null && !(id in loc)) l.push({ coleccion: c.col, id, datos: null, base: b[id].v }); });
  });
  return l;
}

export async function sincronizar(claveIngresada, autor, transporte = llamarScript) {
  const k = claveIngresada || clave; if (!k) throw Object.assign(new Error('Escribe la clave.'), { code: 'NO_KEY' });
  const inicio = Object.fromEntries(COLS.map(c => [c.col, leerRaw(c.key)]));
  const cambios = pendientes();
  let r;
  try { r = await transporte({ accion: 'sincronizar', clave: k, autor: String(autor || '').slice(0, 80), cambios }, CFG.DATOS_URL); }
  catch (e) { if (e.code === 'UNAUTHORIZED') clave = ''; throw e; }
  clave = k;
  const datos = r.datos || {}, base = leer(KB) || {}, guardados = noAplicados(), ahora = new Date().toISOString();
  const conflictivos = new Set((r.conflictos || []).map(x => x.coleccion + '|' + x.id));
  let saltadas = 0;
  COLS.forEach(c => {
    const regs = datos[c.col] || [];
    // Tus versiones que no se aplicaron (otra persona cambió lo mismo antes) se guardan para revisarlas.
    cambios.filter(x => x.coleccion === c.col && conflictivos.has(c.col + "|" + x.id) && x.base > 0)
      .forEach(x => guardados.push({ coleccion: c.col, id: decodeURIComponent(x.id), datos: x.datos, fecha: ahora }));
    // Si cambiaste algo en esta colección mientras la ventana de Google estaba abierta, esos registros se
    // conservan encima de la versión compartida y se envían en la próxima sincronización.
    if (leerRaw(c.key) !== inicio[c.col]) {
      saltadas++;
      let antes = {}; try { antes = registros(c, JSON.parse(inicio[c.col])); } catch { /* vacío */ }
      const ahoraLoc = registros(c, leer(c.key)), mapa = new Map(regs.map(x => [x.id, { ...x }]));
      Object.entries(ahoraLoc).forEach(([id, d]) => { if (antes[id] !== d) mapa.set(id, { ...(mapa.get(id) || { version: 0 }), id, datos: d, local: true }); });
      Object.keys(antes).forEach(id => { if (!(id in ahoraLoc) && mapa.has(id)) mapa.set(id, { ...mapa.get(id), datos: null, local: true }); });
      const fusion = [...mapa.values()];
      const v = valor(c, fusion); if (v !== undefined) escribir(c.key, v);
      base[c.col] = Object.fromEntries(regs.map(x => [x.id, { h: x.datos || null, v: x.version }]));
      return;
    }
    const v = valor(c, regs);
    if (v === undefined || (Array.isArray(v) && !v.length && !regs.length && leer(c.key) === undefined)) { /* nada compartido ni local */ }
    else escribir(c.key, v);
    // Los borrados quedan con h: null y su versión, para poder recrear un registro con el mismo id sin conflicto.
    base[c.col] = Object.fromEntries(regs.map(x => [x.id, { h: x.datos || null, v: x.version }]));
  });
  escribir(KB, base); escribir(KC, guardados.slice(-200));
  const m = { fecha: ahora, autor: String(autor || '').slice(0, 80), enviados: r.aplicados || 0, conflictos: (r.conflictos || []).length, saltadas };
  escribir(KM, m);
  return m;
}
export const descartarNoAplicados = () => escribir(KC, []);
