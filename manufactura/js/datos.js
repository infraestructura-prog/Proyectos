/* Datos iniciales del prototipo «Objetivos» de Manufactura (desarrollo e investigación de Neotropya).
   Todo es contenido local: no hay conexión con Google Sheets, los Kanban ni otras fuentes del sitio.
   Las relaciones usan identificadores estables (no los títulos), para poder renombrar sin romper vínculos:
     macroobjetivo.objetivos → ids de objetivos asociados
     objetivo.recursos        → { id de recurso: texto de la relación con ESE objetivo }
     recurrente.objetivos     → ids de objetivos (una tarea recurrente puede servir a varios)
   Proyectos e investigaciones: datos-proyectos.js (proyecto.objetivos → ids de objetivos).
   No se registran responsables, fechas, avances ni aprobaciones: no estaban definidos.
   Objetivos muestra macroobjetivos y objetivos asociados; cada objetivo enlaza con sus proyectos (proyecto.objetivos). */

/* La división se llama Manufactura; Neotropya aparece como su relación (subtítulo). */
export const DIVISION = { nombre: 'Manufactura', relacion: 'Desarrollo e investigación de Neotropya' };

export const SECCIONES = [
  { id: 'objetivos', titulo: 'Objetivos', activa: true },
  { id: 'proyectos', titulo: 'Proyectos', activa: true },
  { id: 'kanban', titulo: 'Kanban', activa: true },   // Kanban general: todas las tareas, por macroobjetivo
  { id: 'investigaciones', titulo: 'Investigaciones', activa: true },
  // Segunda etapa (resultados): separada de la primera con una línea en la sidebar.
  // «hijos»: módulos traídos del dashboard publicado; se muestran en modulo.html (ver assets/js/embebido.js).
  { id: 'nodos-venezuela', titulo: 'Nodos Venezuela', etapa: 2, activa: true,
    descripcion: 'Control de los nodos y de sus actividades, leído de Google Sheets.',
    hijos: [
      { id: 'control', titulo: 'Control de nodos', modulo: 'nodos-control', descripcion: 'Estado, especificaciones, pendientes y demoras de cada nodo (órdenes de fabricación).' },
      { id: 'actividades', titulo: 'Tablero de actividades', modulo: 'nodos-actividades', descripcion: 'Actividades pendientes de cada nodo, por estado o por responsable.' }] },
  { id: 'inventarios', titulo: 'Inventarios', etapa: 2, activa: true,
    descripcion: 'Consulta de existencias para el ensamblaje, leída de Google Sheets.',
    hijos: [{ id: 'consumibles', titulo: 'Consumibles', modulo: 'consumibles', descripcion: 'Disponibilidad de piezas, accesorios y materiales para el ensamblaje de nodos.' }] },
  { id: 'presupuestos', titulo: 'Presupuestos', etapa: 2, activa: true,
    descripcion: 'Productos que se necesitan comprar: comparar opciones y aprobar compras dentro de un presupuesto máximo.',
    hijos: [{ id: 'compra-equipos', titulo: 'Compra de equipos', modulo: 'compra-equipos', descripcion: 'Equipamiento del taller: opciones, precios y aprobación dentro del presupuesto.' }] },
  { id: 'documentacion', titulo: 'Documentación', etapa: 2 }
];

export const MACROOBJETIVOS = [
  { id: 'mo-gestion-manufactura', numero: '01', titulo: 'Organizar la gestión de Manufactura', corto: 'Gestión de Manufactura',
    proposito: 'Estructurar la relación entre los objetivos del área y el trabajo necesario para alcanzarlos.',
    resultado: 'Poder recorrer objetivos → proyectos → actividades y conocer su estado.',
    objetivos: ['ob-objetivos-dashboard', 'ob-arquitectura-panel'] },
  { id: 'mo-materiales-fabricacion', numero: '02', titulo: 'Controlar materiales y fabricación', corto: 'Materiales y fabricación',
    proposito: 'Disponer de información y condiciones de trabajo que permitan organizar los materiales y el ensamblaje.',
    resultado: 'Conocer qué se fabrica, qué materiales hay y dónde se utilizan.',
    objetivos: ['ob-inventario-central', 'ob-organizacion-ensamblaje'] },
  { id: 'mo-sujecion-moto-maleta', numero: '03', titulo: 'Desarrollar el sistema de sujeción moto–maleta', corto: 'Sujeción moto–maleta',
    proposito: 'Desarrollar y comprobar una solución de acople adaptable a diferentes motocicletas.',
    resultado: 'Disponer de una solución de montaje cuya compatibilidad y funcionamiento puedan demostrarse.',
    objetivos: ['ob-catalogo-parrillas', 'ob-alternativas-acople', 'ob-validacion-compatibilidad'] },
  { id: 'mo-termico-maletas', numero: '04', titulo: 'Optimizar el comportamiento térmico de las maletas', corto: 'Comportamiento térmico',
    proposito: 'Estudiar soluciones que permitan mejorar el desempeño térmico y su compatibilidad con la maleta.',
    resultado: 'Seleccionar mejoras térmicas compatibles con la maleta y respaldadas por evidencia.',
    objetivos: ['ob-comparacion-recubrimientos', 'ob-identificacion-material', 'ob-validacion-termica-quimica'] },
  { id: 'mo-capacidades-manufactura', numero: '05', titulo: 'Desarrollar capacidades de Manufactura', corto: 'Capacidades de Manufactura',
    proposito: 'Aplicar herramientas de IA al trabajo del área y documentar los resultados.',
    resultado: 'Convertir el aprendizaje en mejoras aplicadas al trabajo.',
    objetivos: ['ob-formacion-ia', 'ob-reporte-semanal'] }
];

