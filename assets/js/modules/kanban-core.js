/* Motor común de los tableros Kanban (Infraestructura y Neotropya).
   Cada tablero se monta con mountKanban(root, cfg) y tiene su propio identificador (cfg.boardId),
   su clave de localStorage (cfg.storeKey) y sus datos iniciales (cfg.dataUrl), que se cargan UNA sola vez.
   Todos comparten el formato «ccs-kanban-v1» con un arreglo «tarjetas»; un archivo solo se importa
   en el tablero cuyo «id» coincide, para que los datos de un área no se mezclen con los de otra.
   No sincroniza con Google Sheets, Slack ni otras fuentes. */
import { esc, ICON, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';
import { ruleFor, applySubtaskRules, aggregate, mondayOf, weekLabel, weekObjId, weekOfObj, CONSOLIDACIONES } from './kanban-estructura.js';

const SCHEMA = 'ccs-kanban-v1';
const ESTRUCTURA_VERSION = 2;   // 2 = tarjetas agrupadas en macroobjetivos (campos macro / objetivoEsp / clasificada)

const COLS = [
  { id: 'todo', title: 'To do', help: 'Pendiente de iniciar.' },
  { id: 'doing', title: 'Doing', help: 'Trabajo en ejecución.' },
  { id: 'testing', title: 'Testing', help: 'Ejecución terminada; pendiente de prueba, inspección o aceptación.' },
  { id: 'blocked', title: 'Blocked', help: 'No puede continuar por una dependencia identificada.' },
  { id: 'done', title: 'Done', help: 'Objetivo completado y validado.' }
];
const COL_IDS = COLS.map(c => c.id);
const colTitle = id => (COLS.find(c => c.id === id) || {}).title || id;
const PRIOS = [{ id: 'critica', label: 'Crítica' }, { id: 'alta', label: 'Alta' }, { id: 'media', label: 'Media' }, { id: 'baja', label: 'Baja' }];
const prioLabel = p => (PRIOS.find(x => x.id === p) || {}).label || 'Por confirmar';

const small = icon => icon.replace('<svg', '<svg width="15" height="15"');
const nowIso = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtD = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
const parseD = s => { const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const uid = p => p + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const httpsUrl = s => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };

/* ═════════ Modelo ═════════ */
function normCard(c, i = 0) {
  const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const f = c.fechas || {};
  const blk = b => (b && typeof b === 'object' ? { quien: str(b.quien, 160), motivo: str(b.motivo, 600), accion: str(b.accion, 600) } : null);
  return {
    id: str(c.id, 80), titulo: str(c.titulo, 200), objetivo: str(c.objetivo, 600), descripcion: str(c.descripcion), criterio: str(c.criterio, 600),
    estado: COL_IDS.includes(c.estado) ? c.estado : 'todo', estadoPorConfirmar: !!c.estadoPorConfirmar,
    prioridad: PRIOS.some(p => p.id === c.prioridad) ? c.prioridad : '',
    proyecto: str(c.proyecto, 80), equipo: str(c.equipo, 160),
    responsable: str(c.responsable, 120), supervisor: str(c.supervisor, 120), solicitante: str(c.solicitante, 200), dependenciaExterna: str(c.dependenciaExterna, 160),
    colaboradores: str(c.colaboradores, 300),
    referencias: (Array.isArray(c.referencias) ? c.referencias : []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 30)).slice(0, 20),
    proximaAccion: str(c.proximaAccion, 600),
    // «revision»: fecha de revisión acordada (no es cierre ni vence la tarjeta). «plazo»: plazo sin día fijo («Esta semana…»).
    fechas: { original: date(f.original), reprogramada: date(f.reprogramada), revision: date(f.revision), plazo: str(f.plazo, 160),
      condicionadas: (Array.isArray(f.condicionadas) ? f.condicionadas : []).map(x => ({ fecha: date(x && x.fecha), condicion: str(x && x.condicion, 200) })).filter(x => x.fecha || x.condicion).slice(0, 20) },
    // «fase»: objetivo específico al que pertenece la subtarea de una actividad principal. «equivale»: id del hito que ya la registra.
    subtareas: (Array.isArray(c.subtareas) ? c.subtareas : []).map((s, k) => ({ id: str(s && s.id, 40) || `s${k + 1}`, texto: str(s && s.texto, 300), hecha: !!(s && s.hecha),
      fase: str(s && s.fase, 80), equivale: str(s && s.equivale, 80) })).filter(s => s.texto).slice(0, 60),
    notas: str(c.notas, 4000),
    enlaces: (Array.isArray(c.enlaces) ? c.enlaces : []).filter(u => typeof u === 'string' && httpsUrl(u)).slice(0, 20),
    bloqueo: blk(c.bloqueo), testing: c.testing ? { comprobar: str(c.testing.comprobar, 600), esperado: str(c.testing.esperado, 600) } : null,
    cierre: c.cierre ? { nota: str(c.cierre.nota, 1000), fecha: date(c.cierre.fecha) } : null,
    historial: (Array.isArray(c.historial) ? c.historial : []).filter(h => h && typeof h === 'object').map(h => ({ fecha: str(h.fecha, 40), tipo: str(h.tipo, 30), de: str(h.de, 20), a: str(h.a, 20), nota: str(h.nota, 1200) })).slice(-200),
    hito: !!c.hito, transversal: !!c.transversal, archivada: !!c.archivada,
    vinculadas: (Array.isArray(c.vinculadas) ? c.vinculadas : []).filter(x => typeof x === 'string').slice(0, 30),
    orden: Number.isFinite(c.orden) ? c.orden : i, creada: str(c.creada, 40),
    // Estructura: macroobjetivo y objetivo específico; «clasificada» = ya migrada o asignada a mano (no se reclasifica).
    macro: str(c.macro, 60), objetivoEsp: str(c.objetivoEsp, 80), clasificada: !!c.clasificada,
    // Identificadores anteriores de la misma actividad (p. ej. tras consolidar duplicados).
    alias: (Array.isArray(c.alias) ? c.alias : []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 80)).slice(0, 10),
    // Tarjeta consolidada en otro tablero: se conserva con sus datos, pero solo se consulta desde aquí.
    enlace: c.enlace && typeof c.enlace === 'object' && str(c.enlace.tablero, 60) && str(c.enlace.id, 80)
      ? { tablero: str(c.enlace.tablero, 60), id: str(c.enlace.id, 80), fecha: str(c.enlace.fecha, 40) } : null
  };
}

export function validateBoard(obj, boardId, boardName = 'este tablero') {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
  if (obj.schema !== SCHEMA) return { ok: false, error: `El archivo no es un tablero Kanban (se esperaba «${SCHEMA}»).` };
  if (obj.id !== boardId) return { ok: false, error: `El archivo pertenece al tablero «${typeof obj.id === 'string' ? obj.id : 'sin identificar'}» y aquí solo se importan tarjetas de «${boardId}» (${boardName}). Los tableros se mantienen separados.` };
  if (!Array.isArray(obj.tarjetas)) return { ok: false, error: 'Falta la lista de tarjetas.' };
  if (obj.tarjetas.length > 1000) return { ok: false, error: 'El archivo tiene demasiadas tarjetas.' };
  const cards = obj.tarjetas.map(normCard);
  const bad = cards.findIndex(c => !c.id || !c.titulo);
  if (bad >= 0) return { ok: false, error: `La tarjeta n.º ${bad + 1} no tiene identificador o título.` };
  if (new Set(cards.map(c => c.id)).size !== cards.length) return { ok: false, error: 'Hay tarjetas con el mismo identificador.' };
  return { ok: true, value: cards };
}

/* Archivo de UNA actividad para crear una tarjeta nueva desde «Nueva tarjeta › Cargar JSON».
   Acepta { schema: 'ccs-kanban-tarjeta-v1', tablero, tarjeta: {...} }, la tarjeta sola, o un archivo
   «ccs-kanban-v1» con una única tarjeta. Devuelve la tarjeta normalizada (sin historial) o un error. */
const CARD_SCHEMA = 'ccs-kanban-tarjeta-v1';
// Las columnas que exigen un formulario solo se respetan si el archivo trae esos datos; si no, la tarjeta entra en To do.
const stateOk = c => ({ todo: true, doing: true, blocked: !!(c.bloqueo && c.bloqueo.motivo && c.bloqueo.accion),
  testing: !!(c.testing && c.testing.comprobar && c.testing.esperado), done: !!(c.cierre && c.cierre.nota) })[c.estado];
export function parseCardFile(obj, boardId) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
  let t = obj, board = '';
  if (obj.schema === CARD_SCHEMA) { t = obj.tarjeta; board = obj.tablero; }
  else if (obj.schema === SCHEMA) {
    board = obj.id;
    if (!Array.isArray(obj.tarjetas) || obj.tarjetas.length !== 1) return { ok: false, error: `El archivo tiene ${Array.isArray(obj.tarjetas) ? obj.tarjetas.length : 0} tarjetas. Para varias usa «Importar JSON» del tablero.` };
    t = obj.tarjetas[0];
  } else if (obj.schema) return { ok: false, error: `Formato «${String(obj.schema).slice(0, 40)}» no reconocido (se esperaba «${CARD_SCHEMA}»).` };
  if (board && board !== boardId) return { ok: false, error: `La actividad es para el tablero «${String(board).slice(0, 40)}» y este es «${boardId}». Los tableros se mantienen separados.` };
  if (!t || typeof t !== 'object') return { ok: false, error: 'Falta la tarjeta en el archivo.' };
  const c = normCard(t);
  if (!c.titulo) return { ok: false, error: 'La actividad no tiene «titulo».' };
  const okState = stateOk(c);
  const aviso = okState ? '' : `El estado «${colTitle(c.estado)}» necesita sus datos (bloqueo, prueba o cierre); la tarjeta entrará en To do.`;
  if (!okState) c.estado = 'todo';
  c.historial = []; c.archivada = false;
  return { ok: true, value: c, aviso };
}
const cardTemplate = boardId => ({
  schema: CARD_SCHEMA, tablero: boardId,
  tarjeta: { id: '', titulo: 'Verbo + qué se hará', objetivo: 'Resultado esperado', descripcion: '', criterio: '', estado: 'todo', prioridad: '',
    proyecto: '', equipo: '', responsable: '', supervisor: '', solicitante: '', dependenciaExterna: '', colaboradores: '', referencias: [], proximaAccion: '',
    fechas: { original: '', reprogramada: '', revision: '', plazo: '', condicionadas: [] }, subtareas: [{ texto: 'Primera subtarea', hecha: false }],
    notas: '', enlaces: [], vinculadas: [], transversal: false, hito: false, estadoPorConfirmar: false,
    bloqueo: null }
});

/* Archivo de ACTUALIZACIÓN (p. ej. los compromisos de una reunión): amplía las tarjetas que ya existen sin tocar
   su estado, historial, bloqueo, cierre ni las subtareas ya marcadas, y crea las que falten. Volver a cargarlo no
   duplica nada: las subtareas se reconocen por id o por texto y las notas solo se agregan si no están ya.
   { schema: 'ccs-kanban-actualizacion-v1', tablero, titulo, fecha, cambios: [
       { id, alias?: [ids], buscar?: [[palabras del título]], tarjeta?: { datos base si hay que crearla },
         ampliar?: { alcance, notas, subtareas: [{ id, texto }], marcarHechas: [{ id, contiene }], referencias: [],
                     colaboradores, dependencia, responsableSiVacio, solicitanteSiVacio, revision, plazo,
                     vinculadas: [ids de otros cambios o tarjetas], enlaces: [] } } ] }
   La tarjeta se busca por id, después por alias y después por palabras del título (todas, sin tildes).
   Si coinciden varias, ese cambio no se aplica y se informa. Sin coincidencia y sin «tarjeta», tampoco. */
const UPDATE_SCHEMA = 'ccs-kanban-actualizacion-v1';
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function parseUpdateFile(obj, boardId) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const arr = (v, n) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, n) : []);
  if (!obj || typeof obj !== 'object' || obj.schema !== UPDATE_SCHEMA) return { ok: false, error: `El archivo no es una actualización de tablero (se esperaba «${UPDATE_SCHEMA}»).` };
  if (obj.tablero !== boardId) return { ok: false, error: `La actualización es para el tablero «${String(obj.tablero || 'sin identificar').slice(0, 40)}» y este es «${boardId}». Los tableros se mantienen separados.` };
  if (!Array.isArray(obj.cambios) || !obj.cambios.length) return { ok: false, error: 'La actualización no tiene cambios.' };
  if (obj.cambios.length > 200) return { ok: false, error: 'La actualización tiene demasiados cambios.' };
  const cambios = obj.cambios.map(ch => {
    const a = (ch && ch.ampliar) || {};
    return {
      id: str(ch && ch.id, 80), alias: arr(ch && ch.alias, 10),
      buscar: (Array.isArray(ch && ch.buscar) ? ch.buscar : []).map(g => arr(g, 6).map(fold)).filter(g => g.length).slice(0, 6),
      tarjeta: ch && ch.tarjeta && typeof ch.tarjeta === 'object' && !Array.isArray(ch.tarjeta) ? ch.tarjeta : null,
      ampliar: {
        alcance: str(a.alcance, 1500), notas: str(a.notas, 2000),
        subtareas: (Array.isArray(a.subtareas) ? a.subtareas : []).map(s => ({ id: str(s && s.id, 40), texto: str(s && s.texto, 300) })).filter(s => s.id && s.texto).slice(0, 40),
        marcarHechas: (Array.isArray(a.marcarHechas) ? a.marcarHechas : []).map(s => ({ id: str(s && s.id, 40), contiene: fold(str(s && s.contiene, 80)) })).filter(s => s.id && s.contiene).slice(0, 20),
        referencias: arr(a.referencias, 20), colaboradores: str(a.colaboradores, 300), dependencia: str(a.dependencia, 160),
        responsableSiVacio: str(a.responsableSiVacio, 120), solicitanteSiVacio: str(a.solicitanteSiVacio, 200),
        revision: date(a.revision), plazo: str(a.plazo, 160), vinculadas: arr(a.vinculadas, 30), enlaces: arr(a.enlaces, 20).filter(httpsUrl)
      }
    };
  });
  const bad = cambios.findIndex(c => !c.id || (c.tarjeta && !(typeof c.tarjeta.titulo === 'string' && c.tarjeta.titulo.trim())));
  if (bad >= 0) return { ok: false, error: `El cambio n.º ${bad + 1} no tiene «id» o su tarjeta no tiene «titulo».` };
  if (new Set(cambios.map(c => c.id)).size !== cambios.length) return { ok: false, error: 'Hay cambios con el mismo «id».' };
  return { ok: true, value: { titulo: str(obj.titulo, 200) || 'actualización', fecha: date(obj.fecha), cambios } };
}

/* Calcula, sin modificar el tablero, cómo quedaría cada tarjeta. Devuelve los elementos del plan:
   { ch, accion: 'crear' | 'ampliar' | 'igual' | 'ambigua' | 'sin-tarjeta', next (tarjeta resultante), cambios [textos], candidatos [] } */
