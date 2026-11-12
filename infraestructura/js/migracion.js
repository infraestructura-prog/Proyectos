/* Etapa 5 · Migración del Kanban anterior de Infraestructura (exportación «Exportar JSON» del 12/11/2026).
   Fuente: migracion/origen/kanban-infraestructura-2026-11-12.json (copia de solo lectura; el original no se modifica).
   Reglas (encargo, §7 y §8):
   · Antes de transformar, se guarda una copia recuperable del estado local («respaldo previo») y de las tarjetas originales.
   · Cada tarjeta conserva su id; la correspondencia anterior → nueva queda registrada (MAPA y estado de migración).
   · Se conservan estados, historial, responsables y colaboradores, fechas originales y de revisión, bloqueos,
     dependencias, notas, referencias y enlaces. La tarjeta completa queda como «registro de origen» del destino.
   · Estado: se conserva el de origen salvo que la lista definitiva aporte una actualización explícita (válvulas, mueble de volantes).
   · Las tarjetas que no aparecen en la lista van a «Pendientes de clasificación» (sección administrativa, no un macroobjetivo).
   · Volver a ejecutar no duplica (por id de tarjeta) ni sobrescribe ediciones locales (solo se completan campos vacíos
     de tareas sin editar). Las contradicciones se conservan y se marcan como conflicto. */
import { REGISTROS } from './datos.js';

export const FUENTE = { archivo: 'migracion/origen/kanban-infraestructura-2026-11-12.json', nombre: 'kanban-infraestructura-2026-11-12.json', exportado: '2026-11-12T19:48:28.035Z' };

/* Destinos:
   · tarea:      la tarjeta corresponde a UNA tarea nueva (`tarea`); recibe estado, responsable, fechas, bloqueo, notas y subtareas.
   · registro:   la tarjeta abarca un proyecto o investigación (`registro`); `principal` recibe su estado/bloqueo si corresponde;
                 `subs` reparte sus subtareas (índice → id de tarea); el registro recibe responsable, prioridad, etc. si están vacíos.
   · antecedente: trabajo concluido que se conserva como historia del registro o macroobjetivo (`registro`/`macro`), sin reabrirlo.
   · pendiente:  no figura en la lista definitiva → Pendientes de clasificación (con una sugerencia, sin moverlo).
   · archivada:  el usuario decidió dejarla fuera del seguimiento; se conserva íntegra como registro (`decision`).
   · excluida:   el usuario pidió obviarla por completo: no se muestra en ninguna vista (sigue en la copia de origen).
   `estado: false` = no se traslada el estado de la tarjeta (la lista aporta una actualización explícita o es a nivel de proyecto).
   `tambien`: otros registros donde la tarjeta se muestra como referencia (sin duplicarla). */
