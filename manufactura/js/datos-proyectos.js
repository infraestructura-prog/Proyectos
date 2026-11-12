/* Proyectos y tareas: datos INICIALES del prototipo. Se copian al almacenamiento del prototipo solo la primera vez
   (o tras «Restablecer prototipo»); después manda lo guardado.
   Relaciones por identificador:
     proyecto.macro          → macroobjetivo al que contribuye
     proyecto.objetivos      → objetivos asociados (un proyecto puede servir a varios; un objetivo puede tener varios proyectos)
     proyecto.investigaciones→ investigaciones incluidas (preparado; la sección Investigaciones aún no tiene interfaz)
     tarea.proyecto          → proyecto dueño de la tarea (un único registro por tarea)
   Ningún estado, responsable, fecha ni relación con departamentos se da por supuesto. */

export const COLUMNAS = [
  { id: 'todo', titulo: 'To do', ayuda: 'Pendiente de iniciar.' },
  { id: 'doing', titulo: 'Doing', ayuda: 'En ejecución.' },
  { id: 'blocked', titulo: 'Blocked', ayuda: 'Detenida por una dependencia identificada.' },
  { id: 'testing', titulo: 'Testing', ayuda: 'Pendiente de revisión o prueba.' },
  { id: 'completed', titulo: 'Completed', ayuda: 'Terminada y verificada.' }
];
export const PRIORIDADES = [{ id: '', titulo: 'Por definir' }, { id: 'alta', titulo: 'Alta' }, { id: 'media', titulo: 'Media' }, { id: 'baja', titulo: 'Baja' }];
export const DEPARTAMENTOS = [
  { id: 'electrica', titulo: 'Eléctrica' }, { id: 'electronica', titulo: 'Electrónica' },
  { id: 'mecanica', titulo: 'Mecánica' }, { id: 'infraestructura', titulo: 'Infraestructura' }
];
// Relación del proyecto con otros departamentos: por confirmar / sin relación / con relación (y cuáles).
export const RELACION_DEPTOS = [
  { id: 'por-confirmar', titulo: 'Por confirmar' },
  { id: 'sin', titulo: 'Sin relación interdepartamental' },
  { id: 'con', titulo: 'Con relación interdepartamental' }
];

/* Proyectos e investigaciones (mismo registro; «tipo» los distingue).
   · proyecto: tiene Inicio y Kanban.   · investigacion: tiene Inicio con su lista de tareas, sin Kanban.
   · condicion: proyecto condicionado (se planifica cuando se cumpla la condición; sus tareas aún no se ejecutan).
   · entregable / resultado: solo los indicados en el planteamiento; vacío = no definido. */
const base = { descripcion: '', resultado: '', entregable: '', condicion: '', investigaciones: [], referencias: [], prioridad: '',
  departamentos: { relacion: 'por-confirmar', lista: [] }, entrega: '' };
