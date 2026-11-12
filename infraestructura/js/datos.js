/* Datos iniciales del prototipo de Infraestructura (Etapa 2: estructura y Objetivos).
   Fuente: la «Lista definitiva de macroobjetivos» del encargo. Nombres, separaciones y actividades se copian sin cambios.
   Cascada: macroobjetivo → registro (proyecto, investigación, tarea directa o proyecto condicionado) → actividades.
   No hay objetivos asociados: ningún macroobjetivo los necesita (tiene a lo sumo dos registros).
   No se registran responsables, fechas, prioridades ni estados que la lista no indique:
     · actividades nuevas = To do con «Estado por confirmar» (se cargan en la Etapa 3);
     · las personas mencionadas en una actividad son colaboradores, nunca responsables.
   Cada registro existe una sola vez; las relaciones usan ids estables (registro.relaciones). */

export const AREA = { nombre: 'Infraestructura', relacion: 'Taller, maquinaria y oficinas' };

/* Sidebar. «etapa»: en qué etapa de trabajo se habilita una sección pendiente (se muestra como tal).
   «bloque: 2» = segunda etapa (resultados), separada por una línea. «admin»: sección administrativa. */
export const SECCIONES = [
  { id: 'objetivos', titulo: 'Objetivos', activa: true },
  { id: 'proyectos', titulo: 'Proyectos', activa: true },
  { id: 'investigaciones', titulo: 'Investigaciones', activa: true },
  { id: 'kanban', titulo: 'Kanban', activa: true },   // Kanban general: una tarjeta por macroobjetivo
  { id: 'maquinas', titulo: 'Máquinas de simulación', bloque: 2, activa: true, modulo: 'maquinas',
    descripcion: 'Máquinas vendidas y en stock, leídas de Google Sheets. Copia del módulo publicado en solo lectura.' },
  { id: 'documentacion', titulo: 'Documentación', bloque: 2 },
  { id: 'pendientes', titulo: 'Pendientes de clasificación', admin: true, activa: true }
];

export const TIPOS = {
  proyecto: 'Proyecto',
  investigacion: 'Investigación',
  'tarea-directa': 'Tarea directa',
  condicionado: 'Proyecto condicionado'
};

export const MACROOBJETIVOS = [
  { id: 'mi-taller', numero: '01', titulo: 'Mejorar el taller', corto: 'Taller', registros: ['pi-canales'] },
  { id: 'mi-termico-techo', numero: '02', titulo: 'Mejorar el comportamiento térmico del techo', corto: 'Térmico del techo',
    registros: ['ii-alternativas-termicas', 'pc-mejora-termica'],
    notas: ['Se mantiene separado de «Solucionar las goteras».'] },
  { id: 'mi-goteras', numero: '03', titulo: 'Solucionar las goteras', corto: 'Goteras',
    registros: ['ii-causas-goteras', 'pc-correccion-filtraciones'],
    notas: ['Se mantiene separado de «Mejorar el comportamiento térmico del techo».'] },
  { id: 'mi-almacen', numero: '04', titulo: 'Mejorar el almacén', corto: 'Almacén', registros: ['pi-mueble-alfombras'] },
  { id: 'mi-activos', numero: '05', titulo: 'Centralizar la información técnica y el mantenimiento de los activos', corto: 'Información técnica de activos',
    registros: ['pi-censo', 'pi-fichas-mantenimiento'],
    notas: ['El censo identifica cada activo y la ficha conserva su historial.'] },
  { id: 'mi-puentes', numero: '06', titulo: 'Resolver los pendientes de puentes y elevadores', corto: 'Puentes y elevadores',
    prioridad: 'critica', registros: ['pi-reparaciones-puentes'],
    notas: ['El cambio de válvulas es un hecho realizado; documentarlo es una tarea distinta que puede seguir pendiente.',
      'La llegada de las válvulas no es un bloqueo vigente. Una intervención terminada no cierra los demás pendientes de puentes.'] },
  { id: 'mi-predictivo', numero: '07', titulo: 'Desarrollar el mantenimiento predictivo', corto: 'Mantenimiento predictivo',
    registros: ['ii-instrumentacion', 'pc-piloto-predictivo'] },
  { id: 'mi-maquinas', numero: '08', titulo: 'Gestionar el inventario y la postventa de máquinas de simulación', corto: 'Máquinas de simulación',
    registros: ['pi-inventario-maquinas', 'pi-postventa'],
    notas: ['Inventario y postventa se enlazan con el mismo identificador de activo del censo y del historial técnico, sin copias independientes del mismo equipo.'] },
  { id: 'mi-gestion', numero: '09', titulo: 'Organizar la gestión de Infraestructura', corto: 'Gestión de Infraestructura', registros: ['pi-dashboard'] }
];

