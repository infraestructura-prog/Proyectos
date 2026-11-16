/* Guardado automático compartido (Supabase).
   · Cada aplicación sigue guardando en este navegador; este módulo detecta esos cambios y los envía solos a la
     base compartida (tabla «registros»), y recibe al momento los cambios de los demás (tiempo real).
   · Leer es público. Guardar exige el PIN y el nombre de quien hace el cambio (queda en el historial «cambios»).
   · Los teléfonos se separan del registro público y se guardan aparte: solo se ven con el PIN.
   · Cada registro lleva su versión. Si otra persona lo cambió antes, se conserva la versión compartida y la propia
     queda en «Cambios no aplicados» para revisarla: nada se pierde.
   · La primera carga (nube vacía) no es automática: la hace una persona a propósito con «Subir datos iniciales». */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './nube-config.js';

const CDN_SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
export const OCULTO = '•••';            // marca de un teléfono protegido (sin PIN)
const sesion = window.sessionStorage;

let C = null;                           // configuración de la aplicación
let sb = null, canal = null, aplicandoRemoto = false, temporizador = null, reintento = null;
const est = { fase: 'inicial', pendientes: 0, ultimo: '', error: '', nubeVacia: false, desbloqueado: false, enviando: false };
const oyentes = new Set();
export const estado = () => ({ ...est });
export const alCambiar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisar = () => oyentes.forEach(f => { try { f(estado()); } catch { /* vista */ } });