const T = (pid, n) => `${pid}-a${n}`;
export const MAPA = {
  // 01 · Taller
  'reparacion-canales-taller': { destino: 'registro', registro: 'pi-canales', principal: T('pi-canales', 1),
    subs: { 0: T('pi-canales', 1), 1: T('pi-canales', 1), 2: T('pi-canales', 1), 3: T('pi-canales', 2), 4: T('pi-canales', 2), 5: T('pi-canales', 3), 6: T('pi-canales', 2) } },
  // 02 · Térmico del techo
  'levantamiento-prueba-termica-local': { destino: 'registro', registro: 'ii-alternativas-termicas',
    subs: { 0: T('ii-alternativas-termicas', 3), 1: T('ii-alternativas-termicas', 1), 2: T('ii-alternativas-termicas', 1), 3: T('ii-alternativas-termicas', 3) } },
  // 03 · Goteras: diagnóstico, propuesta y coordinación → investigación; intervención y comprobación → proyecto condicionado
  'goteras': { destino: 'registro', registro: 'ii-causas-goteras', tambien: ['pc-correccion-filtraciones'],
    subs: { 0: T('ii-causas-goteras', 1), 1: T('ii-causas-goteras', 3), 2: T('ii-causas-goteras', 2), 3: T('pc-correccion-filtraciones', 2), 4: T('pc-correccion-filtraciones', 3) } },
  // 04 · Almacén
  'mueble-alfombras-almacen': { destino: 'registro', registro: 'pi-mueble-alfombras', principal: T('pi-mueble-alfombras', 2),
    subs: { 0: T('pi-mueble-alfombras', 2), 1: T('pi-mueble-alfombras', 2), 2: T('pi-mueble-alfombras', 2), 3: T('pi-mueble-alfombras', 3), 4: T('pi-mueble-alfombras', 4), 5: T('pi-mueble-alfombras', 4) } },
  'mueble-volantes': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'hito-herrero': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  // 05 · Información técnica de activos
  'censo-activos': { destino: 'registro', registro: 'pi-censo', principal: T('pi-censo', 1),
    subs: { 0: T('pi-censo', 1), 1: T('pi-censo', 3), 2: T('pi-censo', 4), 3: T('pi-censo', 2), 4: T('pi-censo', 2), 5: T('pi-censo', 2), 6: T('pi-censo', 2), 7: T('pi-censo', 2), 8: T('pi-censo', 4) } },
  'identificacion-fisica-equipos-soportes': { destino: 'tarea', tarea: T('pi-censo', 4) },
  'ficha-fallas-mantenimiento': { destino: 'tarea', tarea: T('pi-fichas-mantenimiento', 1) },
  // 06 · Puentes y elevadores: el cambio de válvulas ya se realizó (06/11/2026); documentarlo sigue pendiente.
  'puentes-elevadores': { destino: 'registro', registro: 'pi-reparaciones-puentes', estado: false, proximaAccion: false,
    subs: { 0: T('pi-reparaciones-puentes', 1), 1: T('pi-reparaciones-puentes', 4), 2: T('pi-reparaciones-puentes', 2), 3: T('pi-reparaciones-puentes', 4) } },
  // 08 · Máquinas de simulación
  'validar-modelos-kits-odoo': { destino: 'tarea', tarea: T('pi-inventario-maquinas', 1) },
  'conciliar-kits-reportados-caso-g': { destino: 'tarea', tarea: T('pi-inventario-maquinas', 1), secundaria: true },
  'conciliar-repuestos-soportes-odoo': { destino: 'tarea', tarea: T('pi-inventario-maquinas', 1), secundaria: true },
  'inventario-inspeccion-kits-operativos': { destino: 'tarea', tarea: T('pi-inventario-maquinas', 2) },
  'historico-equipos-vendidos': { destino: 'tarea', tarea: T('pi-postventa', 1), subs: { 1: T('pi-postventa', 4) } },
  'hito-maquinas-diagnostico': { destino: 'excluida', decision: 'Excluida por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  // 09 · Gestión de Infraestructura (y 05 Fichas como referencia: una tarjeta, dos destinos)
  'dashboard-mantenimiento': { destino: 'registro', registro: 'pi-dashboard', principal: T('pi-dashboard', 1),
    subs: { 0: T('pi-dashboard', 4), 1: T('pi-dashboard', 2), 2: T('pi-dashboard', 1), 3: T('pi-dashboard', 2) } },
  'demo-revision-tecnica-app': { destino: 'tarea', tarea: T('pi-dashboard', 5), tambien: [] },
  'hito-dashboard': { destino: 'antecedente', registro: 'pi-dashboard', macro: 'mi-gestion' },
  // Pendientes de clasificación (no figuran en la lista definitiva)
  'almacenaje-ensamblaje': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'tapa-drywall': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'presupuesto-tomacorrientes': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'instalacion-tomacorrientes': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'hito-ducto': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'barras-verdes-plan-pruebas': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'estudio-sujecion': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'ia-2026-10-24': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'ia-2026-10-25': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'ia-2026-10-26': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'reporte-2026-10-24': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'reporte-2026-10-25': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
  'reporte-2026-10-26': { destino: 'excluida', decision: 'Archivada por indicación del usuario (12/11/2026): no se muestra en el dashboard; solo queda en la copia de origen.' },
};


/* Conflictos detectados entre fuentes. `resuelto`: decisión del usuario (12/11/2026); sin ella, el conflicto sigue abierto.
   Los conflictos sobre «Máquinas de diagnóstico» se eliminaron a pedido del usuario (la tarjeta se excluye). */
const DIA = '12/11/2026';
/* `oculto`: decisión sobre tarjetas que el usuario pidió no ver; se registra aquí pero no se muestra en el dashboard. */
export const CONFLICTOS = [
  { tarjetas: ['reparacion-canales-taller'], registro: 'pi-canales', texto: 'Responsable: la exportación indica «Cristian»; una ficha suelta anterior indicaba «Erick».',
    resuelto: `Responsable: Cristian (encargado). Erick ya no forma parte de la empresa. (${DIA})` },
  { tarjetas: ['mueble-alfombras-almacen'], registro: 'pi-mueble-alfombras', texto: 'Responsable: la exportación indica «Cristian»; una ficha suelta anterior indicaba «Erick y Cristian».',
    resuelto: `Responsable: Cristian (encargado). Erick ya no forma parte de la empresa. (${DIA})` },
  { tarjetas: ['puentes-elevadores'], registro: 'pi-reparaciones-puentes', texto: 'Nombre: la tarjeta escribe «Fabrizio» y la lista definitiva «Fabricio».',
    resuelto: `Es la misma persona: Fabricio. Las tareas y subtareas migradas usan «Fabricio»; la tarjeta de origen conserva su texto original. (${DIA})` },
  { tarjetas: ['puentes-elevadores'], registro: 'pi-reparaciones-puentes', texto: 'Estado y próxima acción de origen («Doing», «Confirmar estado de compra… de las válvulas») quedaron superados por el cambio de válvulas del 06/11/2026.',
    resuelto: `El cambio de válvulas está completado; el seguimiento de puentes y elevadores continúa como objetivo (06, prioridad crítica). Documentar el resultado sigue pendiente. (${DIA})` },
  { oculto: true, tarjetas: ['mueble-volantes'], registro: '', texto: 'Mueble de volantes: la tarjeta está en Done (cierre del 05/11/2026) con tres subtareas sin marcar. Según el usuario, en el mueble se completó hasta el contacto con el herrero y falta la gestión y presentación del presupuesto, la fabricación y la instalación.',
    resuelto: `El mueble de volantes está listo y no se agrega al dashboard. El que está en proceso es el de alfombras (contacto con el herrero hecho; faltan presupuesto, fabricación e instalación). (${DIA})` },
  { tarjetas: ['dashboard-mantenimiento'], registro: 'pi-dashboard', texto: 'La tarjeta del dashboard tenía dos destinos posibles (09 y 05 · Fichas).',
    resuelto: `La reorganización del dashboard es un macroobjetivo en sí mismo (09): la tarjeta completa queda allí, sin referencia en 05. (${DIA})` },
  { tarjetas: ['inventario-inspeccion-kits-operativos'], registro: 'pi-inventario-maquinas', texto: 'Las inspecciones de los kits (vástagos, guardapolvos, soportes) estaban repartidas entre 08 y 05.',
    resuelto: `Unificadas en una sola tarea: 08 · «Diferenciar equipos en stock, en funcionamiento y vendidos», con las inspecciones como subtareas. (${DIA})` },
  { tarjetas: ['validar-modelos-kits-odoo', 'conciliar-kits-reportados-caso-g', 'conciliar-repuestos-soportes-odoo'], registro: 'pi-inventario-maquinas', texto: 'Tres tarjetas del Kanban anterior hablaban de lo mismo: conciliar kits, componentes y repuestos.',
    resuelto: `Unificadas en una sola tarea: «Conciliar kits, componentes y repuestos con Gerardo» (sus pasos quedan como subtareas). (${DIA})` },
  { oculto: true, tarjetas: ['almacenaje-ensamblaje'], registro: '', texto: 'Posible duplicado con el proyecto de Manufactura «Organización del área de ensamblaje».',
    resuelto: `El almacenaje del área de ensamblaje queda solo en Manufactura; no se muestra en Infraestructura. (${DIA})` }
];

const ESTADO = { todo: 'todo', doing: 'doing', blocked: 'blocked', testing: 'testing', done: 'completed', completed: 'completed' };
const nombre = s => String(s || '').replace(/Fabrizio/g, 'Fabricio');   // decisión del usuario: misma persona
const fd = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '');
// Sin ediciones de usuario: solo tiene entradas de carga inicial o de la propia migración (las tarjetas secundarias no la «bloquean»).
const intacta = t => t.historial.every(h => ['carga', 'migracion', 'origen'].includes(h.tipo));