/* tipo: proyecto | investigacion | tarea-directa | condicionado.  condicion: texto de la condición de inicio (solo condicionados).
   actividades: [texto, destacada]. relaciones: [{ id, texto }] (el vínculo se muestra en ambos registros). */
const a = (texto, destacada = false) => ({ texto, destacada });
export const REGISTROS = {
  'pi-canales': { tipo: 'proyecto', slug: 'reparacion-canales', nombre: 'Reparación de las canales', macro: 'mi-taller',
    actividades: [a('Recibir y revisar el presupuesto del herrero.'), a('Obtener aprobación y coordinar la reparación.'), a('Verificar y documentar el resultado.')] },

  'ii-alternativas-termicas': { tipo: 'investigacion', slug: 'diagnostico-alternativas-termicas', nombre: 'Diagnóstico y alternativas térmicas', macro: 'mi-termico-techo',
    actividades: [a('Levantar medidas y superficies.', true), a('Comparar recubrimientos, costos y compatibilidad.', true), a('Preparar el protocolo de medición con Giovanni.', true)] },
  'pc-mejora-termica': { tipo: 'condicionado', slug: 'aplicacion-validacion-mejora-termica', nombre: 'Aplicación y validación de la mejora', macro: 'mi-termico-techo',
    condicion: 'Contar con una alternativa seleccionada y la aprobación correspondiente antes de ejecutarla.',
    relaciones: [{ id: 'ii-alternativas-termicas', texto: 'Depende de la alternativa seleccionada en la investigación.' }],
    actividades: [a('Definir alcance y presupuesto de la alternativa seleccionada.'), a('Coordinar una aplicación de prueba, previa aprobación.'), a('Medir resultados y recomendar continuar, ajustar o descartar.')] },

  'ii-causas-goteras': { tipo: 'investigacion', slug: 'identificacion-causas-goteras', nombre: 'Identificación de las causas', macro: 'mi-goteras',
    actividades: [a('Documentar los puntos afectados.'), a('Revisar causas y responsabilidades con Giovanni y los involucrados.'), a('Definir la intervención necesaria.')] },
  'pc-correccion-filtraciones': { tipo: 'condicionado', slug: 'correccion-filtraciones', nombre: 'Corrección de filtraciones', macro: 'mi-goteras',
    condicion: 'Definir la intervención y obtener su aprobación.',
    relaciones: [{ id: 'ii-causas-goteras', texto: 'Depende de la intervención definida en la investigación.' }],
    actividades: [a('Obtener alcance, presupuesto y aprobación.'), a('Coordinar la reparación.'), a('Comprobar el resultado.')] },

  'pi-mueble-alfombras': { tipo: 'proyecto', slug: 'mueble-alfombras', nombre: 'Mueble de alfombras', macro: 'mi-almacen',
    actividades: [a('Confirmar ubicación y capacidad requerida.'), a('Evaluar los planos y obtener presupuesto.'), a('Presentar para aprobación.'), a('Coordinar fabricación e instalación si se autoriza.')] },

  'pi-censo': { tipo: 'proyecto', slug: 'censo-documentacion-tecnica', nombre: 'Censo y documentación técnica', macro: 'mi-activos',
    relaciones: [{ id: 'pi-fichas-mantenimiento', texto: 'El censo identifica cada activo; la ficha conserva su historial.' },
      { id: 'pi-inventario-maquinas', texto: 'Mismo identificador de activo.' }, { id: 'pi-postventa', texto: 'Mismo identificador de activo.' }],
    actividades: [a('Identificar equipos, componentes y ubicación.', true), a('Registrar modelo, serial, condición y fotografías.'), a('Reunir manuales y despieces.'), a('Validar nomenclatura e identificar documentación faltante.')] },
  'pi-fichas-mantenimiento': { tipo: 'proyecto', slug: 'fichas-historial-mantenimiento', nombre: 'Fichas e historial de mantenimiento', macro: 'mi-activos',
    relaciones: [{ id: 'pi-censo', texto: 'La ficha conserva el historial del activo identificado en el censo.' },
      { id: 'pi-inventario-maquinas', texto: 'Mismo identificador de activo.' }, { id: 'pi-postventa', texto: 'Mismo identificador de activo.' }],
    actividades: [a('Definir la ficha de mantenimiento con Fabricio.', true), a('Registrar fallas, inspecciones e intervenciones.'), a('Vincular repuestos, costos y resultados.'), a('Definir próximas acciones por activo.')] },

  'pi-reparaciones-puentes': { tipo: 'proyecto', slug: 'seguimiento-operativo-reparaciones', nombre: 'Seguimiento operativo de reparaciones', macro: 'mi-puentes',
    inicial: { prioridad: 'critica', nota: 'Prioridad crítica según la lista definitiva.' },
    actividades: [a('Documentar el resultado del cambio de válvulas ya realizado.'), a('Recuperar con Fabricio el contexto de rampas y herrero.'), a('Confirmar presupuestos, repuestos y técnico.'), a('Acordar próximas intervenciones y registrar bloqueos.'), a('Escalar a Alberto las decisiones necesarias.')] },

  'ii-instrumentacion': { tipo: 'investigacion', slug: 'instrumentacion-monitoreo-maquinaria', nombre: 'Instrumentación y monitoreo de maquinaria', macro: 'mi-predictivo',
    actividades: [a('Definir qué condiciones se necesitan monitorear.'), a('Revisar avances con Fabricio, Giovanni y Víctor.'), a('Comparar alternativas de instrumentación y datos.'), a('Proponer un piloto y acordar responsabilidades.')] },
  'pc-piloto-predictivo': { tipo: 'condicionado', slug: 'piloto-mantenimiento-predictivo', nombre: 'Piloto de mantenimiento predictivo', macro: 'mi-predictivo',
    condicion: 'Se planifica después de definir y aprobar el alcance de la investigación.',
    sinActividades: 'Sin actividades técnicas hasta que se concrete el alcance.',
    relaciones: [{ id: 'ii-instrumentacion', texto: 'Su alcance sale de la investigación.' }],
    actividades: [] },

  'pi-inventario-maquinas': { tipo: 'proyecto', slug: 'inventario-maquinas', nombre: 'Mejorar el inventario de máquinas', macro: 'mi-maquinas',
    relaciones: [{ id: 'pi-postventa', texto: 'Mismo identificador de activo.' }, { id: 'pi-censo', texto: 'Mismo identificador de activo.' }, { id: 'pi-fichas-mantenimiento', texto: 'Mismo identificador de activo.' }],
    actividades: [a('Conciliar kits, componentes y repuestos con Gerardo.', true), a('Diferenciar equipos en stock, en funcionamiento y vendidos.'), a('Registrar cantidades, ubicación y movimientos.'), a('Relacionar cada kit con sus componentes sin doble contabilización.')] },
  'pi-postventa': { tipo: 'proyecto', slug: 'historico-ventas-postventa', nombre: 'Histórico de ventas y seguimiento postventa', macro: 'mi-maquinas',
    relaciones: [{ id: 'pi-inventario-maquinas', texto: 'Mismo identificador de activo.' }, { id: 'pi-censo', texto: 'Mismo identificador de activo.' }, { id: 'pi-fichas-mantenimiento', texto: 'Mismo identificador de activo.' }],
    actividades: [a('Recuperar y cargar clientes, talleres y equipos vendidos.', true), a('Relacionar cada venta con el equipo correspondiente.'), a('Registrar ubicación, comentarios e intervenciones posteriores.'), a('Identificar información faltante.')] },

  'pi-dashboard': { tipo: 'proyecto', slug: 'reorganizacion-dashboard', nombre: 'Reorganización del dashboard', macro: 'mi-gestion',
    actividades: [a('Estructurar esta cascada de objetivos y proyectos.', true), a('Diseñar el sidebar y presentar la arquitectura.', true), a('Integrar Seguimiento, calendario, Kanban y filtros.'), a('Definir fuentes de datos, accesos y responsables técnicos.'), a('Preparar la demostración y coordinar apoyo.', true)] }
};
Object.entries(REGISTROS).forEach(([id, r]) => { r.id = id; r.relaciones = r.relaciones || []; });

