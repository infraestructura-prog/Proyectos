/* Vistas de la Etapa 5: «Pendientes de clasificación» (sección administrativa con el estado de la migración,
   la correspondencia anterior → nueva, los conflictos y las tarjetas sin clasificar) y el bloque «Kanban anterior»
   que muestra en cada proyecto o investigación sus tarjetas de origen completas. Funciones puras que devuelven HTML. */
import { esc, plural, migasHtml } from './componentes.js';
import { AREA, REGISTROS } from './datos.js';
import { rutaRegistro } from './rutas.js';
import { MAPA, CONFLICTOS, FUENTE, notaFechas, destinoTxt } from './migracion.js';

const fdt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const EST = { todo: 'To do', doing: 'Doing', blocked: 'Blocked', testing: 'Testing', done: 'Done', completed: 'Completed' };
const lista = v => (Array.isArray(v) ? v : String(v || '').split(/[,;]/)).map(x => String(x).trim()).filter(Boolean);

/* Tarjeta de origen completa (plegada): nada se resume ni se pierde. */
export function origenHtml(c, { abierto = false } = {}) {
  const fila = (t, v) => (v ? `<div><dt>${t}</dt><dd>${v}</dd></div>` : '');
  const blq = c.bloqueo && c.bloqueo.motivo ? `${esc(c.bloqueo.motivo)}${c.bloqueo.quien ? ` · ${esc(c.bloqueo.quien)}` : ''}${c.bloqueo.accion ? `<br><small>Acción: ${esc(c.bloqueo.accion)}</small>` : ''}` : '';
  const enl = [...(c.enlaces || []), c.enlace].filter(u => typeof u === 'string' && /^https:\/\//.test(u.trim()));
  return `<details class="org" data-keep="org-${esc(c.id)}" ${abierto ? 'open' : ''}>
    <summary><span class="org-est e-${esc(c.estado)}">${esc(EST[c.estado] || c.estado)}</span><span class="org-t">${esc(c.titulo)}</span><code>${esc(c.id)}</code></summary>
    <dl class="org-dl">
      ${fila('Objetivo', esc(c.objetivo))}
      ${fila('Responsable', esc(c.responsable))}
      ${fila('Colaboradores', esc(lista(c.colaboradores).join(', ')))}
      ${fila('Supervisión', esc(c.supervisor))}${fila('Solicitante', esc(c.solicitante))}${fila('Dependencia externa', esc(c.dependenciaExterna))}
      ${fila('Prioridad', esc(c.prioridad))}${fila('Próxima acción', esc(c.proximaAccion))}
      ${fila('Fechas', esc(notaFechas(c)))}
      ${fila('Bloqueo', blq)}
      ${fila('Criterio', esc(c.criterio))}
      ${c.cierre && (c.cierre.nota || c.cierre.fecha) ? fila('Cierre', `${esc(c.cierre.nota || '')}${c.cierre.fecha ? ` · ${esc(c.cierre.fecha)}` : ''}`) : ''}
      ${fila('Notas', c.notas ? `<span class="pre">${esc(c.notas)}</span>` : '')}
      ${fila('Referencias', esc([].concat(c.referencias || []).join(', ')))}
      ${fila('Vinculadas', esc((c.vinculadas || []).join(', ')))}
      ${fila('Enlaces', enl.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join('<br>'))}
      ${fila('Estado por confirmar', c.estadoPorConfirmar ? 'Sí' : '')}
      ${fila('Proyecto y equipo (anterior)', esc([c.proyecto, c.equipo].filter(Boolean).join(' · ')))}
    </dl>
    ${(c.subtareas || []).length ? `<h4>Subtareas</h4><ul class="org-subs">${c.subtareas.map(s => `<li class="${s.hecha ? 'hecha' : ''}">${s.hecha ? '☑' : '☐'} ${esc(s.texto)}</li>`).join('')}</ul>` : ''}
    ${(c.historial || []).length ? `<h4>Historial</h4><ol class="hist">${[...c.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${h.de && h.a && h.de !== h.a ? `${esc(EST[h.de] || h.de)} → ${esc(EST[h.a] || h.a)}. ` : ''}${esc(h.nota || '')}</li>`).join('')}</ol>` : ''}
    <p class="nota">Destino: ${esc(destinoTxt(c.id))}</p>
  </details>`;
}

/* Bloque del Inicio de un proyecto o investigación con sus tarjetas de origen y sus conflictos. */
export function origenesHtml(rid, cards) {
  if (!cards.length) return '';
  const conf = CONFLICTOS.filter(x => !x.oculto).filter(x => x.registro === rid || x.tarjetas.some(id => cards.some(c => c.id === id)));
  return `<section class="pj-sec org-sec" aria-labelledby="org-t-${rid}">
    <div class="sec-head"><h2 id="org-t-${rid}">Kanban anterior</h2><span class="nota">${plural(cards.length, 'tarjeta de origen', 'tarjetas de origen')} · copia íntegra</span></div>
    ${conf.length ? `<ul class="conf-list">${conf.map(x => x.resuelto ? `<li class="ok"><b>Decisión:</b> ${esc(x.resuelto)}</li>` : `<li><b>Por confirmar:</b> ${esc(x.pregunta || x.texto)}</li>`).join('')}</ul>` : ''}
    ${cards.map(c => origenHtml(c)).join('')}
  </section>`;
}

/* Página administrativa: estado de la migración, correspondencia, conflictos y pendientes de clasificación. */
export function pendientesHtml(cards, est, respaldo) {
  const migradas = est ? Object.keys(est.tarjetas || {}).length : 0;
  const pend = cards.filter(c => MAPA[c.id] && MAPA[c.id].destino === 'pendiente');
  const sinMapa = cards.filter(c => !MAPA[c.id]);
  const archivadas = cards.filter(c => MAPA[c.id] && MAPA[c.id].destino === 'archivada');
  const visibles = cards.filter(c => !(MAPA[c.id] && MAPA[c.id].destino === 'excluida'));   // las excluidas no se muestran
  const vis = CONFLICTOS.filter(x => !x.oculto), abiertos = vis.filter(x => !x.resuelto), resueltos = vis.filter(x => x.resuelto);
  const grupos = { tarea: 'Tarea', registro: 'Proyecto o investigación', antecedente: 'Antecedente', pendiente: 'Pendiente de clasificación', archivada: 'Archivada' };
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: 'Pendientes de clasificación' }])}
    <header class="pg-head"><p class="pg-kicker">${esc(AREA.nombre)} · Administración</p><h1 id="pg-titulo" tabindex="-1">Pendientes de clasificación</h1>
      <p class="pg-intro">Sección administrativa (no es un macroobjetivo): migración del Kanban anterior, su correspondencia con la nueva estructura, los conflictos para revisar y las tarjetas que no figuran en la lista definitiva.</p></header>

    <section class="pj-sec mig" aria-labelledby="mig-t">
      <div class="sec-head"><h2 id="mig-t">Migración del Kanban anterior</h2>
        <span class="conc-chip ${est ? 'e-aprobada' : 'e-sin'}">${est ? `Migrado · ${migradas} tarjetas` : 'Sin migrar'}</span></div>
      <p>Fuente: <b>${esc(FUENTE.nombre)}</b> (exportada el ${esc(fdt(FUENTE.exportado))}). Copia de solo lectura en <code>${esc(FUENTE.archivo)}</code>; el original y el dashboard publicado no se modifican.</p>
      ${est ? `<p class="nota">Última ejecución: ${esc(fdt(est.ultima))}.${respaldo ? ` Respaldo previo: ${esc(fdt(respaldo.fecha))}.` : ''}</p>` : '<p class="nota">Al migrar se guarda primero un respaldo de los datos locales y una copia íntegra de las tarjetas. Volver a ejecutar no duplica ni sobrescribe ediciones locales.</p>'}
      <div class="pj-actions">
        <button type="button" class="btn btn-sm btn-primary" data-act="migrar">${est ? 'Volver a ejecutar (no duplica)' : 'Migrar el Kanban anterior'}</button>
        ${respaldo ? `<button type="button" class="btn btn-sm" data-act="descargar-respaldo">Descargar respaldo previo</button>
          <button type="button" class="btn btn-sm btn-ghost fu-borrar" data-act="deshacer-migracion">Deshacer la migración</button>` : ''}
      </div>
    </section>

    ${cards.length ? `<section class="pj-sec" aria-labelledby="map-t">
      <h2 id="map-t">Correspondencia: tarjeta anterior → nueva ubicación</h2>
      <div class="tabla-wrap"><table class="map-tabla"><thead><tr><th>Tarjeta anterior</th><th>Estado</th><th>Nueva ubicación</th><th>Migrada</th></tr></thead>
      <tbody>${visibles.map(c => { const m = MAPA[c.id]; const reg = m && (m.registro || (m.tarea && m.tarea.replace(/-a\d+$/, ''))); const r = reg && REGISTROS[reg];
        return `<tr><td><b>${esc(c.titulo)}</b><br><code>${esc(c.id)}</code></td><td>${esc(EST[c.estado] || c.estado)}</td>
          <td>${m ? esc(grupos[m.destino]) : 'Sin correspondencia'}${r ? ` · <a href="${rutaRegistro(r)}">${esc(r.nombre)}</a>` : ''}${m && m.tarea ? `<br><small>Tarea: ${esc(m.tarea)}</small>` : ''}${m && m.sugerencia ? `<br><small>${esc(m.sugerencia)}</small>` : ''}</td>
          <td>${est && est.tarjetas && est.tarjetas[c.id] ? '✓' : '—'}</td></tr>`; }).join('')}</tbody></table></div>
    </section>` : ''}

    <section class="pj-sec" aria-labelledby="conf-t">
      <div class="sec-head"><h2 id="conf-t">Preguntas abiertas</h2><span class="nota">${plural(abiertos.length, 'pregunta', 'preguntas')}</span></div>
      ${abiertos.length ? `<ul class="conf-list">${abiertos.map(x => `<li>${x.registro && REGISTROS[x.registro] ? `<a href="${rutaRegistro(REGISTROS[x.registro])}">${esc(REGISTROS[x.registro].nombre)}</a>: ` : ''}${esc(x.texto)}<br><b>Por confirmar:</b> ${esc(x.pregunta)}</li>`).join('')}</ul>` : '<p class="vacio">No hay preguntas abiertas.</p>'}
      ${resueltos.length ? `<details class="mas" data-keep="conf-resueltos"><summary>Decisiones tomadas (${resueltos.length})</summary>
        <ul class="conf-list ok-list">${resueltos.map(x => `<li>${x.registro && REGISTROS[x.registro] ? `<a href="${rutaRegistro(REGISTROS[x.registro])}">${esc(REGISTROS[x.registro].nombre)}</a>: ` : ''}${esc(x.resuelto)}</li>`).join('')}</ul></details>` : ''}
    </section>

    <section class="pj-sec" aria-labelledby="pend-t">
      <div class="sec-head"><h2 id="pend-t">Tarjetas sin clasificar</h2><span class="nota">${plural(pend.length + sinMapa.length, 'tarjeta', 'tarjetas')}</span></div>
      ${cards.length && !(pend.length + sinMapa.length) ? '<p class="vacio">No hay tarjetas pendientes de clasificar.</p>' : ''}
      ${cards.length && (pend.length + sinMapa.length) ? `<p class="nota">No figuran en la lista definitiva. Se conservan íntegras hasta que decidas: asignarlas a un macroobjetivo, archivarlas o dejarlas en el área a la que pertenecen.</p>
        ${[...pend, ...sinMapa].map(c => `<div class="pend-item"><p class="pend-sug">${esc((MAPA[c.id] || {}).sugerencia || 'Sin sugerencia.')}</p>${origenHtml(c)}</div>`).join('')}`
        : (cards.length ? '' : '<p class="vacio">Ejecuta la migración para ver las tarjetas del Kanban anterior.</p>')}
    </section>

    ${archivadas.length ? `<section class="pj-sec" aria-labelledby="arch-t">
      <div class="sec-head"><h2 id="arch-t">Archivadas</h2><span class="nota">${plural(archivadas.length, 'tarjeta', 'tarjetas')} fuera del seguimiento</span></div>
      <p class="nota">${esc(MAPA[archivadas[0].id].decision)}</p>
      ${archivadas.map(c => origenHtml(c)).join('')}
    </section>` : ''}`;
}