export function planUpdate(cards, upd) {
  const byId = id => cards.find(c => c.id === id) || cards.find(c => c.alias.includes(id));
  const claimed = new Map();
  const items = upd.cambios.map(ch => {
    let t = byId(ch.id) || ch.alias.map(byId).find(Boolean) || null, amb = null;
    if (!t) for (const g of ch.buscar) {
      const m = cards.filter(c => g.every(w => fold(c.titulo).includes(w)));
      if (m.length === 1) { t = m[0]; break; }
      if (m.length > 1) { amb = m; break; }
    }
    if (t && claimed.has(t.id)) { amb = [t]; t = null; }   // dos cambios no pueden ampliar la misma tarjeta
    if (t) claimed.set(t.id, ch.id);
    return { ch, target: t, candidatos: amb || [] };
  });
  const idMap = new Map();
  items.forEach(it => { if (it.target) idMap.set(it.ch.id, it.target.id); else if (!it.candidatos.length && it.ch.tarjeta) idMap.set(it.ch.id, it.ch.id); });
  const resolveId = id => idMap.get(id) || (byId(id) ? byId(id).id : null);
  const touched = new Map();   // id → tarjeta resultante

  items.forEach(it => {
    if (it.candidatos.length) { it.accion = 'ambigua'; return; }
    if (!it.target && !it.ch.tarjeta) { it.accion = 'sin-tarjeta'; return; }
    const a = it.ch.ampliar, cambios = [];
    let c;
    if (it.target) { c = normCard(JSON.parse(JSON.stringify(it.target))); it.accion = 'ampliar'; }
    else {
      c = normCard({ ...it.ch.tarjeta, id: it.ch.id }); c.historial = []; c.archivada = false;
      if (!stateOk(c)) c.estado = 'todo';
      it.accion = 'crear';
    }
    const addNote = txt => { if (txt && !fold(c.notas).includes(fold(txt))) { c.notas = (c.notas ? c.notas + '\n\n' : '') + txt; return true; } return false; };
    if (a.alcance && !fold(c.descripcion).includes(fold(a.alcance))) { c.descripcion = (c.descripcion ? c.descripcion + '\n\n' : '') + a.alcance; cambios.push('alcance ampliado'); }
    let n = 0;
    a.subtareas.forEach(s => { if (!c.subtareas.some(x => x.id === s.id || fold(x.texto) === fold(s.texto))) { c.subtareas.push({ id: s.id, texto: s.texto, hecha: false }); n++; } });
    if (n) cambios.push(plural(n, 'subtarea nueva', 'subtareas nuevas'));
    let k = 0;
    a.marcarHechas.forEach(m => { const s = c.subtareas.find(x => x.id === m.id && fold(x.texto).includes(m.contiene)); if (s && !s.hecha) { s.hecha = true; k++; } });
    if (k) cambios.push(plural(k, 'subtarea marcada como hecha', 'subtareas marcadas como hechas'));
    const refs = a.referencias.filter(r => !c.referencias.includes(r));
    if (refs.length) { c.referencias.push(...refs); cambios.push(`referencias ${refs.join(', ')}`); }
    const colabs = a.colaboradores.split(',').map(x => x.trim()).filter(x => x && !fold(c.colaboradores).split(/\s*,\s*/).includes(fold(x)));
    if (colabs.length) { c.colaboradores = [c.colaboradores, ...colabs].filter(Boolean).join(', '); cambios.push(`colaboradores: ${colabs.join(', ')}`); }
    if (a.dependencia) {
      if (!c.dependenciaExterna) { c.dependenciaExterna = a.dependencia; cambios.push('dependencia registrada'); }
      else if (fold(c.dependenciaExterna) !== fold(a.dependencia) && addNote(`Dependencia adicional: ${a.dependencia}`)) cambios.push('dependencia adicional en notas');
    }
    if (a.responsableSiVacio && !c.responsable) { c.responsable = a.responsableSiVacio; cambios.push(`responsable: ${c.responsable}`); }
    if (a.solicitanteSiVacio && !c.solicitante) { c.solicitante = a.solicitanteSiVacio; cambios.push('solicitante registrado'); }
    if (a.revision && (!c.fechas.revision || c.fechas.revision < a.revision)) { c.fechas.revision = a.revision; cambios.push(`revisión ${fmtD(a.revision)}`); }
    if (a.plazo && !c.fechas.plazo) { c.fechas.plazo = a.plazo; cambios.push('plazo registrado'); }
    if (addNote(a.notas)) cambios.push('notas agregadas');
    const links = a.enlaces.filter(u => !c.enlaces.includes(u));
    if (links.length) { c.enlaces.push(...links); cambios.push(plural(links.length, 'enlace', 'enlaces')); }
    a.vinculadas.map(resolveId).filter(v => v && v !== c.id && !c.vinculadas.includes(v)).forEach(v => { c.vinculadas.push(v); if (!cambios.includes('vínculos')) cambios.push('vínculos'); });
    if (it.accion === 'ampliar' && !cambios.length) it.accion = 'igual';
    if (it.accion === 'ampliar' && c.estado === 'done') cambios.push('sigue en Done: lo nuevo no la reabre');
    it.next = c; it.cambios = cambios; touched.set(c.id, it);
  });

  // Los vínculos son recíprocos: la tarjeta enlazada también apunta de vuelta.
  [...touched.values()].forEach(it => it.next.vinculadas.forEach(v => {
    let other = touched.get(v);
    if (!other) {
      const base = byId(v); if (!base) return;
      other = { ch: null, accion: 'igual', next: normCard(JSON.parse(JSON.stringify(base))), cambios: [] };
      touched.set(v, other); items.push(other);
    }
    if (!other.next.vinculadas.includes(it.next.id)) {
      other.next.vinculadas.push(it.next.id);
      if (!other.cambios.includes('vínculos')) other.cambios.push('vínculos');
      if (other.accion === 'igual') other.accion = 'ampliar';
    }
  }));
  return items;
}

const storageFor = key => ({
  read() { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } },
  write(v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } }
});

/* Respaldo recuperable del estado anterior a una migración. Se guarda UNA vez por tablero (no se sobrescribe)
   con el mismo formato de un archivo exportado, para poder importarlo de nuevo. */
const backupKey = key => key + '-respaldo-reorganizacion';
function backupOnce(key, raw, boardId) {
  try {
    if (!raw || localStorage.getItem(backupKey(key))) return;
    localStorage.setItem(backupKey(key), JSON.stringify({ ...raw, schema: SCHEMA, id: boardId, respaldadoEn: nowIso(),
      respaldo: 'Estado del tablero antes de la reorganización en macroobjetivos (copia automática, sin cambios).' }));
  } catch { /* sin almacenamiento: la migración sigue, pero no hay copia */ }
}

/* Consolida duplicados entre tableros (CONSOLIDACIONES). Solo actúa si los dos tableros ya existen en este
   navegador y la tarjeta de origen aún no es un enlace. La tarjeta canónica recibe notas, enlaces, subtareas e
   historial de la otra (sin repetir lo que ya tiene); la de origen se conserva entera y queda como enlace.
   Idempotente: una segunda pasada no cambia nada. Devuelve true si escribió algo. */
function runConsolidations() {
  let changed = false;
  CONSOLIDACIONES.forEach(({ origen, destino }) => {
    const so = storageFor(origen.key), sd = storageFor(destino.key);
    const ro = so.read(), rd = sd.read();
    if (!ro || !rd || !Array.isArray(ro.tarjetas) || !Array.isArray(rd.tarjetas)) return;
    const io = ro.tarjetas.findIndex(c => c && c.id === origen.id), id = rd.tarjetas.findIndex(c => c && c.id === destino.id);
    if (io < 0 || id < 0) return;
    const o = normCard(ro.tarjetas[io]), d = normCard(rd.tarjetas[id]);
    if (o.enlace) return;
    backupOnce(origen.key, ro, origen.board); backupOnce(destino.key, rd, destino.board);
    const at = nowIso(), tag = `[${origen.nombre} · ${o.id}]`;
    if (!d.alias.includes(o.id)) d.alias.push(o.id);
    const ref = `${origen.nombre.slice(0, 5)} · ${o.id}`.slice(0, 30);
    if (!d.referencias.includes(ref)) d.referencias.push(ref);
    const head = `Consolidada con «${o.titulo}» del Kanban de ${origen.nombre} (${o.id})`;
    if (!fold(d.notas).includes(fold(head))) {
      const parts = [`${head} el ${fmtD(at.slice(0, 10))}: describía el mismo trabajo. Datos de esa tarjeta:`,
        `- Estado: ${colTitle(o.estado)}${o.estado !== d.estado ? ` (aquí se conserva ${colTitle(d.estado)})` : ''}.`,
        `- Responsable: ${o.responsable || 'por asignar'}${o.responsable && o.responsable !== d.responsable ? ` (aquí: ${d.responsable || 'por asignar'})` : ''}.`,
        o.objetivo ? `- Objetivo: ${o.objetivo}` : '', o.descripcion ? `- Descripción: ${o.descripcion}` : '',
        o.criterio ? `- Criterio: ${o.criterio}` : '', o.notas ? `- Notas: ${o.notas}` : ''].filter(Boolean);
      d.notas = (d.notas ? d.notas + '\n\n' : '') + parts.join('\n');
    }
    o.enlaces.forEach(u => { if (!d.enlaces.includes(u)) d.enlaces.push(u); });
    o.subtareas.forEach(s => { const x = d.subtareas.find(y => fold(y.texto) === fold(s.texto)); if (x) x.hecha = x.hecha || s.hecha; else d.subtareas.push({ ...s, id: 'c-' + s.id, fase: '' }); });
    const seen = new Set(d.historial.map(h => h.fecha + '|' + h.nota));
    o.historial.filter(h => h.tipo !== 'clasificacion').forEach(h => { const nh = { ...h, nota: `${tag} ${h.nota}` }; if (!seen.has(nh.fecha + '|' + nh.nota)) d.historial.push(nh); });
    d.historial.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    d.historial.push({ fecha: at, tipo: 'consolidacion', de: d.estado, a: d.estado, nota: `${head}. Su historial se incorporó aquí con el prefijo ${tag}; allí queda como enlace de solo lectura.` });
    o.enlace = { tablero: destino.board, id: destino.id, fecha: at };
    o.historial.push({ fecha: at, tipo: 'consolidacion', de: o.estado, a: o.estado, nota: `Consolidada en «${d.titulo}» (Kanban de ${destino.nombre}). Se consulta desde aquí y se edita allí.` });
    ro.tarjetas[io] = o; rd.tarjetas[id] = d;
    if (sd.write(rd) && so.write(ro)) changed = true;   // primero la canónica: si falla, el origen sigue intacto
  });
  return changed;
}

const targetDate = c => c.fechas.reprogramada || c.fechas.original;
const isOverdue = c => { const d = targetDate(c); return !!d && d < todayStr() && c.estado !== 'done'; };
const depOf = c => (c.estado === 'blocked' && c.bloqueo && c.bloqueo.quien) || c.dependenciaExterna || '';
const progress = c => ({ hechas: c.subtareas.filter(s => s.hecha).length, total: c.subtareas.length });

/* ═════════ Tablero ═════════
   cfg: { boardId, boardName, storeKey, dataUrl, fileSlug, cls, hero(actions) → HTML, proyectos[], proyectoNuevo,
          seedNote (texto del historial de la carga inicial), scopeLabel (texto del contador sin transversales) } */
