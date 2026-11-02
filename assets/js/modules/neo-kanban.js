/* Neotropya › Kanban de actividades del laboratorio.
   Datos iniciales: assets/data/neotropya-kanban.json, cargados UNA sola vez.
   Tablero independiente del de Infraestructura: identificador «neotropya-kanban» y clave de localStorage propia.
   La lógica está en kanban-core.js; la estética, en neotropya.css (.ik-neo). */
import { neoHero } from '../neo-theme.js';
import { mountKanban } from './kanban-core.js';

export function mount(root) {
  return mountKanban(root, {
    boardId: 'neotropya-kanban', boardName: 'Kanban de Neotropya', cls: 'ik-neo',
    storeKey: 'ccs-neotropya-kanban-v1', dataUrl: '/assets/data/neotropya-kanban.json', fileSlug: 'kanban-neotropya',
    hero: actions => neoHero({ compact: true, kicker: 'Neotropya · Laboratorio', title: 'Kanban', subtitle: 'Investigaciones, reportes e intervenciones en los nodos',
      description: '', lines: false, actions }),
    proyectos: ['Nodos', 'Investigación', 'Energía', 'Conectividad', 'Fabricación digital'],
    proyectoNuevo: 'Nodos',
    seedNote: 'Carga inicial del tablero de Neotropya'
  });
}
