/* Almacenamiento del prototipo de Infraestructura. Prefijo EXCLUSIVO «ccs-infraestructura-v2:».
   No lee ni escribe las claves del Kanban anterior («ccs-infra-kanban-v1…») ni las de Manufactura («ccs-manufactura-v1:»).
   · preferencias: vista de Objetivos, macroobjetivos abiertos, secciones de la sidebar.
   · proyectos: datos de Inicio por id de registro ({ [id]: inicio }).
   · tareas: lista de tareas de los proyectos habilitados (Etapa 3).
   · kanban-macroobjetivos: tarjetas del Kanban general.
   · resultados: conclusión, hallazgos y fuentes de cada investigación ({ [id]: resultado }).
   · migracion-origen: copia íntegra de las tarjetas del Kanban anterior (exportación); migracion-estado: qué tarjeta se migró y a dónde;
     migracion-respaldo-previo: copia de los datos locales tomada justo antes de migrar (para deshacer).
   Las tareas iniciales salen de la lista definitiva; se agregan por id solo si faltan (volver a cargar no duplica
   ni sobrescribe ediciones locales). Restablecer borra únicamente este prefijo. */
import { REGISTROS, HABILITADOS, COLUMNAS, PRIORIDADES, DEPARTAMENTOS, RELACION_DEPTOS, ESTADOS_CONCLUSION } from './datos.js';

const PREFIJO = 'ccs-infraestructura-v2:';
const K = { prefs: PREFIJO + 'preferencias', proyectos: PREFIJO + 'proyectos', tareas: PREFIJO + 'tareas', kanban: PREFIJO + 'kanban-macroobjetivos', resultados: PREFIJO + 'resultados',
  origen: PREFIJO + 'migracion-origen', migracion: PREFIJO + 'migracion-estado', respaldo: PREFIJO + 'migracion-respaldo-previo', eliminadas: PREFIJO + 'tareas-eliminadas' };

const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const fecha = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const https = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const PRIO = PRIORIDADES.map(p => p.id), COL = COLUMNAS.map(c => c.id), DEP = DEPARTAMENTOS.map(d => d.id), REL = RELACION_DEPTOS.map(r => r.id);
const deptos = v => (Array.isArray(v) ? v : []).filter(d => d && DEP.includes(d.id)).map(d => ({ id: d.id, detalle: str(d.detalle, 600) }))
  .filter((d, i, a) => a.findIndex(x => x.id === d.id) === i);
const hist = v => (Array.isArray(v) ? v : []).filter(h => h && typeof h === 'object').map(h => ({ fecha: str(h.fecha, 40), tipo: str(h.tipo, 30), nota: str(h.nota, 1000) })).slice(-200);

