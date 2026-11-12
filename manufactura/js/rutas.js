/* Rutas locales estables (en el hash, para que recargar conserve la pantalla):
     #/objetivos                          Objetivos (opcional ?macro=id o ?objetivo=id para ir a uno)
     #/kanban                             Kanban general: todas las tareas por macroobjetivo (opcional ?tarea=id)
     #/proyectos                          Lista de proyectos
     #/proyectos/<slug>/inicio            Inicio del proyecto
     #/proyectos/<slug>/kanban            Kanban del proyecto (opcional &tarea=id abre una tarea)
     #/investigaciones                    Lista de investigaciones
     #/investigaciones/<slug>             Inicio de la investigación (sin Kanban; opcional ?tarea=id)
     #/investigaciones/<slug>/resultados  Resultados de la investigación
     #/nodos-venezuela, #/inventarios, #/presupuestos           Portada de la sección
     #/nodos-venezuela/control (o /actividades), #/inventarios/consumibles, #/presupuestos/compra-equipos   Módulo
   ?desde=<id de objetivo> conserva en las migas el objetivo asociado desde el que se llegó.
   Proyectos e investigaciones son el mismo tipo de registro («tipo»), con la misma vista de Inicio. */
import { SECCIONES } from './datos.js';
const SECCIONES_MODULO = SECCIONES.filter(s => s.hijos).map(s => s.id);

export function leerRuta() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
  const p = new URLSearchParams(query);
  const item = { desde: p.get('desde') || '', tarea: p.get('tarea') || '' };
  if (seg[0] === 'proyectos' && seg[1]) return { vista: 'proyecto', seccion: 'proyectos', slug: seg[1], pagina: seg[2] === 'kanban' ? 'kanban' : 'inicio', ...item };
  if (seg[0] === 'investigaciones' && seg[1]) return { vista: 'proyecto', seccion: 'investigaciones', slug: seg[1], pagina: seg[2] === 'resultados' ? 'resultados' : 'inicio', ...item };
  // Segunda etapa: secciones con módulos del dashboard publicado (#/<sección> y #/<sección>/<módulo>).
  if (SECCIONES_MODULO.includes(seg[0])) return seg[1] ? { vista: 'modulo', seccion: seg[0], hijo: seg[1] } : { vista: 'seccion', seccion: seg[0] };
  if (seg[0] === 'kanban') return { vista: 'kanban', tarea: p.get('tarea') || '' };
  if (seg[0] === 'proyectos') return { vista: 'proyectos' };
  if (seg[0] === 'investigaciones') return { vista: 'investigaciones' };
  return { vista: 'objetivos', macro: p.get('macro') || '', objetivo: p.get('objetivo') || '' };
}
const q = (desde, extra) => (desde || extra ? `?${[desde ? `desde=${encodeURIComponent(desde)}` : '', extra].filter(Boolean).join('&')}` : '');
// Ruta de un proyecto (inicio/kanban) o de una investigación (inicio/resultados; nunca Kanban).
export const rutaProyecto = (p, pagina = 'inicio', desde = '', extra = '') => p.tipo === 'investigacion'
  ? `#/investigaciones/${encodeURIComponent(p.slug)}${pagina === 'resultados' ? '/resultados' : ''}${q(desde, extra)}`
  : `#/proyectos/${encodeURIComponent(p.slug)}/${pagina}${q(desde, extra)}`;
export const rutaObjetivo = oid => `#/objetivos?objetivo=${encodeURIComponent(oid)}`;
export const rutaMacro = mid => `#/objetivos?macro=${encodeURIComponent(mid)}`;