/* Notas legibles de las fechas de la tarjeta (original, reprogramada, revisión, plazo y condicionadas). */
export function notaFechas(c) {
  const f = c.fechas || {};
  return [f.original && `fecha original ${fd(f.original)}`, f.reprogramada && `reprogramada ${fd(f.reprogramada)}`, f.revision && `revisión ${fd(f.revision)} (no es fecha de finalización)`,
    f.plazo && `plazo: ${f.plazo}`, ...(f.condicionadas || []).map(x => `${fd(x.fecha)}: ${x.condicion}`)].filter(Boolean).join(' · ');
}
const bloqueoDe = c => (c.bloqueo && c.bloqueo.motivo ? { motivo: `${c.bloqueo.motivo}${c.bloqueo.quien ? ` (${c.bloqueo.quien})` : ''}`, necesita: c.bloqueo.accion || 'Por definir' } : null);
const colabs = c => [...new Set([...(Array.isArray(c.colaboradores) ? c.colaboradores : String(c.colaboradores || '').split(/[,;]/))].map(x => String(x).trim()).filter(Boolean))];

/* Aplica la migración sobre copias de los datos locales. Devuelve los datos nuevos y un informe.
   estado: { tarjetas: { [id]: { destino, aplicada } } } (lo ya migrado no se vuelve a aplicar). */