/* Datos de Inicio de un proyecto. Nombre, tipo, macroobjetivo, relaciones y texto de la condición vienen de datos.js (fijos). */
export function normInicio(p = {}) {
  const d = p.departamentos || {}, c = p.condicion || {}, res = c.resolucion;
  return {
    descripcion: str(p.descripcion, 2000), prioridad: PRIO.includes(p.prioridad) ? p.prioridad : '',
    responsable: str(p.responsable, 120), colaboradores: str(p.colaboradores, 600), colaboracion: str(p.colaboracion, 1000),
    entrega: fecha(p.entrega), proximaAccion: str(p.proximaAccion, 600),
    departamentos: { relacion: REL.includes(d.relacion) ? d.relacion : 'por-confirmar', lista: d.relacion === 'con' ? deptos(d.lista) : [] },
    // Proyectos condicionados: la condición se resuelve con un registro (cómo, quién, cuándo); la ejecución solo se inicia después.
    condicion: { resolucion: res && str(res.nota, 1000) && str(res.quien, 120) ? { nota: str(res.nota, 1000), quien: str(res.quien, 120), fecha: fecha(res.fecha), registrada: str(res.registrada, 40) } : null },
    ejecucion: p.ejecucion && p.ejecucion.iniciada ? { iniciada: true, fecha: str(p.ejecucion.fecha, 40) } : { iniciada: false },
    sembrado: !!p.sembrado,   // ya recibió sus valores iniciales de datos.js (registro.inicial); no se vuelven a aplicar
    historial: hist(p.historial)
  };
}
export function normTarea(x, i = 0) {
  const b = x.bloqueo, c = x.cierre;
  return {
    id: str(x.id, 60), proyecto: str(x.proyecto, 60), titulo: str(x.titulo, 200), descripcion: str(x.descripcion, 2000), criterio: str(x.criterio, 1000),
    destacada: !!x.destacada, estado: COL.includes(x.estado) ? x.estado : 'todo', porConfirmar: !!x.porConfirmar,
    prioridad: PRIO.includes(x.prioridad) ? x.prioridad : '',
    responsable: str(x.responsable, 120), colaboradores: str(x.colaboradores, 600), fecha: fecha(x.fecha),
    subtareas: (Array.isArray(x.subtareas) ? x.subtareas : []).filter(s => s && str(s.texto, 300)).map((s, k) => ({ id: str(s.id, 40) || `s${k + 1}`, texto: str(s.texto, 300), hecha: !!s.hecha })).slice(0, 40),
    departamentos: deptos(x.departamentos),
    bloqueo: b && str(b.motivo, 800) ? { motivo: str(b.motivo, 800), necesita: str(b.necesita, 800) } : null,
    notas: str(x.notas, 4000), enlaces: (Array.isArray(x.enlaces) ? x.enlaces : []).filter(u => typeof u === 'string' && https(u)).slice(0, 20),
    evidencias: str(x.evidencias, 4000),
    cierre: c && c.criterioCumplido ? { nota: str(c.nota, 2000), criterioCumplido: true, fecha: str(c.fecha, 40) } : null,
    origen: str(x.origen, 200),
    orden: Number.isFinite(x.orden) ? x.orden : i,
    historial: hist(x.historial)
  };
}


/* Resultados de una investigación: se registran a medida que avanza (no hay resultados previos en las fuentes).
   La conclusión solo queda «aprobada» con quién la aprobó y cuándo. Las fuentes se conservan con su enlace y nota. */
const EST = ESTADOS_CONCLUSION.map(e => e.id);
export function normResultado(x = {}) {
  const a = x.aprobacion;
  const estado = EST.includes(x.estado) ? x.estado : 'sin';
  return {
    conclusion: str(x.conclusion, 4000), recomendacion: str(x.recomendacion, 2000), hallazgos: str(x.hallazgos, 6000),
    estado: estado === 'aprobada' && !(a && str(a.quien, 120)) ? 'borrador' : estado,
    aprobacion: estado === 'aprobada' && a && str(a.quien, 120) ? { quien: str(a.quien, 120), fecha: fecha(a.fecha) } : null,
    fuentes: (Array.isArray(x.fuentes) ? x.fuentes : []).filter(f => f && str(f.titulo, 300)).map((f, i) => ({
      id: str(f.id, 40) || `f${i + 1}`, titulo: str(f.titulo, 300), url: https(f.url) ? f.url.trim().slice(0, 1000) : '', tipo: str(f.tipo, 80), nota: str(f.nota, 2000), fecha: fecha(f.fecha) })).slice(0, 100),
    historial: hist(x.historial)
  };
}
/* Tareas iniciales de los proyectos habilitados: las actividades de la lista definitiva, en To do con «Estado por confirmar». */
function tareasIniciales() {
  const at = new Date().toISOString();
  return [...HABILITADOS].flatMap(pid => REGISTROS[pid].actividades.map((a, i) => normTarea({
    id: `${pid}-a${i + 1}`, proyecto: pid, titulo: a.texto.replace(/\.$/, ''), descripcion: a.descripcion || '', destacada: a.destacada, estado: 'todo', porConfirmar: true,
    origen: 'Lista definitiva de macroobjetivos', orden: i + 1,
    historial: [{ fecha: at, tipo: 'carga', nota: 'Actividad de la lista definitiva. Entra en To do con «Estado por confirmar»; sin responsable asignado.' }]
  }, i)));
}

