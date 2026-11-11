/* Estructura de macroobjetivos de los Kanban (Infraestructura y Neotropya).
   Macroobjetivo → objetivo específico → actividades (las tarjetas originales, que no se fusionan ni se borran).
   Cada tarjeta guarda su relación en «macro» y «objetivoEsp»; «clasificada» indica que ya pasó por la migración
   (o que la persona eligió su grupo), de modo que recargar o volver a desplegar no la reclasifica.
   Las reglas solo asocian tarjetas cuya relación es inequívoca (por su identificador); el resto queda «Por clasificar».
   El estado de un macroobjetivo se CALCULA a partir de sus actividades: es un resumen y nunca cambia los estados hijos. */

export const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/* ── Semanas (lunes a domingo) ── */
export function mondayOf(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const dm = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
export function weekLabel(monday) {
  const d = new Date(monday + 'T00:00:00Z'); if (isNaN(d)) return monday;
  const e = new Date(d); e.setUTCDate(e.getUTCDate() + 6);
  return `Semana del ${dm(d)} al ${dm(e)}/${e.getUTCFullYear()}`;
}
export const weekObjId = monday => 'semana-' + monday;
export const weekOfObj = id => (/^semana-(\d{4}-\d{2}-\d{2})$/.exec(id || '') || [])[1] || '';

/* ── Consolidación entre tableros ──
   «Estudiar / Investigar la sujeción moto-nodo» (Infraestructura, transversal) y «Investigar la sujeción nodo–moto»
   (Neotropya) son el mismo trabajo. La actividad canónica vive en Neotropya; la de Infraestructura se conserva con
   sus datos e historial, pero pasa a ser un enlace de solo lectura. */
export const CONSOLIDACIONES = [{
  origen: { board: 'infra-kanban', key: 'ccs-infra-kanban-v1', id: 'estudio-sujecion', nombre: 'Infraestructura' },
  destino: { board: 'neotropya-kanban', key: 'ccs-neotropya-kanban-v1', id: 'investigacion-sujecion-nodo-moto', nombre: 'Neotropya', ruta: '#/neotropya/kanban' }
}];

/* ── Infraestructura ── */
export const INFRA_ESTRUCTURA = {
  macros: [
    { id: 'activos', letra: 'A', titulo: 'Gestionar los activos y su mantenimiento',
      resultado: 'Activos identificados y documentados, con seguimiento de sus intervenciones.',
      objetivos: [
        { id: 'inventario', titulo: 'Inventariar y documentar activos' },
        { id: 'seguimiento-digital', titulo: 'Implementar su seguimiento digital' },
        { id: 'entregas-sistema', titulo: 'Registrar entregas y avances del sistema' }] },
    { id: 'espacios', letra: 'B', titulo: 'Organizar y equipar los espacios de trabajo',
      resultado: 'Almacenamiento y mobiliario adecuados para las operaciones del departamento.',
      objetivos: [
        { id: 'almacenaje', titulo: 'Organización y almacenaje del área de ensamblaje' },
        { id: 'mueble-volantes', titulo: 'Construcción e instalación del mueble de volantes' }] },
    { id: 'oficinas', letra: 'C', titulo: 'Acondicionar y conservar las oficinas',
      resultado: 'Intervenciones identificadas resueltas y su comprobación registrada.',
      objetivos: [
        { id: 'entradas-agua', titulo: 'Resolver las entradas de agua' },
        { id: 'aire-acondicionado', titulo: 'Completar la intervención del aire acondicionado y su cerramiento' },
        { id: 'tomacorrientes', titulo: 'Habilitar los tomacorrientes requeridos' }] },
    { id: 'puentes', letra: 'D', titulo: 'Recuperar la operatividad de puentes y elevadores',
      resultado: 'Puentes y elevadores funcionando, con la intervención de cada equipo probada y aceptada.',
      objetivos: [
        { id: 'diagnostico', titulo: 'Diagnóstico' },
        { id: 'repuestos', titulo: 'Repuestos y compras' },
        { id: 'coordinacion', titulo: 'Coordinación de intervención' },
        { id: 'reparacion', titulo: 'Reparación' },
        { id: 'pruebas', titulo: 'Pruebas y aceptación' }] },
    { id: 'formacion-reporte', letra: 'E', titulo: 'Completar la formación y el reporte semanal', transversal: true, semanal: true,
      resultado: 'Cada semana, horas de formación en IA cubiertas y avances reportados a Alberto.',
      objetivos: [] }
  ],
  // id de tarjeta → [macro, objetivo] («» = actividad principal del macroobjetivo, desglosada por fases)
  reglas: {
    'censo-activos': ['activos', 'inventario'],
    'dashboard-mantenimiento': ['activos', 'seguimiento-digital'],
    'ficha-fallas-mantenimiento': ['activos', 'seguimiento-digital'],
    'hito-dashboard': ['activos', 'entregas-sistema'],
    'hito-maquinas-diagnostico': ['activos', 'entregas-sistema'],
    'almacenaje-ensamblaje': ['espacios', 'almacenaje'],
    'mueble-volantes': ['espacios', 'mueble-volantes'],
    'hito-herrero': ['espacios', 'mueble-volantes'],
    'goteras': ['oficinas', 'entradas-agua'],
    'hito-ducto': ['oficinas', 'aire-acondicionado'],
    'tapa-drywall': ['oficinas', 'aire-acondicionado'],
    'presupuesto-tomacorrientes': ['oficinas', 'tomacorrientes'],
    'instalacion-tomacorrientes': ['oficinas', 'tomacorrientes'],
    'puentes-elevadores': ['puentes', '']
  },
  // Fase de cada subtarea de una actividad principal: [texto que contiene (sin tildes), objetivo]
  fases: {
    'puentes-elevadores': [['valvula', 'repuestos'], ['fallas por equipo', 'diagnostico'], ['presupuesto, proveedor', 'coordinacion'],
      ['rampas', 'diagnostico'], ['proxima intervencion', 'coordinacion'], ['escalar', 'coordinacion']]
  },
  // Subtareas que repiten un hito ya registrado como tarjeta: se marcan para no contarlas dos veces.
  equivalencias: { 'mueble-volantes': [['herrero', 'hito-herrero']] },
  // Tarjetas diarias de formación en IA y de reporte a Alberto: van a la semana de su fecha.
  semanal: { macro: 'formacion-reporte', ids: /^(ia|reporte)-(\d{4}-\d{2}-\d{2})$/, titulos: ['formacion en ia', 'reporte a alberto'] }
};

/* ── Neotropya ── */
export const NEO_ESTRUCTURA = {
  macros: [
    { id: 'acople', letra: 'A', titulo: 'Desarrollar el acople universal nodo–moto',
      resultado: 'Recomendación documentada de una sujeción nodo–moto compatible, con su plan de validación. Es una investigación: no hay un acople fabricado ni validado.',
      objetivos: [
        { id: 'mercado', titulo: 'Investigación del mercado y modelos' },
        { id: 'comerciales', titulo: 'Comparación de soluciones comerciales' },
        { id: 'maleta', titulo: 'Evaluación de adaptación a la maleta' },
        { id: 'validacion', titulo: 'Plan de validación' },
        { id: 'recomendacion', titulo: 'Resultados y recomendación' }] },
    { id: 'energia', letra: 'B', titulo: 'Gestionar la disponibilidad energética de los nodos',
      resultado: 'Baterías verificadas (modelo, capacidad, ubicación, responsable, instalación y disponibilidad) y reportadas a Alberto. Actualizar el reporte no resuelve una falla de alimentación.',
      objetivos: [{ id: 'reporte-baterias', titulo: 'Mantener verificado y reportado el inventario de baterías' }] },
    { id: 'nodos', letra: 'C', titulo: 'Ejecutar y recuperar los nodos', nodos: true,
      resultado: 'Cada nodo en curso ejecutado, actualizado o recuperado según su plan. El estado de los nodos se lee de la hoja de Nodos.',
      objetivos: [{ id: 'opp-26', titulo: 'Definir el plan de acción del nodo OPP 26' }] }
  ],
  reglas: {
    'investigacion-sujecion-nodo-moto': ['acople', ''],
    'comparar-acople-rapido': ['acople', 'comerciales'],
    'entrevistas-mecanicos-usuarios': ['acople', 'mercado'],
    'prueba-liberacion-rapida': ['acople', 'validacion'],
    'reporte-baterias': ['energia', 'reporte-baterias'],
    'plan-accion-opp-26': ['nodos', 'opp-26']
  },
  fases: {
    'investigacion-sujecion-nodo-moto': [['identificar modelos', 'mercado'], ['clasificar motos', 'mercado'], ['fotografias al catalogo', 'mercado'],
      ['excepciones', 'mercado'], ['primera revision del catalogo', 'mercado'], ['adaptadores', 'comerciales'], ['fabricacion propia', 'comerciales'],
      ['recomendacion', 'recomendacion']]
  },
  equivalencias: {},
  semanal: null
};

/* Regla de una tarjeta → [macro, objetivo] o null (Por clasificar). */
export function ruleFor(E, c) {
  if (!E) return null;
  const ids = [c.id, ...(c.alias || [])];
  for (const id of ids) if (E.reglas[id]) return E.reglas[id];
  const s = E.semanal;
  if (s) {
    const m = s.ids.exec(c.id);
    const t = fold(c.titulo);
    if (m || s.titulos.some(k => t.includes(k))) {
      const day = (m && m[2]) || c.fechas.reprogramada || c.fechas.original;
      const mon = mondayOf(day);
      return [s.macro, mon ? weekObjId(mon) : ''];
    }
  }
  return null;
}

/* Fases y equivalencias de las subtareas (solo rellena las vacías). Devuelve cuántas cambió. */
export function applySubtaskRules(E, c) {
  let n = 0;
  const fz = (E && E.fases[c.id]) || [], eq = (E && E.equivalencias[c.id]) || [];
  c.subtareas.forEach(s => {
    const t = fold(s.texto);
    if (!s.fase) { const f = fz.find(([k]) => t.includes(k)); if (f) { s.fase = f[1]; n++; } }
    if (!s.equivale) { const q = eq.find(([k]) => t.includes(k)); if (q) { s.equivale = q[1]; n++; } }
  });
  return n;
}

/* Estado agregado. acts: [{ estado: 'todo'|'doing'|'testing'|'blocked'|'done'|null (por confirmar), hito }]
   · Done: todas completadas.            · To do: ninguna empezada ni hitos completados.
   · Blocked: lo pendiente está bloqueado (no queda nada ejecutable).
   · Testing: la ejecución terminó y solo quedan verificaciones.   · Doing: el resto.
   «parcial» = hay bloqueos, pero también trabajo que puede continuar. */
export function aggregate(acts) {
  const dist = { todo: 0, doing: 0, testing: 0, blocked: 0, done: 0, confirmar: 0 };
  acts.forEach(a => { dist[a.estado && dist[a.estado] !== undefined ? a.estado : 'confirmar']++; });
  const total = acts.length, hechas = dist.done, pend = total - hechas;
  let estado;
  if (!total) estado = 'todo';
  else if (!pend) estado = 'done';
  else if (dist.todo === total) estado = 'todo';
  else if (dist.blocked === pend) estado = 'blocked';
  else if (dist.testing && dist.testing + dist.blocked === pend) estado = 'testing';
  else estado = 'doing';
  return { estado, dist, total, hechas, bloqueadas: dist.blocked, parcial: dist.blocked > 0 && estado !== 'blocked' };
}
