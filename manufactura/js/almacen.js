/* Almacenamiento del prototipo. Claves EXCLUSIVAS con el prefijo «neotropya-prototipo-objetivos:v1:»;
   nunca se leen ni se escriben las del dashboard publicado («ccs-…»). Restablecer borra solo este prefijo.
   Proyectos y tareas: los datos iniciales se copian solo cuando aún no hay nada guardado. */
import { PROYECTOS_INICIALES, TAREAS_INICIALES, COLUMNAS, PRIORIDADES, DEPARTAMENTOS, RELACION_DEPTOS } from './datos-proyectos.js';

const PREFIJO = 'ccs-manufactura-v1:';   // datos del dashboard de Manufactura (proyectos, tareas, Kanban y preferencias)
const K = { prefs: PREFIJO + 'preferencias', proyectos: PREFIJO + 'proyectos', tareas: PREFIJO + 'tareas', kanban: PREFIJO + 'kanban-macroobjetivos' };

const leer = k => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const fecha = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const ids = (v, n = 20) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, n) : []);
const https = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const PRIO = PRIORIDADES.map(p => p.id), COL = COLUMNAS.map(c => c.id), DEP = DEPARTAMENTOS.map(d => d.id), REL = RELACION_DEPTOS.map(r => r.id);
const deptos = v => (Array.isArray(v) ? v : []).filter(d => d && DEP.includes(d.id)).map(d => ({ id: d.id, detalle: str(d.detalle, 600) }))
  .filter((d, i, a) => a.findIndex(x => x.id === d.id) === i);

export function normProyecto(p) {
  const d = p.departamentos || {};
  return {
    id: str(p.id, 60), slug: str(p.slug, 60), tipo: p.tipo === 'investigacion' ? 'investigacion' : 'proyecto',
    nombre: str(p.nombre, 200), descripcion: str(p.descripcion, 2000), resultado: str(p.resultado, 1000),
    entregable: str(p.entregable, 1000), condicion: str(p.condicion, 600), referencias: ids(p.referencias),
    macro: str(p.macro, 60), objetivos: ids(p.objetivos), investigaciones: ids(p.investigaciones),
    prioridad: PRIO.includes(p.prioridad) ? p.prioridad : '',
    departamentos: { relacion: REL.includes(d.relacion) ? d.relacion : 'por-confirmar', lista: d.relacion === 'con' ? deptos(d.lista) : [] },
    entrega: fecha(p.entrega)
  };
}
export function normTarea(x, i = 0) {
  const b = x.bloqueo, c = x.cierre;
  return {
    id: str(x.id, 60), proyecto: str(x.proyecto, 60), titulo: str(x.titulo, 200), descripcion: str(x.descripcion, 2000), criterio: str(x.criterio, 1000),
    destacada: !!x.destacada, estado: COL.includes(x.estado) ? x.estado : 'todo', prioridad: PRIO.includes(x.prioridad) ? x.prioridad : '',
    responsable: str(x.responsable, 120), fecha: fecha(x.fecha),
    subtareas: (Array.isArray(x.subtareas) ? x.subtareas : []).filter(s => s && str(s.texto, 300)).map((s, k) => ({ id: str(s.id, 40) || `s${k + 1}`, texto: str(s.texto, 300), hecha: !!s.hecha })).slice(0, 40),
    departamentos: deptos(x.departamentos),
    bloqueo: b && str(b.motivo, 800) ? { motivo: str(b.motivo, 800), necesita: str(b.necesita, 800) } : null,
    notas: str(x.notas, 4000), enlaces: (Array.isArray(x.enlaces) ? x.enlaces : []).filter(u => typeof u === 'string' && https(u)).slice(0, 20),
    evidencias: str(x.evidencias, 4000),
    cierre: c && c.criterioCumplido ? { nota: str(c.nota, 2000), criterioCumplido: true, fecha: str(c.fecha, 40) } : null,
    referencias: ids(x.referencias),
    orden: Number.isFinite(x.orden) ? x.orden : i,
    historial: (Array.isArray(x.historial) ? x.historial : []).filter(h => h && typeof h === 'object').map(h => ({ fecha: str(h.fecha, 40), tipo: str(h.tipo, 30), nota: str(h.nota, 1000) })).slice(-200)
  };
}

function cargarLista(clave, iniciales, norm, alSembrar) {
  const v = leer(clave);
  const nuevos = lista => alSembrar(lista.map((x, i) => norm(JSON.parse(JSON.stringify(x)), i)));
  if (Array.isArray(v)) {
    // Ya hay datos guardados: se conservan tal cual y solo se agregan los registros iniciales que falten (por id).
    const lista = v.map(norm).filter(x => x.id);
    const faltan = iniciales.filter(x => !lista.some(y => y.id === x.id));
    if (faltan.length) { lista.push(...nuevos(faltan)); escribir(clave, lista); }
    return lista;
  }
  // Sin datos guardados (o ilegibles): se cargan los iniciales.
  const lista = nuevos(iniciales);
  escribir(clave, lista);
  return lista;
}

export const almacen = {
  prefs() { const p = leer(K.prefs); return p && typeof p === 'object' ? p : {}; },
  guardarPrefs(p) { return escribir(K.prefs, p); },
  proyectos() { return cargarLista(K.proyectos, PROYECTOS_INICIALES, normProyecto, l => l); },
  guardarProyectos(l) { return escribir(K.proyectos, l); },
  tareas() {
    return cargarLista(K.tareas, TAREAS_INICIALES, normTarea, l => {
      const at = new Date().toISOString();
      l.forEach((x, i) => { x.orden = i + 1; x.historial = [{ fecha: at, tipo: 'carga', nota: `Tarea inicial en To do (sin estado de ejecución confirmado). ${x.criterio ? 'El criterio de cierre es una propuesta.' : 'Sin criterio de cierre definido.'}` }]; });
      return l;
    });
  },
  guardarTareas(l) { return escribir(K.tareas, l); },
  // Kanban general: una tarjeta por macroobjetivo ({ [idMacro]: tarjeta }). Sin datos = se crea al abrir el tablero.
  kanban() { const v = leer(K.kanban); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; },
  guardarKanban(v) { return escribir(K.kanban, v); },
  restablecer() {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIJO)).forEach(k => localStorage.removeItem(k)); return true; } catch { return false; }
  },
  prefijo: PREFIJO
};
