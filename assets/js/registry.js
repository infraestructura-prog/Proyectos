/* Mapa de áreas y actividades. Para agregar una actividad nueva:
   1. Crea su módulo en assets/js/modules/ con export function mount(el, ctx) que devuelva una función de limpieza.
   2. Añade un nodo aquí con `load: () => import('./modules/tu-modulo.js')`.
   La ruta de cada nodo es la unión de los `id` (ej. #/neotropya/nodos/ordenes). */

export const TREE = {
  id: '', title: 'Inicio',
  children: [
    {
      id: 'neotropya', title: 'Neotropya', icon: 'node', tone: 'neon',
      desc: 'Proyectos de nodos: maletas y bolsos en desarrollo y desarrollados.',
      children: [
        {
          id: 'nodos', title: 'Nodos', icon: 'case',
          desc: 'Consulta de maletas y bolsos, su estado y sus pendientes.',
          children: [
            {
              id: 'ordenes', title: 'Control de órdenes de fabricación', icon: 'list',
              desc: 'Estado, especificaciones, pendientes y demoras leídos desde Google Sheets.',
              load: () => import('./modules/nodos.js')
            },
            {
              id: 'actividades', title: 'Tablero de actividades', icon: 'kanban',
              desc: 'Vista kanban de las actividades pendientes de cada nodo, por estado o por responsable.',
              load: () => import('./modules/nodos-kanban.js')
            }
          ]
        }
      ]
    },
    {
      id: 'infraestructura', title: 'Infraestructura', icon: 'wrench', tone: 'mint',
      desc: 'Mantenimiento, taller y desarrollo de proyectos: maquinaria, equipos e intervenciones en las oficinas.',
      children: [
        {
          id: 'maquinas', title: 'Máquinas de simulación', icon: 'gear',
          desc: 'Registro de máquinas vendidas y en stock con sus características.',
          load: () => import('./modules/maquinas.js')
        }
      ]
    }
  ]
};

/* Recorre el árbol según los segmentos de la ruta. Devuelve la cadena de nodos y los segmentos sobrantes
   (que se pasan al módulo como subruta). */
export function resolve(segments) {
  const chain = [TREE];
  let node = TREE, i = 0;
  for (; i < segments.length; i++) {
    if (node.load) break;
    const next = (node.children || []).find(c => c.id === segments[i]);
    if (!next) return { chain, rest: segments.slice(i), notFound: true };
    chain.push(next); node = next;
  }
  return { chain, rest: segments.slice(i), notFound: false };
}

export const pathOf = chain => '#/' + chain.slice(1).map(n => n.id).join('/');