/* ── Etapa 3: proyectos con Inicio y Kanban, en bloques pequeños ──
   Solo los registros de BLOQUES_ETAPA3 tienen Inicio y Kanban; los demás conservan su ficha preliminar. */
export const BLOQUES_ETAPA3 = [
  { id: 'bloque-1', titulo: 'Proyecto ordinario y proyecto condicionado', registros: ['pi-canales', 'pc-mejora-termica'] },
  { id: 'bloque-2', titulo: 'Goteras, almacén y puentes', registros: ['pc-correccion-filtraciones', 'pi-mueble-alfombras', 'pi-reparaciones-puentes'] },
  { id: 'bloque-3', titulo: 'Activos, mantenimiento predictivo, máquinas y gestión', registros: ['pi-censo', 'pi-fichas-mantenimiento', 'pc-piloto-predictivo', 'pi-inventario-maquinas', 'pi-postventa', 'pi-dashboard'] }
];
/* Etapa 4: las investigaciones tienen Inicio (con su lista de tareas, sin Kanban) y Resultados. */
export const INVESTIGACIONES_ETAPA4 = ['ii-alternativas-termicas', 'ii-causas-goteras', 'ii-instrumentacion'];
export const HABILITADOS = new Set([...BLOQUES_ETAPA3.flatMap(b => b.registros), ...INVESTIGACIONES_ETAPA4]);
/* Estados de la conclusión de una investigación (Resultados). */
export const ESTADOS_CONCLUSION = [
  { id: 'sin', titulo: 'Sin conclusión' }, { id: 'borrador', titulo: 'Conclusión en borrador' }, { id: 'aprobada', titulo: 'Conclusión aprobada' }
];