export function migrar(tarjetas, datos, estadoPrevio) {
  const { inicios, tareas } = datos;
  const ahora = new Date().toISOString();
  const est = { fuente: FUENTE.nombre, exportado: FUENTE.exportado, tarjetas: { ...(estadoPrevio && estadoPrevio.tarjetas) } };
  const inf = { aplicadas: [], omitidas: [], noSobrescritas: [], sinMapa: [] };
  const tarea = id => tareas.find(t => t.id === id);
  const logT = (t, nota) => t.historial.push({ fecha: ahora, tipo: 'migracion', nota: nombre(nota) });
  const logP = (pid, nota) => inicios[pid].historial.push({ fecha: ahora, tipo: 'migracion', nota: nombre(nota) });
  const completar = (obj, k, v) => { if (v && !obj[k]) { obj[k] = v; return true; } return false; };

  for (const c of tarjetas) {
    const m = MAPA[c.id];
    if (!m) { inf.sinMapa.push(c.id); est.tarjetas[c.id] = { destino: 'pendiente', aplicada: ahora, sinMapa: true }; continue; }
    if (est.tarjetas[c.id]) { inf.omitidas.push(c.id); continue; }   // ya migrada: no se duplica
    const ref = `«${c.titulo}» (${c.id})`;
    const estado = ESTADO[c.estado] || 'todo';

    // Trasladar a una tarea: estado, responsable, colaboradores, fecha, prioridad, bloqueo, notas, criterio, subtareas, enlaces, historial.
    const aTarea = (t, { conEstado, comoSub }) => {
      if (!t) return;
      const libre = intacta(t);
      const subs = (c.subtareas || []).map((s, i) => ({ s, i })).filter(({ i }) => !m.subs || m.subs[i] === undefined || m.subs[i] === t.id);
      if (comoSub || !libre) {
        // Tarea editada localmente o tarjeta secundaria: no se sobrescribe; se agregan subtareas y la referencia.
        subs.forEach(({ s }) => { if (!t.subtareas.some(x => x.texto === nombre(s.texto))) t.subtareas.push({ id: `${c.id}-s${t.subtareas.length + 1}`, texto: nombre(s.texto), hecha: !!s.hecha }); });
        if (!libre && !comoSub) inf.noSobrescritas.push(`${t.id} ← ${c.id}`);
        logT(t, `Kanban anterior: se vinculó ${ref} (estado de origen ${c.estado}${c.responsable ? `, responsable ${c.responsable}` : ''}). ${notaFechas(c)}`);
        t.origen = [t.origen === 'Lista definitiva de macroobjetivos' ? '' : t.origen, c.id].filter(Boolean).join(' · ');
        return;
      }
      if (conEstado && estado !== t.estado) {
        t.estado = estado; t.porConfirmar = !!c.estadoPorConfirmar;
        if (estado === 'blocked') t.bloqueo = bloqueoDe(c) || { motivo: 'Bloqueo de origen sin motivo registrado', necesita: 'Por definir' };
        if (estado === 'completed' && c.cierre) t.cierre = { nota: c.cierre.nota || '', criterioCumplido: true, fecha: c.cierre.fecha || '' };
      } else if (conEstado) t.porConfirmar = !!c.estadoPorConfirmar;
      completar(t, 'responsable', c.responsable);
      completar(t, 'colaboradores', colabs(c).join(', '));
      completar(t, 'fecha', (c.fechas && (c.fechas.reprogramada || c.fechas.original)) || '');
      if (['alta', 'media', 'baja', 'critica'].includes(c.prioridad)) completar(t, 'prioridad', c.prioridad);
      completar(t, 'criterio', c.criterio);
      if (c.objetivo) completar(t, 'descripcion', c.objetivo);
      const notas = [c.notas, c.proximaAccion && m.proximaAccion !== false ? `Próxima acción (Kanban anterior): ${c.proximaAccion}` : '',
        c.dependenciaExterna && `Dependencia externa: ${c.dependenciaExterna}`, c.solicitante && `Solicitante: ${c.solicitante}`, c.supervisor && `Supervisión: ${c.supervisor}`,
        notaFechas(c) && `Fechas: ${notaFechas(c)}`, (c.referencias || []).length ? `Referencias: ${[].concat(c.referencias).join(', ')}` : ''].filter(Boolean).join('\n');
      if (notas) t.notas = [t.notas, nombre(notas)].filter(Boolean).join('\n\n');
      [...(c.enlaces || []), c.enlace].filter(u => typeof u === 'string' && /^https:\/\//.test(u.trim())).forEach(u => { if (!t.enlaces.includes(u.trim())) t.enlaces.push(u.trim()); });
      subs.forEach(({ s }) => { if (!t.subtareas.some(x => x.texto === nombre(s.texto))) t.subtareas.push({ id: `${c.id}-s${t.subtareas.length + 1}`, texto: nombre(s.texto), hecha: !!s.hecha }); });
      (c.historial || []).forEach(h => t.historial.push({ fecha: h.fecha || '', tipo: 'origen', nota: nombre(`[Kanban anterior] ${h.de && h.a && h.de !== h.a ? `${h.de} → ${h.a}. ` : ''}${h.nota || ''}`) }));
      t.origen = [t.origen === 'Lista definitiva de macroobjetivos' ? '' : t.origen, c.id].filter(Boolean).join(' · ');
      logT(t, `Migrada desde ${ref}: estado de origen ${c.estado}${conEstado ? '' : ' (no trasladado)'}${c.estadoPorConfirmar ? ', por confirmar' : ''}.`);
    };

    if (m.destino === 'tarea') {
      aTarea(tarea(m.tarea), { conEstado: true, comoSub: !!m.secundaria });
      // Subtareas asignadas a otras tareas (p. ej., inspecciones → Fichas).
      Object.entries(m.subs || {}).filter(([, tid]) => tid !== m.tarea).forEach(([i, tid]) => {
        const t = tarea(tid), s = c.subtareas[i]; if (!t || !s) return;
        if (!t.subtareas.some(x => x.texto === nombre(s.texto))) t.subtareas.push({ id: `${c.id}-s${i}`, texto: nombre(s.texto), hecha: !!s.hecha });
        if (!String(t.origen).includes(c.id)) t.origen = [t.origen === 'Lista definitiva de macroobjetivos' ? '' : t.origen, c.id].filter(Boolean).join(' · ');
        logT(t, `Subtarea recibida de ${ref}: «${s.texto}».`);
      });
      const pid = m.tarea.replace(/-a\d+$/, '');
      logP(pid, `Kanban anterior: ${ref} → tarea «${(tarea(m.tarea) || {}).titulo || m.tarea}».`);
    } else if (m.destino === 'registro') {
      const pid = m.registro, ini = inicios[pid];
      if (ini) {
        completar(ini, 'responsable', c.responsable);
        if (['alta', 'media', 'baja', 'critica'].includes(c.prioridad)) completar(ini, 'prioridad', c.prioridad);
        if (m.proximaAccion !== false) completar(ini, 'proximaAccion', c.proximaAccion);
        completar(ini, 'colaboradores', [...colabs(c), c.supervisor && `${c.supervisor} (supervisión)`].filter(Boolean).join(', '));
        completar(ini, 'colaboracion', [c.dependenciaExterna && `Dependencia externa: ${c.dependenciaExterna}`, c.solicitante && `Solicitante: ${c.solicitante}`].filter(Boolean).join(' · '));
        if (c.objetivo) completar(ini, 'descripcion', c.objetivo);
        logP(pid, `Migrado desde ${ref}: estado de origen ${c.estado}${m.estado === false ? ' (no trasladado: la lista aporta una actualización)' : ''}. ${notaFechas(c)}`);
      }
      // Subtareas repartidas; la principal recibe estado, bloqueo, fechas y notas de la tarjeta.
      const porTarea = {};
      (c.subtareas || []).forEach((s, i) => { const tid = (m.subs || {})[i]; if (tid) (porTarea[tid] = porTarea[tid] || []).push({ s, i }); });
      if (m.principal && !porTarea[m.principal]) porTarea[m.principal] = [];
      Object.entries(porTarea).forEach(([tid, ss]) => {
        const t = tarea(tid); if (!t) return;
        const libre = intacta(t);
        ss.forEach(({ s, i }) => { if (!t.subtareas.some(x => x.texto === nombre(s.texto))) t.subtareas.push({ id: `${c.id}-s${i}`, texto: nombre(s.texto), hecha: !!s.hecha }); });
        if (tid === m.principal && m.estado !== false && libre) {
          if (estado !== t.estado && estado !== 'completed') {
            t.estado = estado; if (estado === 'blocked') t.bloqueo = bloqueoDe(c) || { motivo: 'Bloqueo de origen sin motivo registrado', necesita: 'Por definir' };
          }
          t.porConfirmar = !!c.estadoPorConfirmar;
          completar(t, 'responsable', c.responsable);
          completar(t, 'colaboradores', colabs(c).join(', '));
          completar(t, 'fecha', (c.fechas && (c.fechas.reprogramada || c.fechas.original)) || '');
          completar(t, 'criterio', c.criterio);
          const notas = [c.notas, c.proximaAccion && `Próxima acción (Kanban anterior): ${c.proximaAccion}`, notaFechas(c) && `Fechas: ${notaFechas(c)}`,
            (c.referencias || []).length ? `Referencias: ${[].concat(c.referencias).join(', ')}` : ''].filter(Boolean).join('\n');
          if (notas) t.notas = [t.notas, nombre(notas)].filter(Boolean).join('\n\n');
        } else if (tid === m.principal && !libre) inf.noSobrescritas.push(`${tid} ← ${c.id}`);
        if (libre && c.responsable && tid !== m.principal) completar(t, 'responsable', c.responsable);
        t.origen = [t.origen === 'Lista definitiva de macroobjetivos' ? '' : t.origen, c.id].filter(Boolean).join(' · ');
        logT(t, `Kanban anterior: ${ss.length ? `subtareas de ${ref}: ${ss.map(x => `«${x.s.texto}»${x.s.hecha ? ' (hecha)' : ''}`).join(', ')}` : `tarea principal de ${ref}`}${tid === m.principal && m.estado !== false ? ` · estado de origen ${c.estado}` : ''}.`);
      });
    } else if (m.destino === 'antecedente') {
      if (m.registro && inicios[m.registro]) logP(m.registro, `Antecedente del Kanban anterior: ${ref} (${c.estado}${c.cierre && c.cierre.fecha ? `, cerrado el ${fd(c.cierre.fecha)}` : ''}). Sin reabrir.`);
    }
    est.tarjetas[c.id] = { destino: m.destino, aplicada: ahora };
    inf.aplicadas.push(c.id);
  }
  est.ultima = ahora;
  return { inicios, tareas, estado: est, informe: inf };
}

/* Registros de origen que corresponden a un registro (para mostrarlos en su Inicio). */
export function origenesDe(rid, tarjetas) {
  return tarjetas.filter(c => {
    const m = MAPA[c.id]; if (!m) return false;
    return m.registro === rid || (m.tarea && m.tarea.replace(/-a\d+$/, '') === rid) || (m.tambien || []).includes(rid)
      || Object.values(m.subs || {}).some(tid => tid.replace(/-a\d+$/, '') === rid);
  });
}
export const antecedentesMacro = (mid, tarjetas) => tarjetas.filter(c => MAPA[c.id] && MAPA[c.id].destino === 'antecedente' && MAPA[c.id].macro === mid);
export const destinoTxt = id => {
  const m = MAPA[id]; if (!m) return 'Sin correspondencia';
  const reg = m.registro || (m.tarea && m.tarea.replace(/-a\d+$/, ''));
  return m.destino === 'pendiente' ? 'Pendientes de clasificación' : m.destino === 'archivada' ? 'Archivada (fuera del seguimiento)' : m.destino === 'excluida' ? 'Excluida' : `${{ tarea: 'Tarea', registro: 'Registro', antecedente: 'Antecedente' }[m.destino]}${reg && REGISTROS[reg] ? ` · ${REGISTROS[reg].nombre}` : ''}`;
};