export function mountKanban(root, cfg) {
  const BOARD_ID = cfg.boardId;
  const storage = storageFor(cfg.storeKey);
  const E = cfg.estructura || null;          // macroobjetivos de este tablero (kanban-estructura.js)
  const VIEW_KEY = cfg.storeKey + '-vista';  // preferencia de vista de este navegador (comodidad, no datos)
  const pref = { get() { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } }, set(v) { try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento */ } } };
  const B ={ cards: [], savedAt: null, ready: false, error: '', mobileCol: 'todo',
    view: E ? (pref.get() === 'all' ? 'all' : 'macro') : 'all', macro: null, openObj: new Set(), nodos: {},
    f: { q: '', resp: '', prio: '', proy: '', dep: '', vencidas: false, transversal: false, archivadas: false, ext: true },
    ext: { items: [], state: cfg.external ? 'loading' : 'off', error: '' } };
  let alive = true, dragId = null;

  const wrap = inner => `<div class="ik ${cfg.cls || ''}">${inner}</div>`;
  root.innerHTML = wrap(`${cfg.hero('')}<div class="skeleton" style="height:300px"></div>`);

  function readSaved() {
    const saved = storage.read();
    const check = saved ? validateBoard({ ...saved, schema: SCHEMA, id: BOARD_ID }, BOARD_ID) : null;
    if (!check || !check.ok) return null;
    B.cards = check.value; B.savedAt = saved.savedAt || null;
    const nv = saved.estructura && saved.estructura.nodosVistos;
    B.nodos = nv && typeof nv === 'object' && !Array.isArray(nv) ? nv : {};
    return saved;
  }

  async function load() {
    if (E) runConsolidations();
    const saved = readSaved();
    if (saved) { B.ready = true; migrate(saved); render(); deepLink(); return; }
    // Primera visita en este navegador: se cargan los datos iniciales una sola vez y se guardan.
    try {
      const res = await fetch(cfg.dataUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const seed = await res.json();
      const created = nowIso(), perCol = {};
      B.cards = seed.tarjetas.map(t => {
        const c = normCard(t);
        perCol[c.estado] = (perCol[c.estado] || 0) + 1;
        c.orden = perCol[c.estado]; c.creada = created;
        c.historial = [{ fecha: created, tipo: 'carga', de: '', a: c.estado,
          nota: `${cfg.seedNote}${c.estadoPorConfirmar ? ' · estado por confirmar' : ''}${c.estado === 'blocked' && c.bloqueo ? ` · bloqueo documentado: ${c.bloqueo.motivo}` : ''}` }];
        return c;
      });
      B.ready = true; persist();
      if (E && runConsolidations()) readSaved();
      migrate(null); render(); deepLink();
    } catch (e) { B.error = 'No se pudieron cargar los datos iniciales del tablero (' + e.message + ').'; render(); }
  }

  function persist() {
    B.savedAt = nowIso();
    if (!storage.write({ schema: SCHEMA, id: BOARD_ID, savedAt: B.savedAt, estructura: { version: ESTRUCTURA_VERSION, nodosVistos: B.nodos }, tarjetas: B.cards }))
      toast('No se pudo guardar en este navegador (almacenamiento no disponible).', 'err', 7000);
  }

  /* ── Migración a macroobjetivos ──
     Solo toca tarjetas no clasificadas: les asigna macroobjetivo/objetivo por regla (o «Por clasificar»), marca la
     fase de sus subtareas y deja constancia en el historial. No cambia estados, fechas ni responsables.
     Antes de la primera migración se guarda una copia del tablero tal como estaba. */
  function classify(list) {
    if (!E || !list.length) return 0;
    const at = nowIso();
    list.forEach(c => {
      const r = ruleFor(E, c), m = r && macroOf(r[0]);
      c.macro = m ? m.id : ''; c.objetivoEsp = m ? r[1] : '';
      applySubtaskRules(E, c);
      c.clasificada = true;
      c.historial.push({ fecha: at, tipo: 'clasificacion', de: c.estado, a: c.estado,
        nota: m ? `Reorganización: asociada a «${m.letra} · ${m.titulo}»${c.objetivoEsp ? ` › «${objTitle(m, c.objetivoEsp)}»` : ' como actividad principal'}. Estado sin cambios.`
          : 'Reorganización: queda «Por clasificar» (sin relación clara con un macroobjetivo). Estado sin cambios.' });
    });
    return list.length;
  }
  function migrate(rawSaved) {
    if (!E) return;
    const pending = B.cards.filter(c => !c.clasificada && !c.enlace && !isConsolOrigin(c));
    if (!pending.length) return;
    if (rawSaved) backupOnce(cfg.storeKey, rawSaved, BOARD_ID);
    classify(pending); persist();
  }

  /* Abre la tarjeta indicada en la ruta (…/kanban?tarjeta=id), también por un identificador anterior. */
  function deepLink() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const t = q.get('tarjeta'); if (!t) return;
    const c = byId(t) || B.cards.find(x => x.alias.includes(t));
    if (c) setTimeout(() => openCard(c), 0);
  }
  const byId = id => B.cards.find(c => c.id === id);
  const log = (c, tipo, nota, de = c.estado, a = c.estado) => c.historial.push({ fecha: nowIso(), tipo, de, a, nota });

  /* ── Estructura (macroobjetivo → objetivo específico → actividades) ── */
  const macroOf = id => (E && id ? E.macros.find(m => m.id === id) : null) || null;
  function objTitle(m, oid) {
    const o = m.objetivos.find(x => x.id === oid); if (o) return o.titulo;
    if (weekOfObj(oid)) return weekLabel(weekOfObj(oid));
    if (oid.startsWith('nodo:')) return `Nodo ${oid.slice(5)}`;
    return oid;
  }
  // Actividades que cuentan en la estructura: sin archivar y sin las consolidadas en otro tablero (se cuentan allí).
  const structCards = () => B.cards.filter(c => !c.archivada && !c.enlace);
  const isConsolOrigin = c => CONSOLIDACIONES.some(x => x.origen.board === BOARD_ID && x.origen.id === c.id);
  const unclassified = () => structCards().filter(c => !macroOf(c.macro) && !isConsolOrigin(c));

  /* Nodos de la hoja: cada nodo visto en curso tiene su objetivo. Si deja de aparecer en curso, se consulta su
     estado en la fuente: solo cuenta como terminado si la hoja lo da por desplegado o completado. */
  function nodeActs() {
    if (!cfg.external) return [];
    const live = B.ext.state === 'ok';
    const refs = new Set([...Object.keys(B.nodos), ...(live ? B.ext.items.map(x => x.ref) : [])]);
    return [...refs].sort((a, b) => a.localeCompare(b, 'es')).map(ref => {
      const x = live ? B.ext.items.find(i => i.ref === ref) : null;
      if (x) return { ref, kind: 'ext', x, estado: x.estado };
      if (!live) return { ref, kind: 'sin-fuente', estado: null };
      const s = cfg.external.lookup ? cfg.external.lookup(ref) : null;
      if (s && s.terminado) return { ref, kind: 'terminado', estado: 'done', texto: s.estado };
      return { ref, kind: s ? 'otro' : 'no-encontrado', estado: null, texto: s ? s.estado : '' };
    });
  }

  function objectivesOf(m, cards) {
    const list = m.objetivos.map(o => ({ id: o.id, titulo: o.titulo }));
    const extra = [...new Set(cards.map(c => c.objetivoEsp).filter(o => o && !list.some(x => x.id === o)))].sort();
    extra.forEach(id => list.push({ id, titulo: objTitle(m, id) }));
    if (m.nodos) nodeActs().forEach(n => list.push({ id: 'nodo:' + n.ref, titulo: `Nodo ${n.ref}`, nodo: n.ref }));
    return list;
  }

  function summarize(m) {
    const cards = structCards().filter(c => c.macro === m.id);
    const nodes = m.nodos ? nodeActs() : [];
    const agg = aggregate([...cards.map(c => ({ estado: c.estado, hito: c.hito })), ...nodes.map(n => ({ estado: n.estado }))]);
    const blocks = [...cards.filter(c => c.estado === 'blocked').map(c => ({ titulo: c.titulo, quien: (c.bloqueo && c.bloqueo.quien) || c.dependenciaExterna }))
      , ...nodes.filter(n => n.estado === 'blocked').map(n => ({ titulo: n.x.titulo, quien: n.x.bloqueo && n.x.bloqueo.quien }))];
    let next = null;
    for (const st of ['doing', 'todo', 'testing', 'blocked']) {
      const c = cards.filter(x => x.estado === st && x.proximaAccion).sort((a, b) => a.orden - b.orden)[0];
      if (c) { next = { c, texto: c.proximaAccion }; break; }
    }
    return { m, cards, nodes, agg, objs: objectivesOf(m, cards), blocks, next };
  }

  /* Tarjeta consolidada en otro tablero: datos vivos de la canónica (o null si ese tablero no está en este navegador). */
  function linkTarget(c) {
    const cons = CONSOLIDACIONES.find(x => x.destino.board === (c.enlace && c.enlace.tablero));
    if (!cons) return null;
    const raw = storageFor(cons.destino.key).read();
    const t = raw && Array.isArray(raw.tarjetas) ? raw.tarjetas.find(x => x && x.id === c.enlace.id) : null;
    return { cons, card: t ? normCard(t) : null };
  }
  const reindex = col => B.cards.filter(c => c.estado === col && !c.archivada).sort((a, b) => a.orden - b.orden).forEach((c, i) => { c.orden = i + 1; });

  /* ── Filtros ── */
  // En la vista de macroobjetivos las transversales ya están agrupadas (macroobjetivo propio), así que no se ocultan.
  const filtering = () => { const f = B.f; return !!(f.q.trim() || f.resp || f.prio || f.proy || f.dep || f.vencidas); };
  function visible(c, inMacros = false) {
    const f = B.f;
    if (c.archivada) return false;
    if (!inMacros && !f.transversal && c.transversal) return false;
    const q = f.q.trim().toLowerCase();
    const m = macroOf(c.macro);
    if (q && ![c.titulo, c.descripcion, c.objetivo, c.equipo, c.responsable, c.colaboradores, c.referencias.join(' '), c.alias.join(' '), c.subtareas.map(s => s.texto).join(' '),
      c.bloqueo ? c.bloqueo.motivo : '', m ? m.titulo : '', m && c.objetivoEsp ? objTitle(m, c.objetivoEsp) : ''].join(' ').toLowerCase().includes(q)) return false;
    if (f.resp && (f.resp === '__none' ? c.responsable : c.responsable !== f.resp)) return false;
    if (f.prio && (f.prio === '__none' ? c.prioridad : c.prioridad !== f.prio)) return false;
    if (f.proy && c.proyecto !== f.proy) return false;
    if (f.dep === '__con' && !depOf(c)) return false;
    if (f.dep === '__sin' && depOf(c)) return false;
    if (f.dep && !f.dep.startsWith('__') && depOf(c) !== f.dep) return false;
    if (f.vencidas && !isOverdue(c)) return false;
    return true;
  }

  /* ── Tarjetas sincronizadas (cfg.external) ──
     Vienen de otra fuente (p. ej. el estado de los nodos en Google Sheets): no se guardan en este tablero,
     no se editan ni se mueven aquí; su columna la decide la fuente. Formato de cada elemento:
     { id, ref, titulo, estado, proyecto, responsable, tags[], demora, bloqueo?: { quien, motivo }, detalle } */
  async function loadExternal(force = false) {
    if (!cfg.external) return;
    B.ext.state = 'loading'; if (B.ready) render();
    try {
      B.ext.items = (await cfg.external.load(force)).filter(x => x && COL_IDS.includes(x.estado)); B.ext.state = 'ok'; B.ext.error = '';
      // Se recuerda QUÉ nodos estuvieron en curso (solo su identificador y el día; su estado se lee siempre de la hoja),
      // para que un nodo que sale de la consulta no se dé por terminado sin comprobarlo en la fuente.
      const nuevos = B.ext.items.filter(x => x.ref && !B.nodos[x.ref]);
      if (E && B.ready && nuevos.length) { nuevos.forEach(x => { B.nodos[x.ref] = todayStr(); }); persist(); }
    }
    catch (e) { B.ext.state = 'error'; B.ext.error = e && e.message || 'error desconocido'; }
    if (alive && B.ready) render();
  }

  function visibleExt(x, inMacros = false) {
    const f = B.f;
    if ((!inMacros && !f.ext) || f.vencidas) return false;
    const q = f.q.trim().toLowerCase();
    if (q && ![x.titulo, x.ref, x.responsable, x.demora, ...(x.tags || [])].join(' ').toLowerCase().includes(q)) return false;
    if (f.resp && (f.resp === '__none' ? x.responsable : x.responsable !== f.resp)) return false;
    if (f.prio && f.prio !== '__none') return false;
    if (f.proy && x.proyecto !== f.proy) return false;
    if (f.dep === '__con' || (f.dep && !f.dep.startsWith('__'))) return false;
    return true;
  }

  function extCardHtml(x) {
    return `<li class="ik-card ik-sync" data-ext="${esc(x.id)}">
      <div class="ik-card-top">
        <span class="ik-proj">${esc(x.proyecto || '')}</span>
        <span class="ik-src" title="${esc(cfg.external.sourceTitle || '')}">${small(ICON.refresh)}${esc(cfg.external.badge || 'Sincronizada')}</span>
      </div>
      <button type="button" class="ik-title" data-act="ext-open" data-id="${esc(x.id)}">${esc(x.titulo)}</button>
      ${(x.tags || []).length ? `<div class="ik-tags">${x.tags.map(t => `<span class="ik-tag t-src">${esc(t)}</span>`).join('')}</div>` : ''}
      ${x.bloqueo ? `<div class="ik-block"><b>${small(ICON.lock)}Depende de: ${esc(x.bloqueo.quien || 'dependencia por identificar')}</b><span>${esc(x.bloqueo.motivo)}</span></div>`
        : x.demora ? `<div class="ik-block ik-delay"><b>${small(ICON.warn)}Motivo de demora</b><span>${esc(x.demora)}</span></div>` : ''}
      <dl class="ik-meta">
        <div><dt>Responsable</dt><dd>${esc(x.responsable || 'Por asignar')}</dd></div>
        ${x.detalle ? `<div><dt>${esc(x.detalle[0])}</dt><dd>${esc(x.detalle[1])}</dd></div>` : ''}
      </dl>
      <p class="ik-syncnote">${esc(cfg.external.note || 'El estado se cambia en la fuente.')}</p>
    </li>`;
  }

  /* ── Tarjeta compacta ── */
  /* opts.fixed: tarjeta dentro de un desglose o de «Por clasificar» (sin arrastre ni orden; el estado se cambia con su selector).
     opts.macroTag: muestra a qué macroobjetivo pertenece (vista «Todas las actividades»). opts.col: muestra la columna. */
  function macroTagHtml(c) {
    if (!E) return '';
    const m = macroOf(c.macro);
    return m ? `<span class="ik-tag t-macro" title="${esc(m.titulo)}${c.objetivoEsp ? ' › ' + esc(objTitle(m, c.objetivoEsp)) : ''}">${esc(m.letra)} · ${esc(m.titulo)}</span>`
      : isConsolOrigin(c) ? '' : '<span class="ik-tag t-unclass">Por clasificar</span>';
  }
  function cardHtml(c, i, n, opts = {}) {
    const pr = progress(c), d = targetDate(c), od = isOverdue(c);
    const eqs = c.subtareas.filter(s => s.equivale && byId(s.equivale)).length;
    return `<li class="ik-card prio-${c.prioridad || 'none'} ${c.hito ? 'is-hito' : ''} ${opts.fixed ? `ik-fixed c-${c.estado}` : ''}" ${opts.fixed ? '' : 'draggable="true"'} data-id="${esc(c.id)}">
      <div class="ik-card-top">
        <span class="ik-proj">${esc(c.proyecto || 'Sin proyecto')}${opts.col ? ` · <span class="ik-colname">${esc(colTitle(c.estado))}</span>` : ''}</span>
        <span class="ik-prio p-${c.prioridad || 'none'}">${c.prioridad ? esc(prioLabel(c.prioridad)) : 'Prioridad por confirmar'}</span>
      </div>
      <button type="button" class="ik-title" data-act="open" data-id="${esc(c.id)}">${esc(c.titulo)}</button>
      <div class="ik-tags">
        ${opts.macroTag ? macroTagHtml(c) : ''}
        ${c.estadoPorConfirmar ? '<span class="ik-tag t-confirm">Estado por confirmar</span>' : ''}
        ${od ? `<span class="ik-tag t-late">${small(ICON.warn)}Vencida · ${fmtD(d)}</span>` : ''}
        ${c.hito ? '<span class="ik-tag t-hito">Hito</span>' : ''}
        ${c.transversal ? '<span class="ik-tag t-trans">Transversal</span>' : ''}
        ${c.referencias.map(r => `<span class="ik-tag t-ref" title="Referencia de seguimiento">${esc(r)}</span>`).join('')}
      </div>
      ${c.estado === 'blocked' && c.bloqueo ? `<div class="ik-block"><b>${small(ICON.lock)}Depende de: ${esc(c.bloqueo.quien || 'dependencia por identificar')}</b><span>${esc(c.bloqueo.motivo)}</span></div>` : ''}
      <dl class="ik-meta">
        <div><dt>Responsable</dt><dd>${esc(c.responsable || 'Por asignar')}</dd></div>
        ${d && !od ? `<div><dt>Fecha objetivo</dt><dd>${fmtD(d)}</dd></div>` : ''}
        ${c.fechas.revision ? `<div><dt>Revisión</dt><dd>${fmtD(c.fechas.revision)}</dd></div>` : ''}
        ${c.fechas.plazo ? `<div><dt>Plazo</dt><dd>${esc(c.fechas.plazo)}</dd></div>` : ''}
        ${c.estado !== 'blocked' && c.dependenciaExterna ? `<div><dt>Depende de</dt><dd>${esc(c.dependenciaExterna)}</dd></div>` : ''}
        ${pr.total ? `<div class="ik-prog"><dt>Subtareas</dt><dd><span class="bar"><span style="width:${Math.round(pr.hechas / pr.total * 100)}%"></span></span>${pr.hechas}/${pr.total}</dd></div>` : ''}
      </dl>
      ${eqs ? `<p class="ik-eqnote">${eqs === 1 ? 'Una subtarea ya está registrada como hito' : `${eqs} subtareas ya están registradas como hitos`}: cuenta${eqs === 1 ? '' : 'n'} una sola vez.</p>` : ''}
      <div class="ik-card-foot">
        <label class="sr-only" for="st-${esc(c.id)}">Estado de «${esc(c.titulo)}»</label>
        <select id="st-${esc(c.id)}" class="select ik-state" data-act="state" data-id="${esc(c.id)}">${COLS.map(col => `<option value="${col.id}" ${col.id === c.estado ? 'selected' : ''}>${col.title}</option>`).join('')}</select>
        ${opts.fixed ? '' : `<button type="button" class="btn btn-ghost icon-btn ik-mv" data-act="up" data-id="${esc(c.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Subir «${esc(c.titulo)}»">▲</button>
        <button type="button" class="btn btn-ghost icon-btn ik-mv" data-act="down" data-id="${esc(c.id)}" ${i === n - 1 ? 'disabled' : ''} aria-label="Bajar «${esc(c.titulo)}»">▼</button>`}
      </div>
    </li>`;
  }

  /* Tarjeta consolidada en otro tablero: solo lectura, con el estado vivo de la canónica. */
  function linkCardHtml(c) {
    const lt = linkTarget(c), t = lt && lt.card, name = lt ? lt.cons.destino.nombre : 'otro tablero';
    return `<li class="ik-card ik-sync ik-link c-${(t || c).estado}" data-link="${esc(c.id)}">
      <div class="ik-card-top"><span class="ik-proj">Transversal · ${esc(name)}</span><span class="ik-src">${small(ICON.list)}Enlace</span></div>
      <button type="button" class="ik-title" data-act="link-open" data-id="${esc(c.id)}">${esc(t ? t.titulo : c.titulo)}</button>
      <dl class="ik-meta"><div><dt>Estado en ${esc(name)}</dt><dd>${esc(colTitle((t || c).estado))}</dd></div><div><dt>Responsable</dt><dd>${esc((t || c).responsable || 'Por asignar')}</dd></div></dl>
      <p class="ik-syncnote">${t ? `Actividad consolidada en el Kanban de ${esc(name)}: se edita allí. Esta tarjeta (${esc(c.id)}) se conserva como referencia.` : `La actividad canónica no está guardada en este navegador; abre el Kanban de ${esc(name)} para verla.`}</p>
    </li>`;
  }

  /* ── Vista de macroobjetivos ── */
  const LOCK = small(ICON.lock);
  function distHtml(agg) {
    const parts = [...COLS.filter(col => agg.dist[col.id]).map(col => ({ id: col.id, t: col.title, n: agg.dist[col.id] })),
      ...(agg.dist.confirmar ? [{ id: 'confirm', t: 'Por confirmar', n: agg.dist.confirmar }] : [])];
    if (!parts.length) return '<p class="ik-none">Sin actividades registradas.</p>';
    return `<div class="ik-dist"><div class="ik-dist-bar" role="img" aria-label="Actividades por estado: ${esc(parts.map(p => `${p.t} ${p.n}`).join(', '))}">${parts.map(p => `<span class="ik-seg c-${p.id}" style="flex:${p.n}"></span>`).join('')}</div>
      <ul class="ik-dist-legend">${parts.map(p => `<li class="c-${p.id}">${esc(p.t)} <b>${p.n}</b></li>`).join('')}</ul></div>`;
  }
  function macroCardHtml(s, matches) {
    const { m, agg } = s, pct = agg.total ? Math.round(agg.hechas / agg.total * 100) : 0;
    return `<li class="ik-card ik-macro" data-macro="${esc(m.id)}">
      <div class="ik-card-top"><span class="ik-proj"><span class="ik-letter" aria-hidden="true">${esc(m.letra)}</span>Macroobjetivo</span>
        ${m.transversal ? '<span class="ik-tag t-trans">Transversal</span>' : ''}</div>
      <button type="button" class="ik-title" data-act="macro" data-macro="${esc(m.id)}">${esc(m.titulo)}</button>
      <p class="ik-obj">${esc(m.resultado)}</p>
      <div class="ik-tags">${agg.parcial ? `<span class="ik-tag t-partial">${LOCK}Bloqueo parcial</span>` : ''}${agg.dist.confirmar ? `<span class="ik-tag t-confirm">${agg.dist.confirmar} por confirmar en la fuente</span>` : ''}</div>
      <dl class="ik-meta">
        <div><dt>Objetivos</dt><dd>${s.objs.length}</dd></div><div><dt>Actividades</dt><dd>${agg.total}</dd></div>
        <div class="ik-prog"><dt>Completadas</dt><dd><span class="bar"><span style="width:${pct}%"></span></span>${agg.hechas}/${agg.total}</dd></div>
      </dl>
      ${distHtml(agg)}
      ${s.blocks.length ? `<div class="ik-block"><b>${LOCK}${plural(s.blocks.length, 'bloqueo activo', 'bloqueos activos')}</b>${s.blocks.slice(0, 3).map(b => `<span>${esc(b.titulo)}${b.quien ? ` · depende de ${esc(b.quien)}` : ''}</span>`).join('')}${s.blocks.length > 3 ? `<span>y ${s.blocks.length - 3} más</span>` : ''}</div>` : ''}
      ${s.next ? `<div class="ik-next"><b>Próxima acción</b><span>${esc(s.next.texto)} <span class="dim">· ${esc(s.next.c.titulo)}</span></span></div>` : ''}
      ${matches ? `<div class="ik-matches"><b>${plural(matches.length, 'coincidencia', 'coincidencias')}</b><ul>${matches.map(x => `<li><button type="button" class="ik-mlink" data-act="${x.ext ? 'ext-open' : 'open'}" data-id="${esc(x.id)}">${esc(x.titulo)}</button> <span class="dim">· ${esc(colTitle(x.estado))}</span></li>`).join('')}</ul></div>` : ''}
      <div class="ik-card-foot"><button type="button" class="btn btn-sm ik-open" data-act="macro" data-macro="${esc(m.id)}">Ver desglose <span aria-hidden="true">→</span></button></div>
    </li>`;
  }

  function macroBoardHtml(sums) {
    const filt = filtering();
    const items = sums.map(s => {
      if (!filt) return { s, matches: null };
      const matches = [...s.cards.filter(c => visible(c, true)).map(c => ({ id: c.id, titulo: c.titulo, estado: c.estado })),
        ...s.nodes.filter(n => n.kind === 'ext' && visibleExt(n.x, true)).map(n => ({ id: n.x.id, titulo: n.x.titulo, estado: n.x.estado, ext: true }))];
      return matches.length ? { s, matches } : null;
    }).filter(Boolean);
    const nCol = id => items.filter(it => it.s.agg.estado === id).length;
    return `<div class="ik-colpick" role="group" aria-label="Elegir columna">${COLS.map(col => `<button type="button" class="ik-pick c-${col.id}" data-act="pick" data-col="${col.id}" aria-pressed="${B.mobileCol === col.id}">${col.title} <span class="n">${nCol(col.id)}</span></button>`).join('')}</div>
      <div class="ik-board ik-macroboard" data-mobile="${B.mobileCol}">${COLS.map(col => {
        const list = items.filter(it => it.s.agg.estado === col.id);
        return `<section class="ik-col c-${col.id}" data-col="${col.id}" aria-labelledby="ik-h-${col.id}">
          <header class="ik-col-head"><div><h2 id="ik-h-${col.id}">${col.title}</h2><p>${MACRO_HELP[col.id]}</p></div><span class="n" aria-label="${list.length} macroobjetivos">${list.length}</span></header>
          <ul class="ik-list">${list.map(it => macroCardHtml(it.s, it.matches)).join('')}${list.length ? '' : `<li class="ik-empty">${filt ? 'Sin coincidencias.' : 'Ningún macroobjetivo.'}</li>`}</ul>
        </section>`;
      }).join('')}</div>`;
  }
  const MACRO_HELP = {
    todo: 'Ninguna actividad empezada.', doing: 'Avance parcial o en ejecución.', testing: 'Ejecución terminada; quedan verificaciones.',
    blocked: 'Lo pendiente depende de resolver bloqueos.', done: 'Todas las actividades completadas.'
  };

  /* Secciones bajo el tablero: «Por clasificar» y las actividades transversales consolidadas en otro tablero. */
  function pendingHtml() {
    const filt = filtering();
    const list = unclassified().filter(c => !filt || visible(c, true));
    const links = B.cards.filter(c => !c.archivada && (c.enlace || isConsolOrigin(c)));
    return `${list.length || (!filt && unclassified().length) ? `<section class="panel ik-pending" aria-labelledby="ik-pend-t">
        <h2 id="ik-pend-t">Por clasificar <span class="n">${list.length}</span></h2>
        <p class="ik-sechelp">Tarjetas sin una relación clara con un macroobjetivo. Se conservan con su estado; ábrelas y elige su grupo en «Macroobjetivo y objetivo específico».</p>
        <ul class="ik-list ik-grid">${list.map(c => cardHtml(c, 0, 1, { fixed: true, col: true })).join('')}</ul></section>` : ''}
      ${links.length && !filt ? `<section class="panel ik-pending ik-linksec" aria-labelledby="ik-link-t">
        <h2 id="ik-link-t">Transversales con otro tablero</h2>
        <ul class="ik-list ik-grid">${links.map(c => c.enlace ? linkCardHtml(c) : cardHtml(c, 0, 1, { fixed: true, col: true })).join('')}</ul>
        ${links.some(c => !c.enlace) ? '<p class="ik-sechelp">Esta actividad se consolidará con su equivalente de Neotropya cuando abras ese Kanban en este navegador.</p>' : ''}</section>` : ''}`;
  }

  /* ── Desglose de un macroobjetivo ── */
  function nodeActHtml(n) {
    if (n.kind === 'ext') return extCardHtml(n.x);
    const msg = n.kind === 'terminado' ? `Ya no está en curso. La hoja de Nodos lo registra como «${n.texto}»; por eso cuenta como completado.`
      : n.kind === 'otro' ? `Ya no está en curso. La hoja lo registra como «${n.texto}»; no se cuenta como terminado.`
        : n.kind === 'no-encontrado' ? 'Ya no aparece en la hoja de Nodos. Comprueba su estado en la fuente: no se cuenta como terminado.'
          : 'No se pudo leer la hoja de Nodos: estado no disponible (no se cuenta como terminado).';
    return `<li class="ik-card ik-sync ik-fixed c-${n.estado || 'confirm'}"><div class="ik-card-top"><span class="ik-proj">Nodos</span><span class="ik-src">${small(ICON.refresh)}${n.estado === 'done' ? 'Completado según la fuente' : 'Por confirmar'}</span></div>
      <p class="ik-ttl-s">Nodo ${esc(n.ref)}</p><p class="ik-syncnote">${esc(msg)}</p></li>`;
  }
  function subPhaseHtml(items) {
    return `<ul class="ik-phase">${items.map(({ c, s }) => `<li class="${s.hecha ? 'ok' : ''}"><span class="mk" aria-hidden="true">${s.hecha ? '✓' : '○'}</span>
      <span>${esc(s.texto)}<span class="sr-only">${s.hecha ? ' (hecha)' : ' (pendiente)'}</span>${s.equivale && byId(s.equivale) ? ` <span class="dim">· registrada también como hito «${esc(byId(s.equivale).titulo)}»</span>` : ''}
      <button type="button" class="ik-mlink dim" data-act="open" data-id="${esc(c.id)}">${esc(c.titulo)}</button></span></li>`).join('')}</ul>`;
  }
  function macroDetailHtml(m) {
    const s = summarize(m), filt = filtering();
    const objIds = new Set(s.objs.map(o => o.id));
    const mains = s.cards.filter(c => !c.objetivoEsp || !objIds.has(c.objetivoEsp));
    const fixed = c => cardHtml(c, 0, 1, { fixed: true, col: true });
    const hit = c => filt && visible(c, true);
    const related = [...new Set(s.cards.flatMap(c => c.vinculadas))].map(byId).filter(x => x && !x.archivada && x.macro !== m.id);
    const week = mondayOf(todayStr()), weekCard = byId(weekObjId(week));
    const unphased = mains.flatMap(c => c.subtareas.filter(x => !x.fase || !objIds.has(x.fase)).map(x => ({ c, s: x })));
    const groups = s.objs.map((o, k) => {
      const acts = s.cards.filter(c => c.objetivoEsp === o.id).sort((a, b) => COL_IDS.indexOf(a.estado) - COL_IDS.indexOf(b.estado) || a.orden - b.orden);
      const node = o.nodo ? s.nodes.find(n => n.ref === o.nodo) : null;
      const subs = mains.flatMap(c => c.subtareas.filter(x => x.fase === o.id).map(x => ({ c, s: x })));
      const agg = aggregate([...acts.map(c => ({ estado: c.estado })), ...(node ? [{ estado: node.estado }] : [])]);
      const matched = acts.some(hit) || (node && node.kind === 'ext' && filt && visibleExt(node.x, true)) || (filt && subs.some(x => fold(x.s.texto).includes(fold(B.f.q))));
      const open = B.openObj.has(m.id + '/' + o.id) || matched;
      const subDone = subs.filter(x => x.s.hecha).length;
      return `<details class="ik-objgrp c-${agg.total ? agg.estado : 'empty'}" data-obj="${esc(m.id + '/' + o.id)}" ${open ? 'open' : ''}>
        <summary><span class="ik-objn">${k + 1}</span><span class="ik-objt">${esc(o.titulo)}</span>
          <span class="ik-objmeta">${[agg.total ? `<span class="ik-chip c-${agg.estado}">${esc(colTitle(agg.estado))}</span> ${agg.hechas}/${agg.total} ${agg.total === 1 ? 'actividad completada' : 'actividades completadas'}` : subs.length ? '' : 'Sin actividades',
            subs.length ? `subtareas de la actividad principal: ${subDone}/${subs.length}` : '',
            agg.parcial ? `<span class="ik-warn">${LOCK}bloqueo parcial</span>` : agg.estado === 'blocked' && agg.total ? `<span class="ik-warn">${LOCK}bloqueado</span>` : '',
            matched ? '<b>coincide con la búsqueda</b>' : ''].filter(Boolean).join(' · ')}</span></summary>
        <div class="ik-objbody">
          ${acts.length || node ? `<ul class="ik-list ik-grid">${acts.map(fixed).join('')}${node ? nodeActHtml(node) : ''}</ul>` : ''}
          ${subs.length ? `<p class="ik-phase-h">Fase de la actividad principal</p>${subPhaseHtml(subs)}` : ''}
          ${!acts.length && !node && !subs.length ? '<p class="ik-none">Sin actividades registradas en este objetivo.</p>' : ''}
        </div></details>`;
    }).join('');
    return `<section class="panel ik-detail" aria-labelledby="ik-mt">
        <button type="button" class="btn btn-sm btn-ghost ik-back" data-act="macro-back"><span aria-hidden="true">←</span> Macroobjetivos</button>
        <div class="ik-detail-head">
          <span class="ik-letter big" aria-hidden="true">${esc(m.letra)}</span>
          <div><p class="kicker">Macroobjetivo${m.transversal ? ' · transversal' : ''}</p><h2 id="ik-mt">${esc(m.titulo)}</h2><p class="ik-obj">${esc(m.resultado)}</p></div>
        </div>
        <div class="ik-detail-stats">
          <p><span class="ik-chip c-${s.agg.estado}">${esc(colTitle(s.agg.estado))}</span>${s.agg.parcial ? ` <span class="ik-tag t-partial">${LOCK}Bloqueo parcial</span>` : ''}
            <span class="dim">Resumen calculado a partir de las actividades. No cambia sus estados.</span></p>
          <p>${plural(s.objs.length, 'objetivo', 'objetivos')} · ${plural(s.agg.total, 'actividad', 'actividades')} · <b>${s.agg.hechas}/${s.agg.total}</b> completadas</p>
          ${distHtml(s.agg)}
          ${s.blocks.length ? `<div class="ik-block"><b>${LOCK}${plural(s.blocks.length, 'bloqueo activo', 'bloqueos activos')}</b>${s.blocks.map(b => `<span>${esc(b.titulo)}${b.quien ? ` · depende de ${esc(b.quien)}` : ''}</span>`).join('')}</div>` : ''}
          ${s.next ? `<div class="ik-next"><b>Próxima acción</b><span>${esc(s.next.texto)} <span class="dim">· ${esc(s.next.c.titulo)}</span></span></div>` : ''}
          ${m.nodos && cfg.external ? `<p class="ik-sechelp">Los nodos se leen de ${esc(cfg.external.sourceName)}: no se editan ni se mueven aquí.</p>` : ''}
          ${m.semanal ? `<div class="ik-weekbar"><p class="ik-sechelp">Una actividad por semana con dos comprobaciones: horas de formación cubiertas y avances de la semana reportados. No se crean tarjetas diarias.</p>
            ${weekCard ? `<button type="button" class="btn btn-sm" data-act="open" data-id="${esc(weekCard.id)}">Abrir la actividad de esta semana</button>` : `<button type="button" class="btn btn-sm btn-primary" data-act="week-new">${ICON.plus}Crear la actividad de esta semana</button>`}</div>` : ''}
        </div>
      </section>
      ${mains.length ? `<section class="ik-objsec" aria-label="Actividad principal"><h3 class="ik-sech">Actividad principal</h3>
        <ul class="ik-list ik-grid">${mains.map(fixed).join('')}</ul>
        ${mains.some(c => c.subtareas.some(x => x.fase)) ? '<p class="ik-sechelp">Sus subtareas aparecen en el objetivo específico (fase) al que corresponden.</p>' : ''}
        ${unphased.length ? `<p class="ik-phase-h">Subtareas sin fase asignada</p>${subPhaseHtml(unphased)}` : ''}</section>` : ''}
      <section class="ik-objsec" aria-label="Objetivos específicos"><h3 class="ik-sech">Objetivos específicos</h3>
        <div class="ik-objtools"><button type="button" class="btn btn-sm btn-ghost" data-act="obj-all" data-open="1">Desplegar todo</button><button type="button" class="btn btn-sm btn-ghost" data-act="obj-all" data-open="0">Plegar todo</button></div>
        ${groups || '<p class="ik-none">Sin objetivos específicos todavía.</p>'}</section>
      ${related.length ? `<section class="ik-objsec" aria-label="Relacionadas"><h3 class="ik-sech">Relacionadas en otros macroobjetivos</h3>
        <ul class="ik-rel">${related.map(x => { const rm = macroOf(x.macro); return `<li><button type="button" class="ik-mlink" data-act="open" data-id="${esc(x.id)}">${esc(x.titulo)}</button> <span class="dim">· ${esc(colTitle(x.estado))} · ${rm ? esc(rm.letra + ' · ' + rm.titulo) : 'Por clasificar'}</span></li>`; }).join('')}</ul>
        <p class="ik-sechelp">Solo se enlazan: cada actividad se registra y se cuenta en su propio macroobjetivo.</p></section>` : ''}`;
  }

  /* ── Tablero ── */
  function render() {
    if (!alive) return;
    const hero = cfg.hero(`<button class="btn btn-primary" data-act="new">${ICON.plus}<span>Nueva tarjeta</span></button>`);
    if (B.error) { root.innerHTML = wrap(`${hero}${alertBox('err', 'No se pudo abrir el tablero', `<p>${esc(B.error)}</p>`, '<button class="btn btn-sm" onclick="location.reload()">Reintentar</button>')}`); return; }
    const f = B.f, active = B.cards.filter(c => !c.archivada && !c.enlace);
    const uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'));
    const opt = (arr, v, all, extra = '') => `<option value="">${all}</option>${extra}` + arr.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const sel = (v, val) => (v === val ? 'selected' : '');
    const vis = active.filter(c => visible(c));
    const ext = B.ext.state === 'ok' ? B.ext.items : [];
    const visExt = ext.filter(x => visibleExt(x));
    const links = f.transversal ? B.cards.filter(c => c.enlace && !c.archivada) : [];
    const respAll = [...active.map(c => c.responsable), ...ext.map(x => x.responsable)];
    const proyAll = [...active.map(c => c.proyecto), ...ext.map(x => x.proyecto)];
    const nCol = id => vis.filter(c => c.estado === id).length + visExt.filter(x => x.estado === id).length;
    const archived = B.cards.filter(c => c.archivada);
    const mode = E ? B.view : 'all';
    const detail = mode === 'macro' && macroOf(B.macro);
    let hasBackup = false; try { hasBackup = !!localStorage.getItem(backupKey(cfg.storeKey)); } catch { /* sin almacenamiento */ }

    let countTxt;
    if (mode === 'all') countTxt = `Mostrando ${vis.length} de ${active.filter(c => f.transversal || !c.transversal).length} tarjetas${f.transversal || !cfg.scopeLabel ? '' : ` ${esc(cfg.scopeLabel)}`}${cfg.external && f.ext && ext.length ? ` · ${visExt.length} sincronizada${visExt.length === 1 ? '' : 's'} desde ${esc(cfg.external.sourceName)}` : ''}`;
    else {
      const sc = structCards(), nPend = unclassified().length, nNodes = E.macros.some(m => m.nodos) ? nodeActs().length : 0;
      countTxt = `${plural(E.macros.length, 'macroobjetivo', 'macroobjetivos')} · ${plural(sc.length - nPend - sc.filter(isConsolOrigin).length + nNodes, 'actividad agrupada', 'actividades agrupadas')}${nPend ? ` · ${nPend} por clasificar` : ''}${filtering() ? ` · ${sc.filter(c => visible(c, true)).length} coinciden con la búsqueda o los filtros` : ''}`;
    }

    const allBoard = `<div class="ik-colpick" role="group" aria-label="Elegir columna">${COLS.map(col => `<button type="button" class="ik-pick c-${col.id}" data-act="pick" data-col="${col.id}" aria-pressed="${B.mobileCol === col.id}">${col.title} <span class="n">${nCol(col.id)}</span></button>`).join('')}</div>

      <div class="ik-board" data-mobile="${B.mobileCol}">${COLS.map(col => {
        const cards = vis.filter(c => c.estado === col.id).sort((a, b) => a.orden - b.orden);
        const extCol = visExt.filter(x => x.estado === col.id);
        const linkCol = links.filter(c => { const lt = linkTarget(c); return ((lt && lt.card) || c).estado === col.id; });
        const total = active.filter(c => c.estado === col.id && (f.transversal || !c.transversal)).length + (f.ext ? ext.filter(x => x.estado === col.id).length : 0);
        return `<section class="ik-col c-${col.id}" data-col="${col.id}" aria-labelledby="ik-h-${col.id}">
          <header class="ik-col-head"><div><h2 id="ik-h-${col.id}">${col.title}</h2><p>${col.help}</p></div>
            <span class="n" aria-label="${cards.length + extCol.length} tarjetas">${cards.length + extCol.length === total ? total : `${cards.length + extCol.length}/${total}`}</span></header>
          <ul class="ik-list" data-col="${col.id}">${cards.map((c, i) => cardHtml(c, i, cards.length, { macroTag: true })).join('')}${extCol.map(extCardHtml).join('')}${linkCol.map(linkCardHtml).join('')}${cards.length + extCol.length + linkCol.length ? '' : '<li class="ik-empty">Sin tarjetas.</li>'}</ul>
        </section>`;
      }).join('')}</div>`;

    root.innerHTML = `<div class="ik ${cfg.cls || ''}">${hero}
      <section class="panel toolbar ik-tools" aria-label="Búsqueda y filtros">
        <div class="search">${ICON.search}<label class="sr-only" for="ik-q">Buscar actividades por título, descripción, equipo o responsable</label>
          <input id="ik-q" type="search" placeholder="Buscar actividades (también dentro de los macroobjetivos)…" value="${esc(f.q)}"></div>
        <label class="sr-only" for="ik-resp">Responsable</label>
        <select id="ik-resp" class="select" data-f="resp">${opt(uniq(respAll), f.resp, 'Responsable: todos', `<option value="__none" ${sel(f.resp, '__none')}>Por asignar</option>`)}</select>
        <label class="sr-only" for="ik-prio">Prioridad</label>
        <select id="ik-prio" class="select" data-f="prio"><option value="">Prioridad: todas</option>${PRIOS.map(p => `<option value="${p.id}" ${sel(f.prio, p.id)}>${p.label}</option>`).join('')}<option value="__none" ${sel(f.prio, '__none')}>Por confirmar</option></select>
        <label class="sr-only" for="ik-proy">Proyecto</label>
        <select id="ik-proy" class="select" data-f="proy">${opt(uniq(proyAll), f.proy, 'Proyecto: todos')}</select>
        <label class="sr-only" for="ik-dep">Dependencia</label>
        <select id="ik-dep" class="select" data-f="dep"><option value="">Dependencia: todas</option><option value="__con" ${sel(f.dep, '__con')}>Con dependencia</option><option value="__sin" ${sel(f.dep, '__sin')}>Sin dependencia</option>${uniq(active.map(depOf)).map(x => `<option value="${esc(x)}" ${sel(f.dep, x)}>${esc(x)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" data-f="vencidas" ${f.vencidas ? 'checked' : ''}> Solo vencidas</label>
        ${mode === 'all' ? `<label class="check"><input type="checkbox" data-f="transversal" ${f.transversal ? 'checked' : ''}> Mostrar actividades transversales</label>
        ${cfg.external ? `<label class="check"><input type="checkbox" data-f="ext" ${f.ext ? 'checked' : ''}> ${esc(cfg.external.toggle)}</label>` : ''}` : ''}
      </section>
      ${E ? `<div class="ik-views" role="group" aria-label="Vista del tablero">
        <button type="button" class="ik-view" data-act="view" data-view="macro" aria-pressed="${mode === 'macro'}">Macroobjetivos</button>
        <button type="button" class="ik-view" data-act="view" data-view="all" aria-pressed="${mode === 'all'}">Todas las actividades</button></div>` : ''}
      <div class="ik-bar">
        <p class="count" aria-live="polite">${countTxt}</p>
        <div class="ik-data">
          <button type="button" class="btn btn-sm" data-act="export">${ICON.download}Exportar JSON</button>
          <button type="button" class="btn btn-sm" data-act="import">${ICON.upload}Importar JSON</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="archived" aria-pressed="${f.archivadas}">Archivadas (${archived.length})</button>
          ${hasBackup ? `<button type="button" class="btn btn-sm btn-ghost" data-act="backup" title="Copia automática del tablero tal como estaba antes de agruparlo en macroobjetivos">${ICON.download}Respaldo previo</button>` : ''}
          <input type="file" accept="application/json,.json" data-import hidden>
        </div>
      </div>
      <p class="ik-storage">Los cambios se guardan solo en este navegador y no se comparten entre equipos. Usa «Exportar JSON» para respaldarlos o llevarlos a otro equipo.${B.savedAt ? ` Último guardado: ${esc(fmtDate(B.savedAt))}.` : ''}</p>
      ${cfg.external ? extStatus() : ''}

      ${mode === 'all' ? allBoard : detail ? macroDetailHtml(detail) : macroBoardHtml(E.macros.map(summarize)) + pendingHtml()}

      ${f.archivadas ? `<section class="panel ik-archived" aria-labelledby="ik-arch-t"><h2 id="ik-arch-t">Tarjetas archivadas</h2>
        ${archived.length ? `<ul>${archived.map(c => `<li><span><b>${esc(c.titulo)}</b> <span class="dim">· ${esc(colTitle(c.estado))}</span></span>
          <span><button type="button" class="btn btn-sm btn-ghost" data-act="open" data-id="${esc(c.id)}">Ver</button>
          <button type="button" class="btn btn-sm" data-act="restore" data-id="${esc(c.id)}">Recuperar</button></span></li>`).join('')}</ul>` : '<p class="none">No hay tarjetas archivadas.</p>'}
      </section>` : ''}
    </div>`;

    root.querySelector('#ik-q').addEventListener('input', e => { B.f.q = e.target.value; const p = e.target.selectionStart; render(); const n = root.querySelector('#ik-q'); n.focus(); n.setSelectionRange(p, p); });
    root.querySelectorAll('[data-f]').forEach(el => el.addEventListener('change', e => {
      const k = e.target.dataset.f; B.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      render(); const n = root.querySelector(`[data-f="${k}"]`); n && n.focus();
    }));
    root.querySelector('[data-import]').addEventListener('change', onImport);
    // Los desplegables recuerdan si están abiertos mientras se navega por el tablero.
    root.querySelectorAll('details.ik-objgrp').forEach(d => d.addEventListener('toggle', () => { if (d.open) B.openObj.add(d.dataset.obj); else B.openObj.delete(d.dataset.obj); }));
    if (mode === 'all') bindDrag();
  }

  /* ── Arrastrar y soltar (escritorio) ── */
  function bindDrag() {
    root.querySelectorAll('.ik-card:not(.ik-sync)').forEach(el => {
      el.addEventListener('dragstart', e => { dragId = el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
      el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); root.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target')); });
    });
    root.querySelectorAll('.ik-list').forEach(list => {
      list.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); list.closest('.ik-col').classList.add('drop-target'); });
      list.addEventListener('dragleave', e => { if (!list.contains(e.relatedTarget)) list.closest('.ik-col').classList.remove('drop-target'); });
      list.addEventListener('drop', e => {
        e.preventDefault();
        const id = dragId || e.dataTransfer.getData('text/plain'); if (!id) return;
        const items = [...list.querySelectorAll('.ik-card:not(.ik-sync)')].filter(x => x.dataset.id !== id);
        let index = items.length;
        for (let k = 0; k < items.length; k++) { const r = items[k].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { index = k; break; } }
        const before = items[index] ? items[index].dataset.id : null;
        moveCard(id, list.dataset.col, before);
      });
    });
  }

  /* Coloca la tarjeta delante de «beforeId» (o al final) dentro de la columna «to». */
  function place(c, to, beforeId) {
    const others = B.cards.filter(x => x.estado === to && !x.archivada && x.id !== c.id).sort((a, b) => a.orden - b.orden);
    const idx = beforeId ? others.findIndex(x => x.id === beforeId) : -1;
    others.splice(idx >= 0 ? idx : others.length, 0, c);
    others.forEach((x, i) => { x.orden = i + 1; });
  }

  /* ── Cambio de estado con sus reglas ── */
  async function moveCard(id, to, beforeId = null) {
    const c = byId(id); if (!c || !COL_IDS.includes(to)) return render();
    if (c.enlace) { toast('Esta actividad está consolidada en otro tablero: su estado se cambia allí.', 'err', 7000); return render(); }
    const from = c.estado;
    if (from === to) { place(c, to, beforeId); persist(); render(); return; }
    const extra = await transitionForm(c, from, to);
    if (!extra) { render(); return; } // cancelado: no cambia nada
    if (from === 'blocked' && c.bloqueo) log(c, 'desbloqueo', `Desbloqueada. Motivo anterior: ${c.bloqueo.motivo}${c.bloqueo.quien ? ` (dependía de ${c.bloqueo.quien})` : ''}. Acción indicada: ${c.bloqueo.accion}`, from, to);
    if (from === 'done') log(c, 'reapertura', `Reabierta${extra.motivo ? `: ${extra.motivo}` : ''}.${c.cierre ? ` Cierre anterior: ${c.cierre.nota}` : ''}`, from, to);
    if (to === 'blocked') { c.bloqueo = { quien: extra.quien, motivo: extra.motivo, accion: extra.accion }; c.proximaAccion = extra.accion; log(c, 'bloqueo', `Bloqueada: ${extra.motivo}${extra.quien ? ` · depende de ${extra.quien}` : ''} · para desbloquear: ${extra.accion}`, from, to); }
    else if (from === 'blocked') c.bloqueo = null;
    if (to === 'testing') { c.testing = { comprobar: extra.comprobar, esperado: extra.esperado }; log(c, 'prueba', `En prueba. Comprobar: ${extra.comprobar} · Resultado esperado: ${extra.esperado}`, from, to); }
    if (to === 'done') { c.cierre = { nota: extra.nota, fecha: todayStr() }; log(c, 'cierre', `Completada. Cierre / evidencia: ${extra.nota}`, from, to); }
    if (!['blocked', 'testing', 'done'].includes(to) && from !== 'blocked' && from !== 'done') log(c, 'estado', `Movida de ${colTitle(from)} a ${colTitle(to)}.`, from, to);
    if (c.estadoPorConfirmar) { c.estadoPorConfirmar = false; log(c, 'confirmacion', `Estado confirmado al moverla a ${colTitle(to)}.`, to, to); }
    c.estado = to;
    place(c, to, beforeId); reindex(from);
    persist(); render();
    toast(`«${c.titulo}» → ${colTitle(to)}.`);
    const nb = root.querySelector(`#st-${CSS.escape(c.id)}`); nb && nb.focus();
  }

  /* Formularios obligatorios al bloquear, probar, cerrar o reabrir. Devuelve los datos o null si se cancela. */
  function transitionForm(c, from, to) {
    const needs = to === 'blocked' || to === 'testing' || to === 'done' || from === 'done';
    if (!needs) return Promise.resolve({});
    return new Promise(resolve => {
      let done = false;
      const field = (id, label, val = '', req = true, area = false, hint = '') => `<div class="field full" data-f="${id}"><label for="tf-${id}">${label}${req ? ' <span class="req">*</span>' : ''}</label>
        ${area ? `<textarea id="tf-${id}" name="${id}" class="input" rows="3">${esc(val)}</textarea>` : `<input id="tf-${id}" name="${id}" class="input" value="${esc(val)}" autocomplete="off">`}${hint ? `<p class="hint">${hint}</p>` : ''}<p class="err"></p></div>`;
      let title, body, fields;
      if (to === 'blocked') {
        title = 'Bloquear tarea'; fields = ['motivo', 'accion'];
        body = field('quien', 'Departamento, proveedor o persona de la que depende', c.dependenciaExterna || '', false) + field('motivo', 'Motivo del bloqueo', '', true, true) + field('accion', 'Acción necesaria para desbloquear', '', true, true);
      } else if (to === 'testing') {
        title = 'Enviar a prueba'; fields = ['comprobar', 'esperado'];
        body = field('comprobar', 'Qué se debe comprobar', (c.testing || {}).comprobar || '', true, true) + field('esperado', 'Resultado esperado', (c.testing || {}).esperado || c.criterio, true, true);
      } else if (to === 'done') {
        title = 'Completar tarea'; fields = ['nota'];
        body = `<p class="muted" style="margin-bottom:10px">Criterio de finalización: ${esc(c.criterio || 'sin definir')}</p>` + field('nota', 'Nota de cierre o evidencia', '', true, true, 'Qué se verificó y cómo (por ejemplo: «mueble revisado, estable»; enlace a foto o informe).');
      } else {
        title = 'Reabrir tarea'; fields = [];
        body = `<p>La tarea vuelve a «${colTitle(to)}». Su historial y el cierre anterior se conservan.</p>` + field('motivo', 'Motivo de la reapertura', '', false, true);
      }
      const m = openModal({ size: 'sm', html: `<form novalidate>
        <div class="modal-head"><div><p class="kicker">${esc(colTitle(from))} → ${esc(colTitle(to))}</p><h2 data-modal-title>${title}</h2></div>
          <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cancelar">${ICON.close}</button></div>
        <div class="modal-body"><p class="ik-ttl">${esc(c.titulo)}</p><div class="form-grid">${body}</div></div>
        <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Confirmar</span></button></div>
      </form>`, onClose: () => { if (!done) resolve(null); } });
      const form = m.el.querySelector('form');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = Object.fromEntries([...new FormData(form).entries()].map(([k, x]) => [k, String(x).trim()]));
        const errs = fields.filter(k => !v[k]);
        form.querySelectorAll('[data-f]').forEach(fl => { const bad = errs.includes(fl.dataset.f); fl.classList.toggle('invalid', bad); fl.querySelector('.err').textContent = bad ? 'Este dato es obligatorio para el cambio de estado.' : ''; });
        if (errs.length) { form.querySelector(`[name="${errs[0]}"]`).focus(); return; }
        done = true; m.close('force'); resolve(v);
      });
    });
  }

  /* ── Detalle / edición ── */
  /* preset: tarjeta leída de un archivo de actividad (parseCardFile); se revisa en el formulario antes de guardar. */
  /* Tarjeta consolidada en otro tablero: consulta de solo lectura con los datos vivos de la canónica. */
  function openLink(c) {
    const lt = linkTarget(c), t = lt && lt.card, name = lt ? lt.cons.destino.nombre : 'otro tablero';
    const href = lt ? `${lt.cons.destino.ruta}?tarjeta=${encodeURIComponent(c.enlace.id)}` : '';
    const pr = t ? progress(t) : null;
    openModal({ html: `<div class="modal-head"><div><p class="kicker">Enlace transversal · solo lectura</p><h2 data-modal-title>${esc(t ? t.titulo : c.titulo)}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        ${alertBox('info', `Consolidada en el Kanban de ${esc(name)}`, `<p>Esta actividad y «${esc(c.titulo)}» (${esc(c.id)}) describían el mismo trabajo. Se edita en ${esc(name)}; aquí solo se consulta, para no mantener dos copias.</p>`)}
        ${t ? `<dl class="ik-ro">
          <div><dt>Estado</dt><dd>${esc(colTitle(t.estado))}</dd></div><div><dt>Responsable</dt><dd>${esc(t.responsable || 'Por asignar')}</dd></div>
          <div><dt>Prioridad</dt><dd>${esc(prioLabel(t.prioridad))}</dd></div>${pr.total ? `<div><dt>Subtareas</dt><dd>${pr.hechas}/${pr.total}</dd></div>` : ''}
          ${t.proximaAccion ? `<div class="full"><dt>Próxima acción</dt><dd>${esc(t.proximaAccion)}</dd></div>` : ''}
          ${t.estado === 'blocked' && t.bloqueo ? `<div class="full"><dt>Bloqueo</dt><dd>${esc(t.bloqueo.motivo)}${t.bloqueo.quien ? ` · depende de ${esc(t.bloqueo.quien)}` : ''}</dd></div>` : ''}
          <div class="full"><dt>Objetivo</dt><dd>${esc(t.objetivo)}</dd></div></dl>`
          : `<p>La actividad canónica no está guardada en este navegador. Abre el Kanban de ${esc(name)} para verla.</p>`}
        <details class="ik-orig"><summary>Datos que tenía esta tarjeta en este tablero</summary>
          <p><b>Estado:</b> ${esc(colTitle(c.estado))} · <b>Responsable:</b> ${esc(c.responsable || 'por asignar')}</p>
          ${c.notas ? `<p class="ik-pre">${esc(c.notas)}</p>` : ''}
          ${c.historial.length ? `<ol class="ik-hist">${[...c.historial].reverse().map(h => `<li><span class="mono dim">${esc(fmtDate(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol>` : ''}
        </details>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cerrar</button>${href ? `<a class="btn btn-primary" href="${esc(href)}">Abrir en ${esc(name)}</a>` : ''}</div>` });
  }

  /* Opciones «macroobjetivo › objetivo específico» del formulario. */
  function estructuraOptions(cur) {
    const weeks = new Set([...B.cards.map(c => c.objetivoEsp).filter(weekOfObj), weekObjId(mondayOf(todayStr()))]);
    return `<option value="|" ${cur === '|' ? 'selected' : ''}>Por clasificar</option>` + E.macros.map(m => {
      const objs = [...m.objetivos.map(o => [o.id, o.titulo]), ...(m.semanal ? [...weeks].sort().map(w => [w, objTitle(m, w)]) : [])];
      if (cur.startsWith(m.id + '|') && !objs.some(([id]) => cur === `${m.id}|${id}`) && cur !== m.id + '|') objs.push([cur.slice(m.id.length + 1), objTitle(m, cur.slice(m.id.length + 1))]);
      return `<optgroup label="${esc(m.letra + ' · ' + m.titulo)}"><option value="${esc(m.id)}|" ${cur === m.id + '|' ? 'selected' : ''}>${esc(m.letra)} · Actividad principal (con fases)</option>
        ${objs.map(([id, t]) => `<option value="${esc(m.id + '|' + id)}" ${cur === m.id + '|' + id ? 'selected' : ''}>${esc(m.letra)} › ${esc(t)}</option>`).join('')}</optgroup>`;
    }).join('');
  }

  function openCard(c = null, preset = null) {
    if (c && c.enlace) { openLink(c); return; }
    const isNew = !c;
    const d = normCard(c ? JSON.parse(JSON.stringify(c)) : preset ? preset.card : { id: uid('t'), titulo: '', estado: 'todo', proyecto: cfg.proyectoNuevo || '' });
    if (preset && (!d.id || byId(d.id))) d.id = uid('t');   // nunca pisa una tarjeta existente
    // Grupo inicial: el de la tarjeta; en una nueva, el macroobjetivo abierto o la regla que le corresponda.
    if (E && isNew && !d.clasificada) {
      const r = ruleFor(E, d);
      if (r) [d.macro, d.objetivoEsp] = r; else if (B.view === 'macro' && macroOf(B.macro)) d.macro = B.macro;
    }
    const estrCur = E && macroOf(d.macro) ? `${d.macro}|${d.objetivoEsp}` : '|';
    const newLinked = []; // tarjetas creadas desde subtareas (se guardan al confirmar)
    const optP = PRIOS.map(p => `<option value="${p.id}" ${p.id === d.prioridad ? 'selected' : ''}>${p.label}</option>`).join('');
    const proys = [...new Set([...(cfg.proyectos || []), ...B.cards.map(x => x.proyecto)].filter(Boolean))];
    const inp = (id, label, val, opts = {}) => `<div class="field ${opts.full ? 'full' : ''}" data-f="${id}"><label for="cf-${id}">${label}${opts.req ? ' <span class="req">*</span>' : ''}</label>
      ${opts.area ? `<textarea id="cf-${id}" name="${id}" class="input" rows="${opts.rows || 3}">${esc(val)}</textarea>`
        : `<input id="cf-${id}" name="${id}" class="input" type="${opts.type || 'text'}" value="${esc(val)}" ${opts.list ? `list="${opts.list}"` : ''} autocomplete="off">`}
      ${opts.hint ? `<p class="hint">${opts.hint}</p>` : ''}<p class="err"></p></div>`;
    const linked = d.vinculadas.map(byId).filter(Boolean);
    const hist = [...d.historial].reverse();
    const m = openModal({ html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${isNew ? 'Nueva tarjeta' : `${esc(colTitle(d.estado))}${d.estadoPorConfirmar ? ' · estado por confirmar' : ''}${d.archivada ? ' · archivada' : ''}`}</p>
        <h2 data-modal-title>${isNew ? 'Nueva tarjeta' : esc(d.titulo)}</h2>
        ${isNew ? `<div class="ik-fromfile"><button type="button" class="btn btn-sm" data-file="pick">${ICON.upload}Cargar JSON</button>
          <button type="button" class="btn btn-sm btn-ghost" data-file="template">${ICON.download}Plantilla</button>
          <input type="file" accept="application/json,.json" data-cardfile hidden></div>` : ''}</div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body">
        ${preset ? `<div style="margin-bottom:14px">${alertBox('info', `Datos cargados desde «${esc(preset.file)}»`, `<p>Revisa los campos y pulsa «Guardar» para crear la tarjeta en ${esc(colTitle(d.estado))}.</p>${preset.aviso ? `<p>${esc(preset.aviso)}</p>` : ''}`)}</div>` : ''}
        ${d.estado === 'blocked' && d.bloqueo ? `<div style="margin-bottom:14px">${alertBox('err', `Bloqueada · depende de ${esc(d.bloqueo.quien || 'dependencia por identificar')}`, `<p>${esc(d.bloqueo.motivo)}</p><p><b style="display:inline">Para desbloquear:</b> ${esc(d.bloqueo.accion)}</p>`)}</div>` : ''}
        ${d.estado === 'testing' && d.testing ? `<div style="margin-bottom:14px">${alertBox('info', 'En prueba', `<p><b style="display:inline">Comprobar:</b> ${esc(d.testing.comprobar)}</p><p><b style="display:inline">Resultado esperado:</b> ${esc(d.testing.esperado)}</p>`)}</div>` : ''}
        ${d.estado === 'done' && d.cierre ? `<div style="margin-bottom:14px">${alertBox('info', `Completada${d.cierre.fecha ? ' el ' + fmtD(d.cierre.fecha) : ''}`, `<p>${esc(d.cierre.nota)}</p>`)}</div>` : ''}
        <div class="form-grid">
          ${inp('titulo', 'Título (acción)', d.titulo, { req: true, full: true, hint: 'Empieza con un verbo: «Instalar…», «Obtener…», «Revisar…».' })}
          ${inp('objetivo', 'Objetivo o resultado esperado', d.objetivo, { req: true, full: true, area: true, rows: 2 })}
          ${inp('descripcion', 'Descripción y alcance', d.descripcion, { full: true, area: true })}
          ${inp('criterio', 'Criterio de finalización', d.criterio, { full: true, area: true, rows: 2 })}
          <div class="field" data-f="prioridad"><label for="cf-prioridad">Prioridad</label><select id="cf-prioridad" name="prioridad" class="select" style="width:100%"><option value="">Por confirmar</option>${optP}</select></div>
          ${inp('proyecto', 'Proyecto o categoría', d.proyecto, { list: 'cf-proys' })}<datalist id="cf-proys">${proys.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
          ${inp('equipo', 'Equipo o área', d.equipo)}
          ${E ? `<div class="field full" data-f="estructura"><label for="cf-estructura">Macroobjetivo y objetivo específico</label>
            <select id="cf-estructura" name="estructura" class="select" style="width:100%">${estructuraOptions(estrCur)}</select>
            <p class="hint">Agrupa la tarjeta en la vista de macroobjetivos. No cambia su estado ni la une con otras tarjetas.</p></div>` : ''}
          ${inp('responsable', 'Responsable de ejecución', d.responsable, { hint: 'Vacío = «Por asignar».' })}
          ${inp('supervisor', 'Supervisión', d.supervisor)}
          ${inp('solicitante', 'Solicitante o interlocutor', d.solicitante, { hint: 'Quien pide o con quien se coordina; no es necesariamente quien ejecuta.' })}
          ${inp('dependenciaExterna', 'Departamento o proveedor del que depende', d.dependenciaExterna, { hint: 'Registrar una dependencia no bloquea la tarjeta.' })}
          ${inp('colaboradores', 'Colaboradores o apoyo', d.colaboradores, { hint: 'Separados por comas. No son responsables de la tarjeta.' })}
          ${inp('referencias', 'Referencias de seguimiento', d.referencias.join(', '), { hint: 'Por ejemplo, códigos de una reunión (I02, M03…). Separadas por comas.' })}
          ${inp('proximaAccion', 'Próxima acción', d.proximaAccion, { full: true })}
          ${inp('fOriginal', 'Fecha original', d.fechas.original, { type: 'date' })}
          ${inp('fReprog', 'Fecha reprogramada', d.fechas.reprogramada, { type: 'date', hint: 'La fecha original se conserva.' })}
          ${inp('fRevision', 'Fecha de revisión', d.fechas.revision, { type: 'date', hint: 'Revisión de avance acordada. No es fecha de cierre ni hace vencer la tarjeta.' })}
          ${inp('fPlazo', 'Plazo sin día fijo', d.fechas.plazo, { hint: 'Por ejemplo: «Esta semana (9–15/11/2026)».' })}
          ${inp('condicionadas', 'Fechas condicionadas o previstas', d.fechas.condicionadas.map(x => `${fmtD(x.fecha)} — ${x.condicion}`).join('\n'), { full: true, area: true, rows: 2, hint: 'Una por línea con el formato «dd/mm/aaaa — condición». No cambian el estado de la tarea.' })}
          <fieldset class="field full ik-subs"><legend>Subtareas</legend>
            <ul data-subs></ul>
            <div class="ik-subadd"><label class="sr-only" for="cf-newsub">Nueva subtarea</label><input id="cf-newsub" class="input" placeholder="Nueva subtarea…"><button type="button" class="btn btn-sm" data-sub="add">${ICON.plus}Agregar</button></div>
          </fieldset>
          ${inp('notas', 'Notas', d.notas, { full: true, area: true })}
          ${inp('enlaces', 'Enlaces de referencia', d.enlaces.join('\n'), { full: true, area: true, rows: 2, hint: 'Uno por línea (https://…).' })}
          <label class="check full"><input type="checkbox" name="porConfirmar" ${d.estadoPorConfirmar ? 'checked' : ''}> Estado por confirmar</label>
        </div>
        ${linked.length ? `<section class="sec"><h3 class="sec-title">${ICON.list}Tarjetas vinculadas</h3><ul class="ik-links">${linked.map(x => `<li><button type="button" class="btn btn-sm btn-ghost" data-open="${esc(x.id)}">${esc(x.titulo)}</button> <span class="dim">· ${esc(colTitle(x.estado))}</span></li>`).join('')}</ul></section>` : ''}
        ${d.enlaces.length ? `<section class="sec"><h3 class="sec-title">Enlaces</h3><ul class="ik-links">${d.enlaces.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('')}</ul></section>` : ''}
        ${hist.length ? `<section class="sec"><h3 class="sec-title">${ICON.history}Historial</h3><ol class="ik-hist">${hist.map(h => `<li><span class="mono dim">${esc(fmtDate(h.fecha))}</span> ${h.de && h.a && h.de !== h.a ? `<b>${esc(colTitle(h.de))} → ${esc(colTitle(h.a))}</b> · ` : ''}${esc(h.nota)}</li>`).join('')}</ol></section>` : ''}
      </div>
      <div class="modal-foot">
        ${isNew ? '' : `<div class="left">${d.archivada ? `<button type="button" class="btn" data-x="restore">Recuperar</button>` : `<button type="button" class="btn btn-danger" data-x="archive">${ICON.trash}Archivar</button>`}</div>`}
        <button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Guardar</span></button>
      </div>
    </form>`, initialFocus: isNew ? '#cf-titulo' : undefined });

    const form = m.el.querySelector('form');
    let dirty = !!preset;
    form.addEventListener('input', () => { dirty = true; });
    m.setCanClose(() => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'));

    const subsEl = form.querySelector('[data-subs]');
    // En una actividad principal (macroobjetivo sin objetivo concreto), cada subtarea puede indicar su fase.
    const phaseMacro = () => { if (!E || !form.elements.estructura) return null; const [mid, oid] = form.elements.estructura.value.split('|'); const mm = macroOf(mid); return mm && !oid && mm.objetivos.length ? mm : null; };
    const drawSubs = () => {
      const pm = phaseMacro();
      subsEl.innerHTML = d.subtareas.length ? d.subtareas.map((s, i) => `<li>
        <label class="check"><input type="checkbox" data-sub="toggle" data-i="${i}" ${s.hecha ? 'checked' : ''}> <span class="${s.hecha ? 'ik-done' : ''}">${esc(s.texto)}${s.equivale && byId(s.equivale) ? ` <small class="dim">· también registrada como hito «${esc(byId(s.equivale).titulo)}»: cuenta una sola vez</small>` : ''}</span></label>
        <span class="ik-subact">${pm ? `<label class="sr-only" for="cf-fase-${i}">Fase de «${esc(s.texto)}»</label><select id="cf-fase-${i}" class="select ik-fase" data-sub="fase" data-i="${i}"><option value="">Sin fase</option>${pm.objetivos.map(o => `<option value="${esc(o.id)}" ${s.fase === o.id ? 'selected' : ''}>${esc(o.titulo)}</option>`).join('')}</select>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" data-sub="link" data-i="${i}" title="Convertir en tarjeta vinculada">Convertir en tarjeta</button>
        <button type="button" class="btn btn-sm btn-ghost icon-btn" data-sub="del" data-i="${i}" aria-label="Quitar subtarea «${esc(s.texto)}»">${ICON.close}</button></span></li>`).join('')
        : '<li class="none">Sin subtareas.</li>';
    };
    drawSubs();
    form.addEventListener('click', e => {
      const b = e.target.closest('[data-sub]'); if (!b || b.dataset.sub === 'toggle' || b.dataset.sub === 'fase') return; // casilla y fase: en «change»
      const i = Number(b.dataset.i), act = b.dataset.sub;
      if (act === 'add') { const n = form.querySelector('#cf-newsub'); const t = n.value.trim(); if (!t) { n.focus(); return; } d.subtareas.push({ id: uid('s'), texto: t, hecha: false }); n.value = ''; n.focus(); }
      if (act === 'del') d.subtareas.splice(i, 1);
      if (act === 'link') {
        const s = d.subtareas[i]; const nc = normCard({ id: uid('t'), titulo: s.texto, objetivo: s.texto, estado: 'todo', proyecto: d.proyecto, equipo: d.equipo, prioridad: d.prioridad, vinculadas: [d.id], objetivoEsp: s.fase });
        nc.creada = nowIso(); nc.historial = [{ fecha: nc.creada, tipo: 'creada', de: '', a: 'todo', nota: `Creada desde una subtarea de «${d.titulo || 'tarjeta'}».` }];
        newLinked.push(nc); d.vinculadas.push(nc.id); d.subtareas.splice(i, 1);
        toast(`Se creará la tarjeta «${s.texto}» al guardar.`);
      }
      dirty = true; drawSubs();
    });
    form.addEventListener('change', e => {
      if (e.target.dataset.sub === 'toggle') { d.subtareas[Number(e.target.dataset.i)].hecha = e.target.checked; dirty = true; }
      if (e.target.dataset.sub === 'fase') { d.subtareas[Number(e.target.dataset.i)].fase = e.target.value; dirty = true; }
      if (e.target.name === 'estructura') { dirty = true; drawSubs(); }
    });
    form.querySelector('#cf-newsub').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-sub="add"]').click(); } });

    if (isNew) {
      const fileIn = m.el.querySelector('[data-cardfile]');
      m.el.querySelector('[data-file="pick"]').addEventListener('click', () => fileIn.click());
      m.el.querySelector('[data-file="template"]').addEventListener('click', () => downloadJson(cardTemplate(BOARD_ID), `plantilla-tarjeta-${cfg.fileSlug}.json`));
      fileIn.addEventListener('change', async () => {
        const file = fileIn.files && fileIn.files[0]; fileIn.value = '';
        if (!file) return;
        if (file.size > 1024 * 1024) { toast('El archivo es demasiado grande (máximo 1 MB).', 'err'); return; }
        let obj; try { obj = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.', 'err', 7000); return; }
        const r = parseCardFile(obj, BOARD_ID);
        if (!r.ok) { toast('No se cargó: ' + r.error, 'err', 9000); return; }
        if (dirty && !window.confirm('El formulario tiene datos. ¿Reemplazarlos por los del archivo?')) return;
        m.close('force'); setTimeout(() => openCard(null, { card: r.value, file: file.name, aviso: r.aviso }), 0);
      });
    }

    m.el.addEventListener('click', async e => {
      const o = e.target.closest('[data-open]'); if (o) { m.close('dismiss'); const x = byId(o.dataset.open); if (x) setTimeout(() => openCard(x), 0); return; }
      const x = e.target.closest('[data-x]'); if (!x) return;
      const real = byId(d.id); if (!real) return;
      if (x.dataset.x === 'archive') {
        const ok = await confirmDialog({ title: 'Archivar tarjeta', confirm: 'Archivar', danger: true, body: `<p>«<b>${esc(real.titulo)}</b>» saldrá del tablero. Podrás recuperarla desde «Archivadas».</p>` });
        if (!ok) return;
        real.archivada = true; log(real, 'archivo', 'Archivada.'); reindex(real.estado); persist(); dirty = false; m.close('force'); render(); toast('Tarjeta archivada.');
      }
      if (x.dataset.x === 'restore') { restore(real); dirty = false; m.close('force'); }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const g = n => (form.elements[n] ? form.elements[n].value.trim() : '');
      const errs = {};
      if (!g('titulo')) errs.titulo = 'Escribe un título orientado a la acción.';
      if (!g('objetivo')) errs.objetivo = 'Indica el objetivo o resultado esperado.';
      const cond = [], badCond = [];
      lines(g('condicionadas')).forEach(l => { const [fd, ...rest] = l.split(/\s+[—–-]\s+/); const iso = parseD(fd); if (!iso) badCond.push(l); else cond.push({ fecha: iso, condicion: rest.join(' — ').trim() }); });
      if (badCond.length) errs.condicionadas = `Revisa el formato «dd/mm/aaaa — condición» en: ${badCond[0]}`;
      const links = lines(g('enlaces')); const badLink = links.find(u => !httpsUrl(u));
      if (badLink) errs.enlaces = `Los enlaces deben empezar por https:// (revisa «${badLink}»).`;
      form.querySelectorAll('.field[data-f]').forEach(fl => { const er = errs[fl.dataset.f]; fl.classList.toggle('invalid', !!er); const el = fl.querySelector('.err'); if (el) el.textContent = er || ''; });
      if (Object.keys(errs).length) { form.querySelector(`[name="${Object.keys(errs)[0]}"]`).focus(); return; }

      const target = isNew ? d : byId(d.id);
      const before = isNew ? null : JSON.stringify([target.fechas, target.responsable, target.prioridad]);
      Object.assign(target, {
        titulo: g('titulo'), objetivo: g('objetivo'), descripcion: g('descripcion'), criterio: g('criterio'), prioridad: g('prioridad'), proyecto: g('proyecto'), equipo: g('equipo'),
        responsable: g('responsable'), supervisor: g('supervisor'), solicitante: g('solicitante'), dependenciaExterna: g('dependenciaExterna'), proximaAccion: g('proximaAccion'),
        colaboradores: g('colaboradores'), referencias: g('referencias').split(',').map(x => x.trim()).filter(Boolean).slice(0, 20),
        fechas: { original: g('fOriginal'), reprogramada: g('fReprog'), revision: g('fRevision'), plazo: g('fPlazo'), condicionadas: cond },
        subtareas: d.subtareas, notas: g('notas'), enlaces: links, vinculadas: d.vinculadas
      });
      const pc = form.elements.porConfirmar.checked;
      if (pc !== target.estadoPorConfirmar) log(target, 'confirmacion', pc ? 'Marcada como «estado por confirmar».' : 'Estado confirmado.');
      target.estadoPorConfirmar = pc;
      if (E && form.elements.estructura) {
        const [mid, oid] = form.elements.estructura.value.split('|'), mm = macroOf(mid);
        const nm = mm ? mid : '', no = mm ? (oid || '') : '';
        if (!isNew && (nm !== target.macro || no !== target.objetivoEsp || !target.clasificada))
          log(target, 'clasificacion', mm ? `Agrupada en «${mm.letra} · ${mm.titulo}»${no ? ` › «${objTitle(mm, no)}»` : ' como actividad principal'}. Estado sin cambios.` : 'Marcada «Por clasificar». Estado sin cambios.');
        target.macro = nm; target.objetivoEsp = no; target.clasificada = true;
      }
      if (isNew) {
        target.creada = nowIso(); target.historial = [{ fecha: target.creada, tipo: 'creada', de: '', a: target.estado, nota: preset ? `Tarjeta creada desde el archivo «${preset.file}».` : 'Tarjeta creada.' }];
        B.cards.push(target); place(target, target.estado, null);
      } else {
        log(target, 'edicion', JSON.stringify([target.fechas, target.responsable, target.prioridad]) !== before ? 'Datos editados (fechas, responsable o prioridad).' : 'Datos editados.');
      }
      // Las tarjetas creadas desde subtareas quedan en el mismo macroobjetivo (y en la fase de la subtarea, si la tenía).
      newLinked.forEach(nc => { if (E) { nc.macro = target.macro; nc.objetivoEsp = target.macro ? (nc.objetivoEsp || target.objetivoEsp) : ''; nc.clasificada = true; } B.cards.push(nc); place(nc, 'todo', null); });
      persist(); dirty = false; m.close('force'); render();
      toast(isNew ? 'Tarjeta creada.' : 'Cambios guardados.');
    });
  }

  function restore(c) {
    c.archivada = false; log(c, 'recuperada', 'Recuperada del archivo.'); place(c, c.estado, null); persist(); render(); toast(`«${c.titulo}» recuperada.`);
  }

  /* ── Exportar / importar ── */
  function downloadJson(obj, name) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  // El archivo sigue siendo «ccs-kanban-v1»: los respaldos anteriores (sin «estructura») se importan y se migran igual.
  function exportJson() {
    downloadJson({ schema: SCHEMA, id: BOARD_ID, exportado: nowIso(),
      estructura: E ? { version: ESTRUCTURA_VERSION, nodosVistos: B.nodos,
        macroobjetivos: E.macros.map(m => ({ id: m.id, letra: m.letra, titulo: m.titulo, resultado: m.resultado, objetivos: m.objetivos })) } : undefined,
      tarjetas: B.cards }, `${cfg.fileSlug}-${todayStr()}.json`);
    toast('Respaldo exportado.');
  }
  function downloadBackup() {
    let raw = null; try { raw = JSON.parse(localStorage.getItem(backupKey(cfg.storeKey)) || 'null'); } catch { raw = null; }
    if (!raw) { toast('No hay un respaldo previo en este navegador.', 'err'); return; }
    downloadJson(raw, `${cfg.fileSlug}-respaldo-previo-reorganizacion.json`);
    toast('Respaldo previo descargado. Se puede volver a importar con «Importar JSON».', 'ok', 7000);
  }
  // Tras importar: conserva la clasificación de las tarjetas que el archivo trae sin ella y migra las nuevas.
  function afterImport(obj) {
    const nv = obj && obj.estructura && obj.estructura.nodosVistos;
    if (nv && typeof nv === 'object' && !Array.isArray(nv)) Object.keys(nv).forEach(k => { if (!B.nodos[k] && /^[\w .-]{1,40}$/.test(k)) B.nodos[k] = String(nv[k]).slice(0, 40); });
    classify(B.cards.filter(c => !c.clasificada && !c.enlace && !isConsolOrigin(c)));
    // Subtareas nuevas de una actividad principal ya clasificada (p. ej. desde un archivo de actualización): reciben su fase.
    if (E) B.cards.filter(c => c.clasificada && !c.enlace).forEach(c => applySubtaskRules(E, c));
  }

  /* Importación. Por defecto incorpora o actualiza por ID: las tarjetas del archivo que ya existen se
     sustituyen por la versión del archivo, las nuevas se agregan y las que no están en el archivo se conservan.
     Reemplazar el tablero completo es una opción aparte y explícita. */
  function importPlan(incoming) {
    const cur = new Map(B.cards.map(c => [c.id, c]));
    const ids = new Set(incoming.map(c => c.id));
    const nuevas = incoming.filter(c => !cur.has(c.id));
    // Un respaldo anterior a la reorganización no trae los campos de estructura: no cuenta como diferencia.
    const STRUCT_H = ['clasificacion', 'consolidacion'];
    const comparable = (inc, base) => {
      const a = normCard(base), x = JSON.parse(JSON.stringify(inc));
      if (!x.clasificada) {
        Object.assign(x, { macro: a.macro, objetivoEsp: a.objetivoEsp, clasificada: a.clasificada, enlace: x.enlace || a.enlace });
        x.subtareas.forEach(s => { const o = a.subtareas.find(y => y.id === s.id); if (o) { s.fase = s.fase || o.fase; s.equivale = s.equivale || o.equivale; } });
        a.historial = a.historial.filter(h => !STRUCT_H.includes(h.tipo));
      }
      return JSON.stringify(x) === JSON.stringify(a);
    };
    const actualizadas = incoming.filter(c => cur.has(c.id) && !comparable(c, cur.get(c.id)));
    const iguales = incoming.length - nuevas.length - actualizadas.length;
    const fuera = B.cards.filter(c => !ids.has(c.id));
    return { nuevas, actualizadas, iguales, fuera };
  }

  function applyMerge(plan, fileName) {
    const at = nowIso();
    plan.actualizadas.forEach(nc => {
      const i = B.cards.findIndex(x => x.id === nc.id); if (i < 0) return;
      const old = B.cards[i];
      if (!nc.clasificada && old.clasificada) {   // respaldo anterior a la reorganización: no pierde su grupo ni sus fases
        Object.assign(nc, { macro: old.macro, objetivoEsp: old.objetivoEsp, clasificada: true });
        nc.subtareas.forEach(s => { const o = old.subtareas.find(x => x.id === s.id); if (o) { s.fase = s.fase || o.fase; s.equivale = s.equivale || o.equivale; } });
      }
      if (!nc.enlace && old.enlace) nc.enlace = old.enlace;   // una consolidación no se deshace al importar
      const seen = new Set(nc.historial.map(h => h.fecha + '|' + h.nota));   // ni se pierde su constancia en el historial
      old.historial.filter(h => (h.tipo === 'clasificacion' || h.tipo === 'consolidacion') && !seen.has(h.fecha + '|' + h.nota)).forEach(h => nc.historial.push(h));
      nc.historial.push({ fecha: at, tipo: 'importacion', de: B.cards[i].estado, a: nc.estado, nota: `Actualizada desde el archivo «${fileName}».` });
      B.cards[i] = nc;
    });
    COL_IDS.forEach(reindex);
    plan.nuevas.forEach(nc => {
      nc.creada = nc.creada || at;
      nc.historial.push({ fecha: at, tipo: 'importacion', de: '', a: nc.estado, nota: `Incorporada desde el archivo «${fileName}».` });
      B.cards.push(nc); if (!nc.archivada) place(nc, nc.estado, null);
    });
  }

  async function onImport(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('El archivo es demasiado grande (máximo 5 MB).', 'err'); return; }
    let obj; try { obj = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.', 'err', 7000); return; }
    if (obj && obj.schema === CARD_SCHEMA) {   // archivo de una sola actividad: se abre como tarjeta nueva para revisarla
      const one = parseCardFile(obj, BOARD_ID);
      if (!one.ok) { toast('No se cargó: ' + one.error, 'err', 9000); return; }
      openCard(null, { card: one.value, file: file.name, aviso: one.aviso }); return;
    }
    if (obj && obj.schema === UPDATE_SCHEMA) { importUpdate(obj, file.name); return; }
    const r = validateBoard(obj, BOARD_ID, cfg.boardName);
    if (!r.ok) { toast('No se importó: ' + r.error, 'err', 9000); return; }
    const plan = importPlan(r.value);
    const li = (n, t) => `<li><b>${n}</b> ${t}</li>`;
    const m = openModal({ size: 'sm', html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${esc(file.name)}</p><h2 data-modal-title>Importar tarjetas</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cancelar">${ICON.close}</button></div>
      <div class="modal-body">
        <p>El archivo tiene ${r.value.length} tarjeta${r.value.length === 1 ? '' : 's'} y este tablero, ${B.cards.length}.</p>
        <fieldset class="ik-imp"><legend class="sr-only">Modo de importación</legend>
          <label class="ik-impopt"><input type="radio" name="modo" value="merge" checked>
            <span><b>Incorporar o actualizar por ID</b> (recomendado)
              <ul class="ik-impsum">${li(plan.nuevas.length, 'nuevas se agregarán')}${li(plan.actualizadas.length, 'existentes se actualizarán con la versión del archivo')}${li(plan.iguales, 'ya están iguales y no cambian')}${li(plan.fuera.length, 'del tablero no están en el archivo y se conservan')}</ul>
              <small>No se duplican tarjetas ni se borra ninguna.</small></span></label>
          <label class="ik-impopt danger"><input type="radio" name="modo" value="replace">
            <span><b>Reemplazar el tablero completo</b>
              <small>El tablero quedará exactamente como el archivo: se eliminarán de este navegador las ${plan.fuera.length} tarjeta${plan.fuera.length === 1 ? '' : 's'} que no están en él, con su historial. Exporta antes un respaldo si las necesitas.</small></span></label>
        </fieldset>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary" data-go>${ICON.upload}<span>Incorporar</span></button></div>
    </form>` });
    const form = m.el.querySelector('form'), go = form.querySelector('[data-go]');
    form.addEventListener('change', () => {
      const rep = form.elements.modo.value === 'replace';
      go.className = `btn ${rep ? 'btn-danger' : 'btn-primary'}`; go.querySelector('span').textContent = rep ? 'Reemplazar todo' : 'Incorporar';
    });
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      if (form.elements.modo.value === 'replace') {
        B.cards = r.value; afterImport(obj); persist(); m.close('force'); render();
        toast(`Tablero reemplazado: ${r.value.length} tarjetas.`);
        return;
      }
      if (!plan.nuevas.length && !plan.actualizadas.length) { m.close('force'); toast('No hubo cambios: el tablero ya tenía esas tarjetas.'); return; }
      applyMerge(plan, file.name); afterImport(obj); persist(); m.close('force'); render();
      toast(`Importación: ${plan.nuevas.length} nuevas, ${plan.actualizadas.length} actualizadas; ${plan.fuera.length} conservadas sin cambios.`, 'ok', 7000);
    });
  }

  /* Actualización (ccs-kanban-actualizacion-v1): muestra qué se crea, qué se amplía y qué no se aplica, y solo
     cambia el tablero al confirmar. Nunca mueve una tarjeta existente de columna ni borra nada. */
  function importUpdate(obj, fileName) {
    const r = parseUpdateFile(obj, BOARD_ID);
    if (!r.ok) { toast('No se importó: ' + r.error, 'err', 9000); return; }
    const upd = r.value, plan = planUpdate(B.cards, upd);
    const of = a => plan.filter(it => it.accion === a);
    const crear = of('crear'), ampliar = of('ampliar'), igual = of('igual'), fallan = plan.filter(it => it.accion === 'ambigua' || it.accion === 'sin-tarjeta');
    const name = it => esc(it.next ? it.next.titulo : (it.ch.tarjeta && it.ch.tarjeta.titulo) || it.ch.id);
    const refs = it => (it.next && it.next.referencias.length ? ` <span class="dim">· ${esc(it.next.referencias.join(' / '))}</span>` : '');
    const block = (title, list, row) => (list.length ? `<section class="sec"><h3 class="sec-title">${title} (${list.length})</h3><ul class="ik-updlist">${list.map(row).join('')}</ul></section>` : '');
    const m = openModal({ html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${esc(fileName)}</p><h2 data-modal-title>${esc(upd.titulo)}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cancelar">${ICON.close}</button></div>
      <div class="modal-body">
        <p class="muted" style="margin-bottom:12px">Las tarjetas existentes conservan su columna, historial, bloqueo, cierre y subtareas hechas: solo se les agrega lo nuevo. Ninguna tarjeta se borra.</p>
        ${block('Tarjetas nuevas', crear, it => `<li><b>${name(it)}</b>${refs(it)} <span class="dim">· entra en ${esc(colTitle(it.next.estado))}</span></li>`)}
        ${block('Tarjetas que se amplían', ampliar, it => `<li><b>${name(it)}</b>${refs(it)} <span class="dim">· sigue en ${esc(colTitle(it.next.estado))}</span><br><small>${esc(it.cambios.join(' · '))}</small></li>`)}
        ${block('No se aplican', fallan, it => `<li><b>${name(it)}</b><br><small>${it.accion === 'ambigua'
          ? `Coincide con más de una tarjeta o con una ya usada (${esc(it.candidatos.map(c => c.titulo).join(' / '))}). Amplíala a mano.`
          : 'No se encontró la tarjeta en este tablero.'}</small></li>`)}
        ${igual.length ? `<p class="muted">${plural(igual.length, 'tarjeta ya tiene', 'tarjetas ya tienen')} estos datos y no cambia${igual.length === 1 ? '' : 'n'}.</p>` : ''}
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary" ${crear.length || ampliar.length ? '' : 'disabled'}>${ICON.upload}<span>Aplicar actualización</span></button></div>
    </form>` });
    m.el.querySelector('form').addEventListener('submit', ev => {
      ev.preventDefault();
      const at = nowIso();
      ampliar.forEach(it => {
        const i = B.cards.findIndex(x => x.id === it.next.id); if (i < 0) return;
        it.next.historial.push({ fecha: at, tipo: 'actualizacion', de: it.next.estado, a: it.next.estado, nota: `Actualizada con «${upd.titulo}» (${fileName}): ${it.cambios.join(', ')}.` });
        B.cards[i] = it.next;
      });
      crear.forEach(it => {
        const c = it.next; c.creada = at;
        c.historial = [{ fecha: at, tipo: 'importacion', de: '', a: c.estado, nota: `Creada desde «${upd.titulo}» (${fileName}).` }];
        B.cards.push(c); place(c, c.estado, null);
      });
      afterImport(null); persist(); m.close('force'); render();
      toast(`Actualización aplicada: ${crear.length} nuevas, ${ampliar.length} ampliadas${fallan.length ? `, ${fallan.length} sin aplicar` : ''}.`, 'ok', 8000);
    });
  }

  /* ── Eventos ── */
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !root.contains(b) || b.tagName === 'SELECT') return;
    const id = b.dataset.id, c = id && byId(id);
    switch (b.dataset.act) {
      case 'open': if (c) openCard(c); break;
      case 'new': openCard(null); break;
      case 'up': case 'down': {
        if (!c) break;
        const col = B.cards.filter(x => x.estado === c.estado && !x.archivada && visible(x)).sort((a, z) => a.orden - z.orden);
        const i = col.indexOf(c), j = b.dataset.act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= col.length) break;
        [c.orden, col[j].orden] = [col[j].orden, c.orden];
        persist(); render();
        const nb = root.querySelector(`[data-act="${b.dataset.act}"][data-id="${CSS.escape(id)}"]`);
        (nb && !nb.disabled ? nb : root.querySelector(`#st-${CSS.escape(id)}`)).focus();
        break;
      }
      case 'pick': B.mobileCol = b.dataset.col; render(); root.querySelector(`[data-act="pick"][data-col="${b.dataset.col}"]`).focus(); break;
      case 'export': exportJson(); break;
      case 'import': root.querySelector('[data-import]').click(); break;
      case 'archived': B.f.archivadas = !B.f.archivadas; render(); break;
      case 'restore': if (c) restore(c); break;
      case 'ext-open': { const x = B.ext.items.find(i => i.id === id); if (x) cfg.external.open(x.ref); break; }
      case 'ext-refresh': loadExternal(true); break;
      case 'link-open': if (c) openLink(c); break;
      case 'backup': downloadBackup(); break;
      case 'view': {
        B.view = b.dataset.view === 'all' ? 'all' : 'macro'; B.macro = null; pref.set(B.view); render();
        const nb = root.querySelector(`[data-act="view"][data-view="${B.view}"]`); nb && nb.focus();
        break;
      }
      case 'macro': {   // abre el desglose de un macroobjetivo
        if (!macroOf(b.dataset.macro)) break;
        B.macro = b.dataset.macro; render();
        const h = root.querySelector('#ik-mt'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
        break;
      }
      case 'macro-back': {
        const was = B.macro; B.macro = null; render();
        const nb = root.querySelector(`[data-act="macro"][data-macro="${CSS.escape(was || '')}"]`); nb && nb.focus();
        break;
      }
      case 'obj-all': root.querySelectorAll('details.ik-objgrp').forEach(d => { d.open = b.dataset.open === '1'; }); break;
      case 'week-new': createWeek(); break;
    }
  });

  /* Actividad semanal de formación y reporte (macroobjetivo semanal): una por semana, creada solo a petición. */
  function createWeek() {
    const m = E && E.macros.find(x => x.semanal); if (!m) return;
    const mon = mondayOf(todayStr()), id = weekObjId(mon);
    if (byId(id)) { openCard(byId(id)); return; }
    const label = weekLabel(mon), at = nowIso();
    const c = normCard({ id, titulo: `Completar la formación y el reporte · ${label.charAt(0).toLowerCase() + label.slice(1)}`,
      objetivo: 'Horas de formación en IA de la semana cubiertas y avances de la semana reportados a Alberto.',
      criterio: 'Las dos comprobaciones hechas, con su evidencia en la nota de cierre.', estado: 'todo', proyecto: 'Gestión departamental', equipo: 'Formación y reportes',
      solicitante: 'Alberto (destinatario del reporte)', transversal: true, fechas: { plazo: label },
      subtareas: [{ id: 'horas', texto: 'Horas de formación cubiertas' }, { id: 'reporte', texto: 'Avances de la semana reportados' }],
      macro: m.id, objetivoEsp: id, clasificada: true });
    c.creada = at; c.historial = [{ fecha: at, tipo: 'creada', de: '', a: 'todo', nota: `Actividad semanal creada (${label}). No se marcan sesiones ni reportes sin evidencia.` }];
    B.cards.push(c); place(c, 'todo', null); persist(); render();
    toast(`Actividad de la ${label.charAt(0).toLowerCase() + label.slice(1)} creada en To do.`);
  }
  root.addEventListener('change', e => { if (e.target.dataset.act === 'state') moveCard(e.target.dataset.id, e.target.value); });

  function extStatus() {
    const e = cfg.external, s = B.ext.state;
    const btn = `<button type="button" class="btn btn-sm btn-ghost" data-act="ext-refresh" ${s === 'loading' ? 'disabled' : ''}>${ICON.refresh}${s === 'loading' ? 'Actualizando…' : 'Actualizar'}</button>`;
    const msg = s === 'loading' ? `Leyendo ${esc(e.sourceName)}…`
      : s === 'error' ? `No se pudo leer ${esc(e.sourceName)} (${esc(B.ext.error)}). El resto del tablero funciona con normalidad.`
        : `${B.ext.items.length} tarjeta${B.ext.items.length === 1 ? '' : 's'} sincronizada${B.ext.items.length === 1 ? '' : 's'} desde ${esc(e.sourceName)}. ${esc(e.rule || '')}`;
    return `<div class="ik-extbar ${s === 'error' ? 'err' : ''}" role="status"><p>${msg}</p>${btn}</div>`;
  }

  load().then(() => loadExternal());
  return () => { alive = false; };
}