export const COLUMNAS = [
  { id: 'todo', titulo: 'To do', ayuda: 'Pendiente de iniciar.' },
  { id: 'doing', titulo: 'Doing', ayuda: 'En ejecución.' },
  { id: 'blocked', titulo: 'Blocked', ayuda: 'Detenida por una dependencia identificada.' },
  { id: 'testing', titulo: 'Testing', ayuda: 'Pendiente de revisión o prueba.' },
  { id: 'completed', titulo: 'Completed', ayuda: 'Terminada y verificada.' }
];
export const PRIORIDADES = [{ id: '', titulo: 'Por definir' }, { id: 'critica', titulo: 'Crítica' }, { id: 'alta', titulo: 'Alta' }, { id: 'media', titulo: 'Media' }, { id: 'baja', titulo: 'Baja' }];
export const DEPARTAMENTOS = [
  { id: 'electrica', titulo: 'Eléctrica' }, { id: 'electronica', titulo: 'Electrónica' },
  { id: 'mecanica', titulo: 'Mecánica' }, { id: 'manufactura', titulo: 'Manufactura' }
];
export const RELACION_DEPTOS = [
  { id: 'por-confirmar', titulo: 'Por confirmar' },
  { id: 'sin', titulo: 'Sin relación interdepartamental' },
  { id: 'con', titulo: 'Con relación interdepartamental' }
];