export const almacen = {
  prefs() { const p = leer(K.prefs); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; },
  guardarPrefs(p) { return escribir(K.prefs, p); },
  proyectos() {
    const v = leer(K.proyectos), obj = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    const out = {}; let cambio = false;
    Object.keys(REGISTROS).forEach(id => {
      out[id] = normInicio(obj[id]);
      // Al habilitarse un proyecto, sus valores iniciales (solo los que da la lista) llenan campos vacíos una única vez.
      if (HABILITADOS.has(id) && !out[id].sembrado) {
        const ini = REGISTROS[id].inicial || {};
        ['prioridad', 'responsable', 'proximaAccion', 'descripcion'].forEach(k => { if (ini[k] && !out[id][k]) out[id][k] = ini[k]; });
        out[id].sembrado = true; cambio = true;
        out[id].historial.push({ fecha: new Date().toISOString(), tipo: 'carga', nota: `Proyecto habilitado con Inicio y Kanban.${ini.nota ? ` ${ini.nota}` : ''}` });
      }
    });
    if (cambio) escribir(K.proyectos, out);
    return out;
  },
  guardarProyectos(o) { return escribir(K.proyectos, o); },
  tareas() {
    const v = leer(K.tareas), lista = Array.isArray(v) ? v.map(normTarea).filter(x => x.id) : [];
    // Las tareas que el usuario eliminó no vuelven a cargarse desde la lista definitiva.
    const borradas = new Set(this.eliminadas().map(x => x.tarea.id));
    const faltan = tareasIniciales().filter(x => !lista.some(y => y.id === x.id) && !borradas.has(x.id));
    // Títulos condensados: si una tarea conserva el título largo original (nadie lo editó), pasa al título corto y el desglose va a la descripción.
    let condensadas = 0;
    tareasIniciales().forEach(ini => {
      const t = lista.find(y => y.id === ini.id), act = REGISTROS[ini.proyecto].actividades[ini.orden - 1];
      if (!t || !act || !act.antes || t.titulo !== act.antes) return;
      t.titulo = ini.titulo; if (!t.descripcion) t.descripcion = ini.descripcion; condensadas++;
    });
    if (faltan.length || condensadas || !Array.isArray(v)) { lista.push(...faltan); escribir(K.tareas, lista); }
    return lista;
  },
  // Tareas eliminadas: se apartan con su fecha (recuperables); la migración tampoco las recrea (solo actúa sobre tareas existentes).
  eliminadas() { const v = leer(K.eliminadas); return Array.isArray(v) ? v.filter(x => x && x.tarea && typeof x.tarea.id === 'string') : []; },
  guardarEliminadas(l) { return escribir(K.eliminadas, l); },
  guardarTareas(l) { return escribir(K.tareas, l); },
  resultados() {
    const v = leer(K.resultados), obj = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    return Object.fromEntries(Object.values(REGISTROS).filter(r => r.tipo === 'investigacion').map(r => [r.id, normResultado(obj[r.id])]));
  },
  guardarResultados(o) { return escribir(K.resultados, o); },
  origen() { const v = leer(K.origen); return Array.isArray(v) ? v : []; },
  guardarOrigen(l) { return escribir(K.origen, l); },
  migracion() { const v = leer(K.migracion); return v && typeof v === 'object' ? v : null; },
  guardarMigracion(v) { return escribir(K.migracion, v); },
  respaldo() { const v = leer(K.respaldo); return v && typeof v === 'object' ? v : null; },
  guardarRespaldo(v) { return escribir(K.respaldo, v); },
  // Instantánea de los datos locales (para el respaldo previo y para descargar).
  instantanea() { return { fecha: new Date().toISOString(), proyectos: leer(K.proyectos) || null, tareas: leer(K.tareas) || null, kanban: leer(K.kanban) || null, resultados: leer(K.resultados) || null }; },
  restaurar(s) { [['proyectos', K.proyectos], ['tareas', K.tareas], ['kanban', K.kanban], ['resultados', K.resultados]].forEach(([k, clave]) => { if (s[k] === null || s[k] === undefined) localStorage.removeItem(clave); else escribir(clave, s[k]); }); },
  // Kanban general: una tarjeta por macroobjetivo ({ [idMacro]: tarjeta }). Sin datos = se crea al abrir el tablero.
  kanban() { const v = leer(K.kanban); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; },
  guardarKanban(v) { return escribir(K.kanban, v); },
  restablecer() {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIJO)).forEach(k => localStorage.removeItem(k)); return true; } catch { return false; }
  },
  prefijo: PREFIJO
};
