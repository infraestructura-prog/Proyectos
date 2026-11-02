/* Infraestructura › Kanban de actividades.
   Datos iniciales: assets/data/infra-kanban.json (To-do list del departamento), cargados UNA sola vez.
   Persistencia: localStorage de este navegador + exportación/importación JSON. La lógica está en kanban-core.js. */
import { infraHero } from '../infra-theme.js';
import { mountKanban } from './kanban-core.js';

export function mount(root) {
  return mountKanban(root, {
    boardId: 'infra-kanban', boardName: 'Kanban de Infraestructura',
    storeKey: 'ccs-infra-kanban-v1', dataUrl: '/assets/data/infra-kanban.json', fileSlug: 'kanban-infraestructura',
    hero: actions => infraHero({ compact: true, kicker: 'Infraestructura · Taller', title: 'Kanban', subtitle: 'Mantenimiento, taller, oficinas y desarrollo de proyectos', actions }),
    proyectos: ['Mantenimiento', 'Taller', 'Oficinas', 'Desarrollo de proyectos', 'Neotropya / transversal', 'Gestión departamental'],
    proyectoNuevo: 'Mantenimiento',
    seedNote: 'Carga inicial desde el To-do list',
    scopeLabel: 'de Infraestructura'
  });
}