export const PROYECTOS_INICIALES = [
  { ...base, id: 'pr-reorganizacion-dashboard', slug: 'reorganizacion-dashboard', tipo: 'proyecto',
    nombre: 'Reorganización del dashboard de Neotropya',
    descripcion: 'Reorganizar el dashboard de Neotropya mediante una navegación jerárquica que conecte macroobjetivos, objetivos asociados, proyectos, investigaciones y tareas, conservando el acceso a las herramientas existentes.',
    resultado: 'Poder recorrer objetivos → proyectos → actividades y conocer su estado.',
    macro: 'mo-gestion-manufactura', objetivos: ['ob-objetivos-dashboard', 'ob-arquitectura-panel'] },
  // 02 · Controlar materiales y fabricación
  { ...base, id: 'pr-inventario-central', slug: 'inventario-central-trazabilidad', tipo: 'proyecto', nombre: 'Inventario central y trazabilidad',
    entregable: 'Inventario consultable con movimientos e historial verificables.',
    macro: 'mo-materiales-fabricacion', objetivos: ['ob-inventario-central'], referencias: ['rc-consumibles', 'rc-control-fabricacion'] },
  { ...base, id: 'pr-organizacion-ensamblaje', slug: 'organizacion-area-ensamblaje', tipo: 'proyecto', nombre: 'Organización del área de ensamblaje',
    entregable: 'Área organizada con ubicaciones definidas.',
    macro: 'mo-materiales-fabricacion', objetivos: ['ob-organizacion-ensamblaje'], referencias: ['rc-presupuestos'] },
  // 03 · Sujeción moto–maleta
  { ...base, id: 'in-compatibilidad-parrillas', slug: 'compatibilidad-motos-parrillas', tipo: 'investigacion', nombre: 'Compatibilidad entre motos y parrillas',
    macro: 'mo-sujecion-moto-maleta', objetivos: ['ob-catalogo-parrillas', 'ob-validacion-compatibilidad'], referencias: ['rc-acople'] },
  { ...base, id: 'in-alternativas-acople', slug: 'alternativas-acople-liberacion', tipo: 'investigacion', nombre: 'Alternativas de acople y liberación rápida',
    macro: 'mo-sujecion-moto-maleta', objetivos: ['ob-alternativas-acople'], referencias: ['rc-acople', 'rc-presupuestos'] },
  { ...base, id: 'pr-prototipo-sujecion', slug: 'prototipo-validacion-sujecion', tipo: 'proyecto', nombre: 'Prototipo y validación de la sujeción',
    condicion: 'Se planifica cuando exista una alternativa seleccionada.',
    macro: 'mo-sujecion-moto-maleta', objetivos: ['ob-validacion-compatibilidad'], investigaciones: ['in-compatibilidad-parrillas', 'in-alternativas-acople'] },
  // 04 · Comportamiento térmico
  { ...base, id: 'in-material-condiciones', slug: 'material-condiciones-uso', tipo: 'investigacion', nombre: 'Material y condiciones de uso',
    macro: 'mo-termico-maletas', objetivos: ['ob-identificacion-material', 'ob-validacion-termica-quimica'] },
  { ...base, id: 'in-pinturas-recubrimientos', slug: 'pinturas-vinilos-recubrimientos', tipo: 'investigacion', nombre: 'Pinturas, vinilos y recubrimientos',
    macro: 'mo-termico-maletas', objetivos: ['ob-comparacion-recubrimientos'], referencias: ['rc-pinturas', 'rc-presupuestos'] },
  { ...base, id: 'pr-validacion-termica', slug: 'validacion-termica-quimica', tipo: 'proyecto', nombre: 'Validación térmica y química',
    condicion: 'Se planifica después de identificar el material y preseleccionar alternativas.',
    macro: 'mo-termico-maletas', objetivos: ['ob-validacion-termica-quimica'], investigaciones: ['in-material-condiciones', 'in-pinturas-recubrimientos'] }
];

const t = (id, titulo, descripcion, criterio, destacada, extra = {}, proyecto = 'pr-reorganizacion-dashboard') => ({
  id, proyecto, titulo, descripcion, criterio, destacada,
  estado: 'todo', prioridad: '', responsable: '', fecha: '', subtareas: [], departamentos: [],
  bloqueo: null, notas: '', enlaces: [], evidencias: '', cierre: null, referencias: [], ...extra
});
// Tareas sin criterio de cierre indicado: quedan sin criterio («Sin definir»), no se inventa uno.
const de = (proyecto, filas) => filas.map(([id, titulo, descripcion = '', destacada = false]) => t(id, titulo, descripcion, '', destacada, {}, proyecto));
const TAREAS_CATALOGO = [
  ...de('pr-inventario-central', [
    ['tk-inv-catalogo', 'Definir el catálogo', 'Acordar identificación, categorías y datos de materiales y componentes.'],
    ['tk-inv-existencias', 'Conciliar existencias', 'Comparar los registros con las cantidades y ubicaciones reales.'],
    ['tk-inv-movimientos', 'Definir los movimientos', 'Registrar entradas, salidas, devoluciones y transferencias.'],
    ['tk-inv-responsables', 'Identificar responsables', 'Registrar quién entrega, recibe o conserva cada recurso.'],
    ['tk-inv-trazabilidad', 'Validar la trazabilidad', 'Seguir un material desde su entrada hasta su utilización o transferencia.']]),
  ...de('pr-organizacion-ensamblaje', [
    ['tk-org-necesidades', 'Levantar necesidades de espacio', 'Identificar materiales, herramientas y equipos que requieren ubicación.'],
    ['tk-org-almacenaje', 'Definir almacenaje y distribución', 'Organizar gavetas, soluciones de pared y espacio de impresoras.'],
    ['tk-org-presupuestos', 'Comparar soluciones y presupuestos', 'Evaluar alternativas antes de aprobar compras o fabricación.'],
    ['tk-org-materializar', 'Materializar y verificar la organización', 'Ejecutar lo aprobado y comprobar que facilita el trabajo.']]),
  ...de('in-compatibilidad-parrillas', [
    ['tk-cmp-clasificar', 'Clasificar modelos y parrillas', 'Separar configuraciones convencionales y casos especiales.'],
    ['tk-cmp-catalogo', 'Preparar el catálogo visual', 'Incorporar fotografías, características y excepciones KLR.', true],
    ['tk-cmp-consultar', 'Consultar mecánicos y usuarios', 'Recoger información sobre instalaciones y dificultades reales.'],
    ['tk-cmp-vacios', 'Identificar vacíos de información', 'Distinguir compatibilidad anunciada de compatibilidad comprobada.']]),
  ...de('in-alternativas-acople', [
    ['tk-alt-referencias', 'Reunir soluciones de referencia', 'Comparar bases comerciales y alternativas de fabricación.'],
    ['tk-alt-adaptacion', 'Evaluar adaptación a la maleta actual', 'Identificar modificaciones, restricciones y costos disponibles.'],
    ['tk-alt-proponer', 'Proponer alternativas para probar', 'Justificar cuáles conviene validar y por qué.']]),
  ...de('pr-prototipo-sujecion', [
    ['tk-pro-requisitos', 'Definir requisitos y criterios de aceptación'],
    ['tk-pro-prototipo', 'Preparar el prototipo autorizado'],
    ['tk-pro-pruebas', 'Ejecutar pruebas de montaje y funcionamiento'],
    ['tk-pro-resultados', 'Registrar resultados, limitaciones y ajustes']]),
  ...de('in-material-condiciones', [
    ['tk-mat-plastico', 'Identificar el plástico exacto', 'Buscar identificación del fabricante o evidencia técnica.'],
    ['tk-mat-condiciones', 'Definir las condiciones de evaluación', 'Establecer exposición, uso y variables que interesa medir.'],
    ['tk-mat-compatibilidad', 'Investigar compatibilidad', 'Revisar adhesión, reacción química y comportamiento térmico.']]),
  ...de('in-pinturas-recubrimientos', [
    ['tk-pin-clasificar', 'Clasificar alternativas', 'Separar productos base, variantes y aditivos.'],
    ['tk-pin-comparativa', 'Preparar la comparativa visual', 'Mostrar fotografías, precio, acabado y durabilidad.', true],
    ['tk-pin-propiedades', 'Comparar propiedades disponibles', 'Registrar datos térmicos y sus fuentes, señalando los desconocidos.'],
    ['tk-pin-candidatos', 'Seleccionar candidatos para ensayo', 'Justificar la preselección según compatibilidad y desempeño esperado.']]),
  ...de('pr-validacion-termica', [
    ['tk-val-protocolo', 'Diseñar el protocolo de ensayo'],
    ['tk-val-muestras', 'Preparar muestras y referencia de comparación'],
    ['tk-val-medir', 'Medir resultados bajo condiciones comparables'],
    ['tk-val-evaluar', 'Evaluar compatibilidad, desempeño y durabilidad']])
];