/* «resultado»: en esta primera versión, la descripción proporcionada. «criterio»: null = no definido. */
export const OBJETIVOS = {
  'ob-objetivos-dashboard': { nombre: 'Objetivos y dashboard', descripcion: 'Relacionar objetivos, proyectos, investigaciones y tareas.',
    recursos: { 'rc-kanban': 'Las tareas que se relacionen con cada objetivo se seguirían en el Kanban de Neotropya.' } },
  'ob-arquitectura-panel': { nombre: 'Arquitectura del panel', descripcion: 'Definir navegación, fuentes de datos, permisos y seguimiento.',
    recursos: { 'rc-kanban': 'Es una de las fuentes de seguimiento que la arquitectura del panel debe ordenar.' } },
  'ob-inventario-central': { nombre: 'Inventario central', descripcion: 'Registrar existencias, entradas, salidas y transferencias.',
    recursos: {
      'rc-consumibles': 'Hoy solo permite consultar existencias de consumibles. Registrar entradas, salidas y transferencias es parte de este objetivo y aún no existe.',
      'rc-control-fabricacion': 'Las órdenes de fabricación indican qué se ensambla; sirven de referencia para saber qué materiales se necesitan.' } },
  'ob-organizacion-ensamblaje': { nombre: 'Organización del ensamblaje', descripcion: 'Completar almacenaje, gavetas y distribución del espacio de impresoras.',
    recursos: {
      'rc-control-fabricacion': 'Referencia del trabajo de ensamblaje que el espacio organizado debe facilitar.',
      'rc-presupuestos': 'Apoyo para comparar y aprobar compras de almacenaje o gavetas, si se requieren.' } },
  'ob-catalogo-parrillas': { nombre: 'Catálogo de parrillas', descripcion: 'Clasificar modelos, fotografías y excepciones.',
    recursos: { 'rc-acople': 'La investigación reúne los modelos de motos y sus sistemas de parrilla que alimentan el catálogo.' } },
  'ob-alternativas-acople': { nombre: 'Alternativas de acople', descripcion: 'Comparar sistemas de fijación y liberación rápida.',
    recursos: {
      'rc-acople': 'La investigación documenta las alternativas comerciales y de fabricación propia que se comparan aquí.',
      'rc-presupuestos': 'Apoyo para comparar opciones de compra si alguna alternativa la requiere.' } },
  'ob-validacion-compatibilidad': { nombre: 'Validación de compatibilidad', descripcion: 'Consultar mecánicos y usuarios y preparar pruebas físicas.',
    recursos: { 'rc-acople': 'Los límites de compatibilidad registrados en la investigación orientan las consultas y las pruebas.' } },
  'ob-comparacion-recubrimientos': { nombre: 'Comparación de recubrimientos', descripcion: 'Reunir alternativas, fotografías, costos y durabilidad.',
    recursos: {
      'rc-pinturas': 'La comparación de pinturas y recubrimientos reúne las alternativas que se evalúan aquí.',
      'rc-presupuestos': 'Apoyo para registrar costos y comparar compras de recubrimientos.' } },
  'ob-identificacion-material': { nombre: 'Identificación del material', descripcion: 'Confirmar el plástico de las maletas.',
    recursos: { 'rc-pinturas': 'Saber qué plástico es la maleta define qué recubrimientos de la comparación son compatibles.' } },
  'ob-validacion-termica-quimica': { nombre: 'Validación térmica y química', descripcion: 'Preparar pruebas de compatibilidad y desempeño.',
    recursos: { 'rc-pinturas': 'Las alternativas de la comparación son las candidatas a estas pruebas; ninguna está validada todavía.' } },
  'ob-formacion-ia': { nombre: 'Formación aplicada en IA', descripcion: 'Aprender y aplicar herramientas a los procesos del área.', recursos: {} },
  'ob-reporte-semanal': { nombre: 'Reporte semanal', descripcion: 'Documentar aprendizajes, resultados y bloqueos dentro de la misma actividad de formación.', recursos: {} }
};
Object.entries(OBJETIVOS).forEach(([id, o]) => Object.assign(o, { id, resultado: o.descripcion, criterio: null }));
MACROOBJETIVOS.forEach(m => m.objetivos.forEach(oid => { OBJETIVOS[oid].macro = m.id; }));

