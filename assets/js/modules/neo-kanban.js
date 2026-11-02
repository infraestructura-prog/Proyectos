/* Neotropya › Kanban de actividades del laboratorio.
   Datos iniciales: assets/data/neotropya-kanban.json, cargados UNA sola vez.
   Tablero independiente del de Infraestructura: identificador «neotropya-kanban» y clave de localStorage propia.
   Además muestra una tarjeta sincronizada por cada nodo en curso, leída de la misma hoja de Google Sheets que
   Neotropya › Nodos. Solo el nodo y su estado global (no su lista de pendientes); no se guarda en el tablero.
   La lógica está en kanban-core.js; la estética, en neotropya.css (.ik-neo). */
import { neoHero } from '../neo-theme.js';
import { mountKanban } from './kanban-core.js';
import { shared, refreshShared, statusKind, openNodeDetail } from './nodos-data.js';

/* Estado del nodo en la hoja → columna y título de su tarjeta. Desplegados y completados no generan tarjeta.
   «Bloqueado» va a Blocked: el «Motivo de demora» de la hoja es el motivo y el responsable, de quién depende. */
function nodeCard(n) {
  const k = statusKind(n.estado);
  let estado, accion;
  if (k === 'blk') [estado, accion] = ['blocked', 'Actualización'];
  else if (k === 'fab') [estado, accion] = ['doing', 'Fabricación'];
  else if (k === 'upd') [estado, accion] = ['doing', 'Actualización'];
  else if (k === 'todo') [estado, accion] = ['todo', 'Ejecución'];
  else return null;
  const np = n.pendientes.length;
  return {
    id: 'nodo:' + n.id, ref: n.id, titulo: `${accion} del nodo ${n.id}`, estado, proyecto: 'Nodos',
    responsable: n.responsable, demora: n.demora, tags: [n.tipo, n.estado],
    bloqueo: estado === 'blocked' ? { quien: n.responsable, motivo: n.demora || 'Motivo no registrado en la hoja («Motivo de demora»).' } : null,
    detalle: ['Pendientes', np ? `${np} en la ficha del nodo` : 'Ninguno registrado']
  };
}

export function mount(root) {
  return mountKanban(root, {
    boardId: 'neotropya-kanban', boardName: 'Kanban de Neotropya', cls: 'ik-neo',
    storeKey: 'ccs-neotropya-kanban-v1', dataUrl: '/assets/data/neotropya-kanban.json', fileSlug: 'kanban-neotropya',
    hero: actions => neoHero({ compact: true, kicker: 'Neotropya · Laboratorio', title: 'Kanban', subtitle: 'Investigaciones, reportes e intervenciones en los nodos',
      description: '', lines: false, actions }),
    proyectos: ['Nodos', 'Investigación', 'Energía', 'Conectividad', 'Fabricación digital'],
    proyectoNuevo: 'Nodos',
    seedNote: 'Carga inicial del tablero de Neotropya',
    external: {
      sourceName: 'Nodos (Google Sheets)', sourceTitle: 'Estado leído de la hoja de control de nodos', badge: 'Desde Nodos',
      toggle: 'Mostrar nodos en curso',
      rule: '«Por ejecutar» va a To do; «En actualizaciones» o «En fabricación», a Doing; «Bloqueado», a Blocked. Los desplegados y completados no aparecen.',
      note: 'El estado se cambia en la hoja de Nodos. Abre la tarjeta para ver la ficha.',
      async load(force) {
        await refreshShared({ force });
        // La demostración de Nodos nunca se presenta como estado real en el tablero.
        if (shared.mode !== 'live') throw new Error(shared.error || 'sin datos en vivo');
        return shared.data.map(nodeCard).filter(Boolean);
      },
      open(ref) { const n = shared.data.find(x => x.id === ref); if (n) openNodeDetail(n); }
    }
  });
}