const TAREAS_DASHBOARD = [
  t('tk-estructura-objetivos', 'Definir la estructura de objetivos', 'Relacionar cada actividad existente con el objetivo al que contribuye.',
    'La estructura identifica macroobjetivos, objetivos asociados y sus actividades, con las relaciones registradas y sin duplicaciones.', true),
  t('tk-disenar-sidebar', 'Diseñar el sidebar', 'Organizar navegación, niveles desplegables y acceso a los módulos.',
    'Se puede recorrer Objetivos → Proyecto → Inicio/Kanban y regresar conservando la ubicación.', true),
  t('tk-arquitectura-informacion', 'Definir la arquitectura de información', 'Establecer cómo se relacionan objetivos, proyectos, investigaciones, tareas y evidencias.',
    'Las entidades y sus relaciones están documentadas y representadas en el modelo de datos.', true),
  t('tk-preparar-demostracion', 'Preparar la demostración', 'Mostrar la propuesta de navegación y su aplicación en el dashboard.',
    'Existe un recorrido local funcional que permite demostrar la jerarquía y el seguimiento del proyecto.', true),
  t('tk-integrar-vistas', 'Integrar las vistas existentes', 'Conectar fabricación, inventario, investigaciones, Kanban y presupuestos sin duplicar registros.',
    'Los puntos de integración y sus fuentes quedan identificados y pueden demostrarse mediante referencias locales.', false, {
      notas: 'En esta fase se utilizan fichas o accesos de referencia dentro del prototipo. La integración real con producción queda para una etapa posterior: haber creado estos accesos no la convierte en realizada.',
      referencias: ['rc-control-fabricacion', 'rc-consumibles', 'rc-acople', 'rc-pinturas', 'rc-kanban', 'rc-presupuestos'] }),
  t('tk-verificar-funcionamiento', 'Verificar funcionamiento', 'Comprobar imágenes, enlaces, filtros y navegación.',
    'El recorrido local funciona en escritorio y móvil, sin enlaces rotos ni fallos en las interacciones implementadas.', false)
];

export const TAREAS_INICIALES = [...TAREAS_DASHBOARD, ...TAREAS_CATALOGO];
