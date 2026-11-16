/* Máquinas de simulación · capa de datos (Etapa 1 de la reorganización: Stock individual y kits).
   Fuente de verdad (acordada con Cristian, 16/11/2026):
   · Hoja del módulo (MAQUINAS.SPREADSHEET_ID, primera pestaña): codificación, categoría (con/sin chapa), serial,
     lado de la escalera, condición e imagen de cada máquina. Se lee periódicamente; la edición sigue siendo la del
     Apps Script ya existente (clave de edición). No se agrega otra escritura hacia Sheets.
   · Aplicación (este navegador, prefijo ccs-infraestructura-v2:): soportes, kits, datos complementarios
     (marca, modelo, ubicación, estado operativo, observaciones) e historial. Una lectura de la hoja nunca los borra.
   Reglas de kits: 4 posiciones (máquina con chapa, máquina sin chapa, soporte 1, soporte 2); las dos máquinas deben
   tener escaleras opuestas; una unidad no puede estar en dos kits activos. El lado funcional no se deduce de nada. */
import { MAQUINAS as CFG } from '../assets/js/config.js';
import { readPublicSheet } from '../assets/js/sheets-public.js';

const PREFIJO = 'ccs-infraestructura-v2:';
const K = {
  cache: PREFIJO + 'maq-hoja-cache',            // última lectura correcta de la hoja (respaldo y uso sin conexión)
  complementos: PREFIJO + 'maq-complementos',   // { [idUnidad]: datos complementarios de una máquina de la hoja }
  soportes: PREFIJO + 'maq-soportes',           // unidades creadas en la aplicación (soportes)
  kits: PREFIJO + 'maq-kits',                   // kits registrados
  sembrado: PREFIJO + 'maq-kits-sembrados'      // los kits por letra ya se propusieron una vez (no se recrean si se borran)
};
const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const ahora = () => new Date().toISOString();
const str = (v, n = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/* ── Normalización de la hoja (sin cambiar la hoja) ── */
const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const codeKey = s => str(s).toUpperCase().replace(/\s+/g, '');
const categoria = v => { const s = sinTildes(v).replace(/\s+/g, ' '); return s === 'con chapa' ? 'Con chapa' : s === 'sin chapa' ? 'Sin chapa' : str(v); };
const lado = v => { const s = sinTildes(v); return /^derech[ao]$/.test(s) ? 'Derecha' : /^izquierd[ao]$/.test(s) ? 'Izquierda' : str(v); };
const condicion = v => { const s = sinTildes(v); return /^(en )?stock$|^disponible$/.test(s) ? 'En stock' : /^vendid[ao]$/.test(s) ? 'Vendida' : str(v); };
const serial = v => (/^[-–—\s]*$/.test(String(v || '')) ? '' : str(v));
const ALIAS = {
  codificacion: ['codificacion', 'codigo'], categoria: ['categoria'], serial: ['serial'],
  escalera: ['escalera', 'lado de la escalera'], condicion: ['condicion'], imagen: ['imagen', 'imagen_url', 'foto']
};
export const idDeCodigo = c => 'MQ-' + codeKey(c);
export const letraDe = c => { const m = codeKey(c).match(/^([A-Z0-9]+)-/); return m ? m[1] : ''; };

/* Convierte las filas leídas en unidades «máquina». La fila se guarda para poder editarla con el Apps Script. */
function unidadesDeFilas(filas) {
  const head = (filas[0] || []).map(h => sinTildes(h));
  const col = {};
  Object.entries(ALIAS).forEach(([f, ns]) => { const i = head.findIndex(h => ns.includes(h)); if (i >= 0) col[f] = i; });
  if (col.codificacion === undefined || col.condicion === undefined) throw Object.assign(new Error('La hoja de máquinas no tiene la estructura esperada.'), { code: 'TABLE_MISSING' });
  const out = [];
  filas.slice(1).forEach((f, i) => {
    const raw = { fila: i + 2 };
    Object.keys(ALIAS).forEach(k => { raw[k] = col[k] === undefined ? '' : String(f[col[k]] ?? ''); });
    if (!str(raw.codificacion)) return;
    const cat = categoria(raw.categoria);
    out.push({
      id: idDeCodigo(raw.codificacion), origen: 'hoja', fila: raw.fila, raw,
      tipo: cat === 'Con chapa' ? 'maquina-cc' : cat === 'Sin chapa' ? 'maquina-sc' : 'maquina',
      codigo: str(raw.codificacion), categoria: cat, serial: serial(raw.serial), escalera: lado(raw.escalera),
      condicion: condicion(raw.condicion), imagen: /^https:\/\//.test(str(raw.imagen, 1000)) ? str(raw.imagen, 1000) : '', letra: letraDe(raw.codificacion)
    });
  });
  return out;
}

/* ── Estado en memoria ── */
export const M = { maquinas: [], estado: 'inicial', error: null, leido: null, desdeCache: false };

export async function cargarHoja() {
  M.estado = 'cargando'; M.error = null;
  try {
    const filas = await readPublicSheet(CFG.SPREADSHEET_ID, { tab: (CFG.MACHINES_TABS || [''])[0] || '' });
    M.maquinas = unidadesDeFilas(filas); M.leido = ahora(); M.desdeCache = false; M.estado = 'listo';
    escribir(K.cache, { fecha: M.leido, filas });
  } catch (e) {
    // Sin conexión o error: se usa la última lectura correcta, avisando que puede no estar al día.
    const c = leer(K.cache);
    if (c && Array.isArray(c.filas)) { M.maquinas = unidadesDeFilas(c.filas); M.leido = c.fecha; M.desdeCache = true; M.estado = 'listo'; }
    else M.estado = 'error';
    M.error = e;
  }
  sembrarKits();
  return M;
}

/* ── Datos complementarios de las máquinas de la hoja ── */
export const ESTADOS_OPERATIVOS = ['Operativa', 'En revisión', 'Fuera de servicio'];
export const complementos = () => { const v = leer(K.complementos); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
export function guardarComplemento(id, datos, nota) {
  const c = complementos(), prev = c[id] || { historial: [] };
  c[id] = { marca: str(datos.marca, 120), modelo: str(datos.modelo, 120), ubicacion: str(datos.ubicacion, 200),
    estadoOperativo: ESTADOS_OPERATIVOS.includes(datos.estadoOperativo) ? datos.estadoOperativo : '', observaciones: str(datos.observaciones, 2000),
    historial: [...(prev.historial || []), { fecha: ahora(), nota: nota || 'Datos complementarios editados.' }].slice(-200) };
  return escribir(K.complementos, c);
}

/* ── Soportes (unidades creadas en la aplicación; sin serial inventado) ── */
export const soportes = () => { const v = leer(K.soportes); return Array.isArray(v) ? v.filter(s => s && s.id) : []; };
export function guardarSoporte(datos, id) {
  const l = soportes(), i = id ? l.findIndex(s => s.id === id) : -1;
  const base = i >= 0 ? l[i] : { id: 'SP-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 6).toUpperCase() : Date.now().toString(36).toUpperCase()), creado: ahora(), historial: [] };
  const s = { ...base, origen: 'aplicacion', tipo: 'soporte', codigo: str(datos.codigo, 60), serial: str(datos.serial, 80),
    marca: str(datos.marca, 120), modelo: str(datos.modelo, 120), ubicacion: str(datos.ubicacion, 200),
    condicion: ['En stock', 'Vendida'].includes(datos.condicion) ? datos.condicion : 'En stock',
    estadoOperativo: ESTADOS_OPERATIVOS.includes(datos.estadoOperativo) ? datos.estadoOperativo : '', observaciones: str(datos.observaciones, 2000), imagen: '' };
  s.historial = [...(base.historial || []), { fecha: ahora(), nota: i >= 0 ? 'Soporte editado.' : 'Soporte registrado.' }].slice(-200);
  if (i >= 0) l[i] = s; else l.push(s);
  escribir(K.soportes, l);
  return s;
}
export function eliminarSoporte(id) {
  if (kitsActivos().some(k => Object.values(k.posiciones).includes(id))) return false;
  if (unidades().some(u => u.id === id && u.instalada)) return false;   // instalado en un taller: se conserva su trayectoria
  escribir(K.soportes, soportes().filter(s => s.id !== id));
  return true;
}

/* ── Todas las unidades (máquinas de la hoja + complemento, y soportes) ── */
/* Condición efectiva: una unidad con instalación activa en un taller de cliente cuenta como vendida aunque la hoja
   siga diciendo «En stock» (la aplicación no revierte la venta ni escribe en la hoja; se marca la diferencia).
   La instalación se lee directamente de su clave para no crear una dependencia circular con maq-postventa.js. */
const instalacionesActivas = () => { const v = leer(PREFIJO + 'maq-instalaciones'); return Array.isArray(v) ? v.filter(x => x && x.activa !== false && x.unidadId) : []; };
/* Equipos propios en operación en nuestro taller (maq-operacion.js): no cuentan en stock mientras operan. */
const operacionActiva = () => { const v = leer(PREFIJO + 'maq-operacion'); return Array.isArray(v) ? v.filter(x => x && x.activa !== false && x.unidadId) : []; };
export function unidades() {
  const c = complementos(), inst = Object.fromEntries(instalacionesActivas().map(x => [x.unidadId, x]));
  const oper = new Set(operacionActiva().map(x => x.unidadId));
  const efectiva = u => {
    const i = inst[u.id], op = !i && oper.has(u.id);
    return { ...u, condicionHoja: u.condicion, condicion: i ? 'Vendida' : op ? 'En operación' : u.condicion, tallerId: i ? i.tallerId || '' : '', ventaId: i ? i.ventaId || '' : '', instalada: !!i, enOperacion: op,
      diferenciaHoja: !!i && u.origen === 'hoja' && u.condicion !== 'Vendida' };
  };
  const maqs = M.maquinas.map(u => efectiva({ ...u, marca: '', modelo: '', ubicacion: '', estadoOperativo: '', observaciones: '', historial: [], ...(c[u.id] || {}) }));
  return [...maqs, ...soportes().map(efectiva)];
}
export const unidadPorId = id => unidades().find(u => u.id === id);
export const TIPOS_UNIDAD = { 'maquina-cc': 'Máquina con chapa', 'maquina-sc': 'Máquina sin chapa', maquina: 'Máquina (categoría sin definir)', soporte: 'Soporte' };

/* ── Kits ── */
export const POSICIONES = [
  { id: 'cc', titulo: 'Máquina con chapa', tipo: 'maquina-cc' },
  { id: 'sc', titulo: 'Máquina sin chapa', tipo: 'maquina-sc' },
  { id: 's1', titulo: 'Soporte 1', tipo: 'soporte' },
  { id: 's2', titulo: 'Soporte 2', tipo: 'soporte' }
];
const normKit = k => ({ id: str(k.id, 40), codigo: str(k.codigo, 40), activo: k.activo !== false, origen: str(k.origen, 300), observaciones: str(k.observaciones, 2000),
  posiciones: Object.fromEntries(POSICIONES.map(p => [p.id, str((k.posiciones || {})[p.id], 60)])),
  creado: str(k.creado, 40), historial: (Array.isArray(k.historial) ? k.historial : []).slice(-200) });
export const kits = () => { const v = leer(K.kits); return Array.isArray(v) ? v.map(normKit).filter(k => k.id) : []; };
export const kitsActivos = () => kits().filter(k => k.activo);
const guardarKits = l => escribir(K.kits, l);
export const kitDeUnidad = id => kitsActivos().find(k => Object.values(k.posiciones).includes(id)) || null;

/* Los kits A–G se registran UNA vez a partir de la letra del código, solo si la letra tiene exactamente una máquina
   con chapa y una sin chapa con escaleras opuestas (regla confirmada). Los soportes quedan pendientes. */
function sembrarKits() {
  if (leer(K.sembrado) || M.estado !== 'listo' || !M.maquinas.length) return;
  const l = kits(), porLetra = {};
  M.maquinas.forEach(u => { if (u.letra) (porLetra[u.letra] = porLetra[u.letra] || []).push(u); });
  Object.entries(porLetra).sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).forEach(([letra, us]) => {
    const cc = us.filter(u => u.tipo === 'maquina-cc'), sc = us.filter(u => u.tipo === 'maquina-sc');
    if (cc.length !== 1 || sc.length !== 1 || us.length !== 2) return;
    if (!opuestas(cc[0], sc[0])) return;
    if (l.some(k => k.codigo === letra) || kitDeUnidad(cc[0].id) || kitDeUnidad(sc[0].id)) return;
    l.push(normKit({ id: 'KIT-' + letra, codigo: letra, activo: true, creado: ahora(),
      origen: 'Registrado por la letra del código (regla confirmada por Cristian el 16/11/2026: máquina con chapa + sin chapa con escaleras opuestas + dos soportes).',
      posiciones: { cc: cc[0].id, sc: sc[0].id, s1: '', s2: '' },
      historial: [{ fecha: ahora(), nota: `Kit registrado con ${cc[0].codigo} y ${sc[0].codigo}. Soportes pendientes.` }] }));
  });
  guardarKits(l); escribir(K.sembrado, { fecha: ahora() });
}
export const opuestas = (a, b) => ['Derecha', 'Izquierda'].includes(a.escalera) && ['Derecha', 'Izquierda'].includes(b.escalera) && a.escalera !== b.escalera;

/* Evaluación de un kit: completo solo si sus cuatro posiciones tienen unidades existentes del tipo correcto. */
export function evaluarKit(k) {
  const us = Object.fromEntries(POSICIONES.map(p => [p.id, k.posiciones[p.id] ? unidadPorId(k.posiciones[p.id]) : null]));
  const avisos = [];
  POSICIONES.forEach(p => {
    const id = k.posiciones[p.id], u = us[p.id];
    if (id && !u) avisos.push(`${p.titulo}: la unidad ${id} ya no existe.`);
    if (u && u.tipo !== p.tipo) avisos.push(`${p.titulo}: ${u.codigo || u.id} no es del tipo esperado.`);
  });
  if (us.cc && us.sc && !opuestas(us.cc, us.sc)) avisos.push('Las escaleras de las dos máquinas no son opuestas.');
  const asignadas = POSICIONES.filter(p => us[p.id] && us[p.id].tipo === p.tipo).length;
  const conds = [...new Set(Object.values(us).filter(Boolean).map(u => u.condicion))];
  return { unidades: us, asignadas, completo: asignadas === 4 && !avisos.length, avisos,
    disponibilidad: !conds.length ? 'Sin unidades' : conds.length > 1 ? 'Condición mixta' : conds[0] };
}

/* Asignar o quitar una unidad de una posición, con las reglas del kit. Devuelve un mensaje de error o ''. */
export function asignar(kitId, pos, unidadId) {
  const l = kits(), k = l.find(x => x.id === kitId), p = POSICIONES.find(x => x.id === pos);
  if (!k || !p) return 'Kit o posición no válidos.';
  if (!k.activo) return 'El kit está desactivado.';
  const anterior = k.posiciones[pos];
  if (unidadId) {
    const u = unidadPorId(unidadId);
    if (!u) return 'La unidad no existe.';
    if (u.tipo !== p.tipo) return `${u.codigo || u.id} no corresponde a la posición «${p.titulo}».`;
    const otro = kitDeUnidad(unidadId);
    if (otro && otro.id !== kitId) return `${u.codigo || u.id} ya pertenece al kit ${otro.codigo}. Quita la unidad de ese kit primero.`;
    if (pos === 'cc' || pos === 'sc') {
      const par = unidadPorId(k.posiciones[pos === 'cc' ? 'sc' : 'cc']);
      if (par && !opuestas(u, par)) return `Las escaleras deben ser opuestas: ${u.codigo} (${u.escalera || 'sin dato'}) y ${par.codigo} (${par.escalera || 'sin dato'}).`;
    }
    if (pos.startsWith('s') && Object.entries(k.posiciones).some(([q, v]) => q !== pos && v === unidadId)) return 'Ese soporte ya está en otra posición del kit.';
  }
  k.posiciones[pos] = unidadId || '';
  const nombre = id => { const u = id && unidadPorId(id); return u ? (u.codigo || u.id) : id; };
  k.historial.push({ fecha: ahora(), nota: unidadId ? `${p.titulo}: ${nombre(unidadId)}${anterior ? ` (antes ${nombre(anterior)})` : ''}.` : `${p.titulo}: se quitó ${nombre(anterior)}.` });
  guardarKits(l);
  return '';
}
export function crearKit(codigo, observaciones) {
  const c = str(codigo, 40).toUpperCase(); if (!c) return { error: 'Escribe el código del kit.' };
  const l = kits(); if (l.some(k => k.activo && k.codigo === c)) return { error: `Ya existe un kit activo con el código ${c}.` };
  const k = normKit({ id: 'KIT-' + c + (l.some(x => x.id === 'KIT-' + c) ? '-' + Date.now().toString(36) : ''), codigo: c, activo: true, creado: ahora(),
    origen: 'Creado en la aplicación.', observaciones, posiciones: {}, historial: [{ fecha: ahora(), nota: 'Kit creado sin unidades.' }] });
  l.push(k); guardarKits(l); return { kit: k };
}
/* Desactivar libera sus unidades (quedan sueltas) y conserva el kit con su historial. */
export function desactivarKit(id) {
  const l = kits(), k = l.find(x => x.id === id); if (!k) return;
  k.activo = false; k.historial.push({ fecha: ahora(), nota: `Kit desactivado; unidades liberadas: ${Object.values(k.posiciones).filter(Boolean).join(', ') || 'ninguna'}.` });
  guardarKits(l);
}

/* Unidades sueltas (sin kit activo) y estimación separada de kits que podrían armarse con ellas. */
export function sueltas() { return unidades().filter(u => !kitDeUnidad(u.id) && !u.instalada && !u.enOperacion); }
export function estimacionArmables() {
  const libres = sueltas().filter(u => u.condicion === 'En stock');
  const n = (t, l) => libres.filter(u => u.tipo === t && u.escalera === l).length;
  const pares = Math.min(n('maquina-cc', 'Derecha'), n('maquina-sc', 'Izquierda')) + Math.min(n('maquina-cc', 'Izquierda'), n('maquina-sc', 'Derecha'));
  const sop = libres.filter(u => u.tipo === 'soporte').length;
  return { pares, soportes: sop, kits: Math.min(pares, Math.floor(sop / 2)) };
}

/* ── Edición en la hoja (Apps Script existente, con clave) ── */
let claveEdicion = '';   // solo en memoria mientras la página está abierta
export const puedeEditarHoja = () => !!CFG.EDIT_URL;
export const tieneClave = () => !!claveEdicion;
export function llamarScript(payload, url = CFG.EDIT_URL) {
  return new Promise((resolve, reject) => {
    if (navigator.onLine === false) return reject(Object.assign(new Error('No hay conexión a internet.'), { code: 'NETWORK' }));
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const name = 'ccs-script-' + id;
    const popup = window.open('', name, 'popup,width=480,height=560');
    if (!popup) return reject(Object.assign(new Error('El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para esta página y vuelve a intentarlo.'), { code: 'POPUP_BLOCKED' }));
    try { popup.document.title = 'Guardando…'; popup.document.body.innerHTML = '<p style="font:16px system-ui,sans-serif;padding:24px">Conectando con Google Sheets…</p>'; } catch { /* sin acceso */ }
    const form = Object.assign(document.createElement('form'), { method: 'POST', action: url, target: name, acceptCharset: 'UTF-8' });
    form.style.display = 'none';
    form.appendChild(Object.assign(document.createElement('input'), { type: 'hidden', name: 'payload', value: JSON.stringify({ ...payload, id, origin: location.origin }) }));
    let hecho = false;
    const fin = (fn, arg) => { if (hecho) return; hecho = true; clearInterval(vigila); clearTimeout(total); window.removeEventListener('message', alMensaje); form.remove(); fn(arg); };
    function alMensaje(e) {
      const d = e.data; if (!d || !d.ccsMaquinas || d.id !== id) return;
      if (!/(^|\.)googleusercontent\.com$|(^|\.)google\.com$/.test(new URL(e.origin).hostname)) return;
      const r = d.res || {};
      if (r.ok) setTimeout(() => { try { popup.close(); } catch { /* cerrada */ } }, 900);
      r.ok ? fin(resolve, r) : fin(reject, Object.assign(new Error(r.error || 'Error del script de edición.'), { code: r.code, data: r }));
    }
    window.addEventListener('message', alMensaje);
    const vigila = setInterval(() => { if (popup.closed) fin(reject, Object.assign(new Error('La ventana de Google se cerró sin confirmar. Si decía «Guardado», pulsa «Actualizar» para verlo.'), { code: 'POPUP_CLOSED' })); }, 600);
    const total = setTimeout(() => fin(reject, Object.assign(new Error('Google tardó demasiado en responder.'), { code: 'TIMEOUT' })), 180000);
    document.body.append(form); form.submit();
  });
}
const ORIGINALES = ['codificacion', 'categoria', 'serial', 'escalera', 'condicion', 'imagen'];
export async function editarEnHoja(u, datos, clave) {
  const c = clave || claveEdicion; if (!c) throw Object.assign(new Error('Escribe la clave de edición.'), { code: 'NO_KEY' });
  const original = Object.fromEntries(ORIGINALES.map(f => [f, u.raw[f] ?? '']));
  try {
    const r = await llamarScript({ accion: 'editar', clave: c, cambios: [{ fila: u.fila, original, datos }] });
    claveEdicion = c; return r;
  } catch (e) { if (e.code === 'UNAUTHORIZED') claveEdicion = ''; throw e; }
}
export async function agregarEnHoja(datos, clave) {
  const c = clave || claveEdicion; if (!c) throw Object.assign(new Error('Escribe la clave de edición.'), { code: 'NO_KEY' });
  try { const r = await llamarScript({ accion: 'agregar', clave: c, datos }); claveEdicion = c; return r; }
  catch (e) { if (e.code === 'UNAUTHORIZED') claveEdicion = ''; throw e; }
}

/* Al cambiar el código de una máquina en la hoja, su identificador cambia: se trasladan su complemento y su kit. */
export function renombrarUnidad(idViejo, idNuevo) {
  if (!idViejo || idViejo === idNuevo) return;
  const c = complementos(); if (c[idViejo]) { c[idNuevo] = c[idViejo]; delete c[idViejo]; escribir(K.complementos, c); }
  const l = kits(); let cambio = false;
  l.forEach(k => Object.keys(k.posiciones).forEach(p => { if (k.posiciones[p] === idViejo) { k.posiciones[p] = idNuevo; cambio = true; k.historial.push({ fecha: ahora(), nota: `Código actualizado: ${idViejo} → ${idNuevo}.` }); } }));
  if (cambio) guardarKits(l);
}
