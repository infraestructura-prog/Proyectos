/* Rutas locales (en el hash, para que recargar conserve la pantalla):
     #/objetivos                          Objetivos (opcional ?macro=id para ir a uno)
     #/proyectos                          Proyectos agrupados por macroobjetivo
     #/proyectos/<slug>/inicio            Inicio de un proyecto habilitado (Etapa 3)
     #/proyectos/<slug>/kanban            Kanban de un proyecto habilitado (opcional ?tarea=id abre una tarea)
     #/proyectos/<slug>                   Ficha preliminar (proyectos aún no habilitados) o Inicio (habilitados)
     #/investigaciones                    Investigaciones agrupadas por macroobjetivo
     #/investigaciones/<slug>/inicio      Inicio de una investigación (con su lista de tareas, sin Kanban; opcional ?tarea=id)
     #/investigaciones/<slug>/resultados  Resultados: conclusión, hallazgos y fuentes
     #/kanban                             Kanban general: una tarjeta por macroobjetivo
     #/pendientes                         Pendientes de clasificación (administración): migración, correspondencia y conflictos
     #/maquinas                           Máquinas de simulación · Resumen
     #/maquinas/postventa · /stock · /stock/repuestos · /operacion   Ventanas del módulo
     #/mantenimiento · /mantenimiento/maquinas · /mantenimiento/trabajos   Mantenimiento (Odoo, captura fechada)
     #/presupuestos · /presupuestos/<id>   Presupuestos (listado y ficha)
   Los proyectos condicionados usan la ruta de proyectos. */
import { HABILITADOS } from './datos.js';

export function leerRuta() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
  const p = new URLSearchParams(query);
  if ((seg[0] === 'proyectos' || seg[0] === 'investigaciones') && seg[1]) {
    return { vista: 'registro', seccion: seg[0], slug: seg[1], pagina: ['kanban', 'inicio', 'resultados'].includes(seg[2]) ? seg[2] : '', tarea: p.get('tarea') || '' };
  }
  if (seg[0] === 'proyectos') return { vista: 'proyectos', seccion: 'proyectos' };
  if (seg[0] === 'investigaciones') return { vista: 'investigaciones', seccion: 'investigaciones' };
  if (seg[0] === 'kanban') return { vista: 'kanban' };
  if (seg[0] === 'pendientes') return { vista: 'pendientes' };
  if (seg[0] === 'maquinas') {
    // Máquinas de simulación: Resumen · Postventa · Stock (equipos / repuestos) · Equipos en operación.
    // Rutas antiguas del módulo anterior: vendidas → Postventa; referencia → Resumen.
    const v = { vendidas: 'postventa', referencia: 'resumen' }[seg[1]] || seg[1] || 'resumen';
    return { vista: 'maquinas', seccion: 'maquinas', ventana: ['resumen', 'postventa', 'stock', 'operacion'].includes(v) ? v : 'resumen', sub: seg[2] || '' };
  }
  if (seg[0] === 'presupuestos') return { vista: 'presupuestos', seccion: 'presupuestos', id: seg[1] || '' };
  if (seg[0] === 'mantenimiento') {
    // Mantenimiento: Resumen · Máquinas del taller · Mantenimientos.
    const v = seg[1] || 'resumen';
    return { vista: 'mantenimiento', seccion: 'mantenimiento', ventana: ['resumen', 'maquinas', 'trabajos'].includes(v) ? v : 'resumen' };
  }
  return { vista: 'objetivos', macro: p.get('macro') || '' };
}
export const habilitado = r => HABILITADOS.has(r.id);
export function rutaRegistro(r, pagina = 'inicio', extra = '') {
  const base = `#/${r.tipo === 'investigacion' ? 'investigaciones' : 'proyectos'}/${encodeURIComponent(r.slug)}`;
  // Proyectos: inicio | kanban. Investigaciones: inicio | resultados (sin Kanban).
  const pag = r.tipo === 'investigacion' ? (pagina === 'resultados' ? 'resultados' : 'inicio') : (pagina === 'kanban' ? 'kanban' : 'inicio');
  return (habilitado(r) ? `${base}/${pag}` : base) + (extra ? `?${extra}` : '');
}
export const rutaMacro = mid => `#/objetivos?macro=${encodeURIComponent(mid)}`;