const leerLS = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } };
const escribirLS = (k, v) => { aplicandoRemoto = true; try { if (v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } finally { aplicandoRemoto = false; } };
const kBase = () => C.prefijo + 'nube-base', kNoAp = () => C.prefijo + 'nube-no-aplicados', kAutor = 'ccs-nube-autor', kPin = 'ccs-nube-pin';
const kCopia = () => C.prefijo + 'nube-copia-previa';
/* Copia de lo que tenía este navegador antes de su primera conexión, cuando difería de la versión compartida. */
export const copiaPrevia = () => { const v = leerLS(kCopia()); return Array.isArray(v) ? v : []; };
export const borrarCopiaPrevia = () => escribirLS(kCopia(), undefined);
export const autor = () => { try { return localStorage.getItem(kAutor) || ''; } catch { return ''; } };
const pin = () => { try { return sesion.getItem(kPin) || ''; } catch { return ''; } };
export const noAplicados = () => { const v = leerLS(kNoAp()); return Array.isArray(v) ? v : []; };
export const descartarNoAplicados = () => escribirLS(kNoAp(), []);
export const configurada = () => !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/* ── Separar teléfonos del registro público ──
   Cualquier clave que empiece por «telefono» con valor, y en los historiales de cambios los valores antes/después
   de los campos «telefono» y «contactos». La versión pública lleva OCULTO en su lugar. */
const esc = k => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
const desc = k => String(k).replace(/~1/g, '/').replace(/~0/g, '~');
export function separar(valor) {
  const prot = {};
  const recorrer = (v, ruta) => {
    if (Array.isArray(v)) return v.map((x, i) => recorrer(x, `${ruta}/${i}`));
    if (!v || typeof v !== 'object') return v;
    const sensible = v.campo === 'telefono' || v.campo === 'contactos', out = {};
    for (const [k, x] of Object.entries(v)) {
      const r = `${ruta}/${esc(k)}`;
      if (/^telefono/i.test(k) && typeof x === 'string' && x !== '') { if (x !== OCULTO) prot[r] = x; out[k] = OCULTO; }
      else if (sensible && (k === 'antes' || k === 'despues') && x !== null && x !== undefined && x !== '' && x !== OCULTO) { prot[r] = x; out[k] = OCULTO; }
      else out[k] = recorrer(x, r);
    }
    return out;
  };
  const pub = recorrer(valor, '');
  return { pub, prot: Object.keys(prot).length ? prot : null };
}
export function unir(pub, prot) {
  if (!prot) return pub;
  const v = JSON.parse(JSON.stringify(pub));
  for (const [ruta, x] of Object.entries(prot)) {
    const partes = ruta.split('/').slice(1).map(desc); let o = v;
    for (let i = 0; i < partes.length - 1 && o; i++) o = o[partes[i]];
    if (o && typeof o === 'object' && o[partes[partes.length - 1]] === OCULTO) o[partes[partes.length - 1]] = x;
  }
  return v;
}

/* ── Colecciones: valor local ⇄ registros ── */
function registrosLocales(c) {
  const v = leerLS(c.key), o = {};
  if (v === undefined || v === null) return o;
  if (c.forma === 'lista') { if (Array.isArray(v)) v.forEach(x => { const id = c.idDe ? c.idDe(x) : x && x.id; if (id) o[String(id)] = x; }); }
  else if (c.forma === 'mapa') { if (typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([id, x]) => { if (x && typeof x === 'object') o[id] = x; }); }
  else if (typeof v === 'object') o._ = v;
  return o;
}
function escribirColeccion(c, regs, ordenPrevio) {
  const ids = Object.keys(regs);
  if (c.forma === 'lista') {
    // Conserva el orden local y agrega al final lo nuevo.
    const orden = ordenPrevio.filter(id => ids.includes(id)).concat(ids.filter(id => !ordenPrevio.includes(id)));
    escribirLS(c.key, orden.map(id => regs[id]));
  } else if (c.forma === 'mapa') escribirLS(c.key, Object.fromEntries(ids.map(id => [id, regs[id]])));
  else escribirLS(c.key, regs._);
}
const huella = x => JSON.stringify(x);

/* Cambios locales respecto de lo último recibido de la nube. */
export function pendientes() {
  const base = leerLS(kBase()) || {}, l = [];
  C.colecciones.forEach(c => {
    const loc = registrosLocales(c), b = base[c.col] || {};
    Object.entries(loc).forEach(([id, x]) => {
      const { pub, prot } = separar(x), bb = b[id];
      if (!bb || bb.h !== huella(pub) || (est.desbloqueado && prot && bb.p !== huella(prot))) l.push({ c, id, pub, prot, base: bb ? bb.v : 0 });
    });
    Object.entries(b).forEach(([id, bb]) => { if (bb.h !== null && !(id in loc)) l.push({ c, id, pub: null, prot: null, base: bb.v }); });
  });
  return l;
}

/* ── Arranque ── */
export async function iniciar(config) {
  C = config;
  if (!configurada()) { est.fase = 'sin-config'; avisar(); return; }
  // Escucha los guardados de la aplicación (todas guardan con localStorage) para enviarlos solos.
  const original = Storage.prototype.setItem, quitar = Storage.prototype.removeItem;
  const vigiladas = new Set(C.colecciones.map(c => c.key));
  Storage.prototype.setItem = function (k, v) { original.call(this, k, v); if (this === localStorage && !aplicandoRemoto && vigiladas.has(k)) programarEnvio(); };
  Storage.prototype.removeItem = function (k) { quitar.call(this, k); if (this === localStorage && !aplicandoRemoto && vigiladas.has(k)) programarEnvio(); };
  window.addEventListener('online', () => programarEnvio(200));
  est.fase = 'conectando'; avisar();
  try {
    const { createClient } = await import(CDN_SUPABASE);
    sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if (pin()) est.desbloqueado = true;   // sin PIN, los teléfonos se ocultan solo en pantalla (nunca se borran del navegador)
    await descargar(true);
    escucharTiempoReal();
    est.fase = 'listo'; avisar();
    if (est.desbloqueado) await cargarProtegidos().catch(() => {});
    programarEnvio(300);
  } catch (e) { est.fase = 'error'; est.error = mensaje(e); avisar(); reintento = setTimeout(() => iniciar(C), 30000); }
}
const mensaje = e => (e && (e.message || e.error_description)) || 'No se pudo conectar con la base compartida.';

/* Descarga todo lo de la aplicación y lo combina con lo local. */
async function descargar(inicial) {
  const filas = []; const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await sb.from('registros').select('coleccion,id,datos,version').eq('app', C.app).range(desde, desde + paso - 1);
    if (error) throw error;
    filas.push(...data); if (data.length < paso) break;
  }
  est.nubeVacia = filas.length === 0;
  // Base vacía (por ejemplo, después de borrar datos de prueba): se olvida lo recibido antes para poder volver a subir.
  if (est.nubeVacia) escribirLS(kBase(), {});
  const porCol = {}; filas.forEach(f => { (porCol[f.coleccion] = porCol[f.coleccion] || []).push(f); });
  const cambiadas = combinar(porCol, inicial && est.nubeVacia);
  if (cambiadas.length && est.desbloqueado) await cargarProtegidos().catch(() => {});
  if (cambiadas.length && C.alRecibir) C.alRecibir(cambiadas);
}