/* Herramientas y recursos existentes, y sus relaciones con los objetivos. NO se muestran en la página Objetivos
   (vista general); quedan como datos para las secciones futuras (Investigaciones, Inventarios, Presupuestos…). */
export const RECURSOS = {
  'rc-control-fabricacion': { nombre: 'Control de nodos', tipo: 'Módulo', ubicacion: 'Nodos Venezuela › Control de nodos', ruta: '#/nodos-venezuela/control',
    descripcion: 'Seguimiento de las órdenes de fabricación de los nodos.' },
  'rc-consumibles': { nombre: 'Inventario de consumibles', tipo: 'Inventario', ubicacion: 'Inventarios › Consumibles', ruta: '#/inventarios/consumibles',
    descripcion: 'Consulta de existencias de piezas, accesorios y materiales para el ensamblaje de nodos.' },
  'rc-acople': { nombre: 'Investigación del acople nodo–moto', tipo: 'Investigación', ubicacion: 'Neotropya › Nodos › Investigaciones',
    descripcion: 'Estudio de alternativas de sujeción entre la maleta y la moto. Es una investigación: no hay un acople fabricado ni validado.' },
  'rc-pinturas': { nombre: 'Comparación de pinturas y recubrimientos', tipo: 'Investigación', ubicacion: 'Neotropya › Nodos › Investigaciones',
    descripcion: 'Comparación de pinturas y recubrimientos para la maleta.' },
  'rc-kanban': { nombre: 'Kanban de Neotropya', tipo: 'Herramienta de seguimiento', ubicacion: 'Neotropya › Kanban',
    descripcion: 'Seguimiento de actividades por estado: To do, Doing, Testing, Blocked y Done.' },
  'rc-presupuestos': { nombre: 'Presupuestos · Compra de equipos', tipo: 'Presupuesto', ubicacion: 'Presupuestos › Compra de equipos', ruta: '#/presupuestos/compra-equipos',
    descripcion: 'Comparación de opciones y aprobación de compras dentro de un presupuesto máximo.' }
};
Object.entries(RECURSOS).forEach(([id, r]) => { r.id = id; });

/* Tareas recurrentes: trabajo continuo que no es un proyecto (no tiene fin ni Kanban propio).
   Se muestran dentro de su macroobjetivo. La formación y el reporte son UNA sola actividad semanal
   con varios componentes (sin tareas diarias ni rutinas separadas). «destacado» = especial énfasis. */
export const RECURRENTES = [
  { id: 're-control-fabricacion', macro: 'mo-materiales-fabricacion', objetivos: [],
    titulo: 'Mantener el control de fabricación',
    descripcion: 'Actualizar órdenes, materiales requeridos, responsables, bloqueos y resultados de pruebas.',
    resultado: 'Cada orden refleja su situación real y su siguiente acción.', componentes: [],
    ruta: '#/nodos-venezuela/control', rutaTexto: 'Nodos Venezuela › Control de nodos' },
  { id: 're-formacion-ia', macro: 'mo-capacidades-manufactura', objetivos: ['ob-formacion-ia', 'ob-reporte-semanal'],
    titulo: 'Formación aplicada y reporte semanal de IA', descripcion: '', resultado: '',
    componentes: [
      { texto: 'Definir el problema de aprendizaje: elegir una necesidad concreta del departamento.' },
      { texto: 'Estudiar y practicar: aplicar herramientas al problema seleccionado.' },
      { texto: 'Documentar resultados: conservar aprendizajes, evidencias y limitaciones.' },
      { texto: 'Compartir avances: preparar el reporte semanal y participar en la revisión del podcast.', destacado: true }] }
];