/* Combina filas de la nube con lo local. Devuelve las colecciones que cambiaron en el navegador. */
function combinar(porCol, nubeVacia) {
  if (nubeVacia) return [];                       // la primera carga la decide una persona (subirDatosIniciales)
  const base = leerLS(kBase()) || {}, guardados = noAplicados(), copia = copiaPrevia(), ahora = new Date().toISOString(), cambiadas = [];
  C.colecciones.forEach(c => {
    const filas = porCol[c.col]; if (!filas) return;
    const loc = registrosLocales(c), orden = Object.keys(loc), b = base[c.col] || (base[c.col] = {});
    let cambio = false;
    filas.forEach(f => {
      const bb = b[f.id], l = loc[f.id];
      const lpub = l ? huella(separar(l).pub) : null;
      const localCambiado = bb ? (l ? lpub !== bb.h : bb.h !== null) : !!l;
      if (bb && bb.v === f.version) return;       // ya estaba al día
      if (localCambiado && l && (!f.datos || lpub !== huella(f.datos))) {
        // Otra persona lo cambió y aquí también: se conserva la versión compartida y la propia queda para revisar.
        (bb ? guardados : copia).push({ coleccion: c.col, id: f.id, datos: l, fecha: ahora });   // primera conexión: va a la copia previa
      }
      // Se toma la versión compartida tal cual; sus teléfonos se completan después con el PIN (cargarProtegidos).
      if (f.datos) loc[f.id] = f.datos; else delete loc[f.id];
      b[f.id] = { v: f.version, h: f.datos ? huella(f.datos) : null, p: (bb && bb.p) || null };
      cambio = true;
    });
    if (cambio) { escribirColeccion(c, loc, orden); cambiadas.push(c.col); }
  });
  escribirLS(kBase(), base); escribirLS(kNoAp(), guardados.slice(-300)); if (copia.length) escribirLS(kCopia(), copia.slice(-2000));
  return cambiadas;
}

function escucharTiempoReal() {
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('registros-' + C.app)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registros', filter: `app=eq.${C.app}` }, p => {
      const f = p.new && p.new.id ? p.new : null; if (!f) return;
      const cambiadas = combinar({ [f.coleccion]: [f] }, false);
      est.nubeVacia = false;
      if (cambiadas.length) {
        if (est.desbloqueado && f.datos && JSON.stringify(f.datos).includes(OCULTO)) cargarProtegidos().catch(() => {});
        if (C.alRecibir) C.alRecibir(cambiadas);
      }
      avisar();
    })
    .subscribe(s => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { est.error = 'Sin conexión en tiempo real; se reintentará.'; avisar(); } });
}

/* Teléfonos: se piden con el PIN y se ponen en lugar de la marca. */
async function cargarProtegidos() {
  const { data, error } = await sb.rpc('leer_protegidos', { p_pin: pin(), p_app: C.app });
  if (error) throw error;
  const porCol = {}; (data || []).forEach(x => { (porCol[x.coleccion] = porCol[x.coleccion] || {})[x.id] = x.datos; });
  const base = leerLS(kBase()) || {}, cambiadas = [];
  C.colecciones.forEach(c => {
    const prot = porCol[c.col]; if (!prot) return;
    const loc = registrosLocales(c), orden = Object.keys(loc); let cambio = false;
    Object.entries(prot).forEach(([id, p]) => {
      if (!loc[id]) return;
      const nuevo = unir(loc[id], p); if (huella(nuevo) !== huella(loc[id])) { loc[id] = nuevo; cambio = true; }
      if (base[c.col] && base[c.col][id]) base[c.col][id].p = huella(p);
    });
    if (cambio) { escribirColeccion(c, loc, orden); cambiadas.push(c.col); }
  });
  escribirLS(kBase(), base);
  if (cambiadas.length && C.alRecibir) C.alRecibir(cambiadas);
}

/* ── PIN y nombre ── */
export async function desbloquear(nombre, p) {
  if (!sb) throw new Error('La base compartida no está disponible.');
  const n = String(nombre || '').trim().slice(0, 80); if (!n) throw new Error('Escribe tu nombre.');
  const { data, error } = await sb.rpc('comprobar_pin', { p_pin: String(p || '') });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('El PIN no es correcto.');
  try { localStorage.setItem(kAutor, n); sesion.setItem(kPin, String(p)); } catch { /* sin almacenamiento */ }
  est.desbloqueado = true; avisar();
  await cargarProtegidos();
  programarEnvio(100);
}
export function bloquear() { try { sesion.removeItem(kPin); } catch { /* */ } est.desbloqueado = false; avisar(); if (C.alRecibir) C.alRecibir(C.colecciones.map(c => c.col)); }

/* ── Envío automático ── */
function programarEnvio(ms = 800) {
  est.pendientes = C && sb ? pendientes().length : 0; avisar();
  clearTimeout(temporizador); temporizador = setTimeout(enviar, ms);
}
async function enviar() {
  if (!sb || est.enviando || est.fase !== 'listo') return;
  if (est.nubeVacia) { est.pendientes = 0; avisar(); return; }     // espera la carga inicial
  const l = pendientes(); est.pendientes = l.length;
  if (!l.length) { avisar(); return; }
  if (!est.desbloqueado || !autor()) { avisar(); return; }          // la vista pide nombre y PIN
  est.enviando = true; avisar();
  try {
    for (let i = 0; i < l.length; i += 200) {
      const lote = l.slice(i, i + 200);
      const { data, error } = await sb.rpc('guardar_cambios', { p_pin: pin(), p_autor: autor(), p_app: C.app,
        p_cambios: lote.map(x => {
          const o = { coleccion: x.c.col, id: x.id, datos: x.pub, base: x.base };
          // Si quedan teléfonos sin conocer (marca sin valor), no se envía la parte protegida: la nube conserva la suya.
          const marcas = x.pub ? (huella(x.pub).match(/•••/g) || []).length : 0, conocidos = x.prot ? Object.keys(x.prot).length : 0;
          if (!x.pub) o.protegido = null; else if (marcas <= conocidos) o.protegido = x.prot;
          return o;
        }) });
      if (error) throw error;
      // Lo aplicado pasa a ser la nueva base; los conflictos se resuelven al descargar.
      const base = leerLS(kBase()) || {}, conf = new Set((data.conflictos || []).map(x => x.coleccion + '|' + x.id));
      lote.forEach(x => { if (conf.has(x.c.col + '|' + x.id)) return; const b = base[x.c.col] || (base[x.c.col] = {});
        b[x.id] = { v: x.base + 1, h: x.pub ? huella(x.pub) : null, p: x.prot ? huella(x.prot) : null }; });
      escribirLS(kBase(), base);
      if (conf.size) await descargar(false);
    }
    est.ultimo = new Date().toISOString(); est.error = '';
  } catch (e) {
    est.error = mensaje(e);
    if (/PIN/.test(est.error)) bloquear();
    clearTimeout(reintento); reintento = setTimeout(() => programarEnvio(0), 30000);
  } finally { est.enviando = false; est.pendientes = pendientes().length; avisar(); }
}

/* Primera carga: sube todo lo de este navegador como punto de partida (solo con la nube vacía). */
export async function subirDatosIniciales() {
  if (!est.desbloqueado || !autor()) throw new Error('Escribe tu nombre y el PIN primero.');
  const { count, error } = await sb.from('registros').select('id', { count: 'exact', head: true }).eq('app', C.app);
  if (error) throw error;
  if (count) { est.nubeVacia = false; await descargar(false); throw new Error('La base ya tiene datos: no se subió nada para no reemplazarlos.'); }
  est.nubeVacia = false; await enviar();
  return pendientes().length === 0;
}

/* Historial de cambios (público, sin teléfonos). */
export async function historial(limite = 60) {
  if (!sb) return [];
  const { data, error } = await sb.from('cambios').select('fecha,autor,coleccion,registro_id,accion,version,cambio_protegido').eq('app', C.app).order('fecha', { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}
/* Los teléfonos se muestran solo con el PIN (o si la base compartida no está configurada). Se ocultan en pantalla:
   nunca se borran del navegador. */
export const telefonosVisibles = () => !configurada() || est.desbloqueado;
