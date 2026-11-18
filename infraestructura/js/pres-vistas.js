/* Presupuestos · vistas. Prioridad visual: total → alcance → desglose → pendientes → documentos.
   Lo técnico (materiales, condiciones, documentos, pendientes) va en desplegables cerrados. */
import { esc, plural, migasHtml } from './componentes.js';
import { AREA, REGISTROS } from './datos.js';
import { rutaRegistro } from './rutas.js';
import * as PR from './pres-datos.js';

const fmt = n => (n === null || n === undefined ? '' : n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const usd = (n, mon = 'USD') => (n === null || n === undefined ? '<span class="mq-pend">Importe pendiente</span>' : `${esc(mon)} ${fmt(n)}`);
const fd = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const fdt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const chipEstado = e => `<span class="pr-estado pr-e-${{ 'Borrador': 'bor', 'Por revisar': 'rev', 'Aprobado': 'ok', 'Requiere ajustes': 'aj', 'No aprobado': 'no' }[e] || 'rev'}">${esc(e)}</span>`;
const proyecto = pr => (pr.proyectoId && REGISTROS[pr.proyectoId] ? { ...REGISTROS[pr.proyectoId], id: pr.proyectoId } : null);
const cab = (extra) => `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: 'Presupuestos', href: extra ? '#/presupuestos' : '' }, ...(extra ? [{ t: extra }] : [])].filter(x => x.t))}`;

/* ── Listado ── */
export function listadoHtml() {
  const l = PR.presupuestos();
  return `${cab()}
    <header class="pj-head ficha-head"><p class="pg-kicker">${esc(AREA.nombre)} · Intervenciones y servicios</p><h1 id="pg-titulo" tabindex="-1">Presupuestos</h1>
      <p class="nota">Propuestas de trabajos con su costo estimado, lo que incluyen y lo que falta confirmar.</p></header>
    ${l.length ? `<ul class="pr-grid">${l.map(tarjeta).join('')}</ul>` : '<p class="vacio">Todavía no hay presupuestos registrados.</p>'}
    <p class="nota pr-local">Los cambios se guardan para todo el equipo (piden el PIN y tu nombre).</p>`;
}
function tarjeta(pr) {
  const c = PR.calcular(pr), m = c.principal;
  return `<li class="pr-card"><div class="pr-card-body">
    <div class="pr-card-top">${chipEstado(pr.estado)}${pr.cambioPendiente ? ' <span class="pr-chip-aviso">Cambio pendiente de revisión</span>' : ''}</div>
    <h3><a class="pr-link" href="#/presupuestos/${encodeURIComponent(pr.id)}">${esc(pr.titulo)}</a></h3>
    <p class="pr-desc">${esc(pr.descripcion)}</p>
    <p class="pr-total-mini">${m ? usd(m.total, pr.moneda) : '<span class="mq-pend">Importe pendiente</span>'}${m && !m.completo ? ' <small class="nota">(faltan importes)</small>' : ''}${c.modalidades.length > 1 ? ' <small class="nota">· hay otra modalidad de pago</small>' : ''}</p>
    <p class="nota">Actualizado el ${esc(fdt(pr.actualizado))}</p>
    <p><a class="btn btn-primary btn-sm" href="#/presupuestos/${encodeURIComponent(pr.id)}">Ver presupuesto</a></p>
  </div></li>`;
}

/* ── Ficha ── */
export function fichaHtml(id) {
  const pr = PR.porId(id);
  if (!pr) return `${cab('No encontrado')}<p class="vacio">El presupuesto no existe. <a href="#/presupuestos">Volver a Presupuestos</a></p>`;
  const c = PR.calcular(pr), m = c.principal, alt = c.modalidades.filter(x => !x.principal), proy = proyecto(pr), a = pr.aprobacion;
  const ev = PR.evidencias(pr.id);
  return `${cab(pr.titulo)}
    <p><a class="pr-volver" href="#/presupuestos">← Volver a Presupuestos</a></p>
    <header class="pj-head ficha-head pr-head"><p class="pg-kicker">Presupuesto ${pr.proyectoId && proy ? `· ${esc(proy.nombre)}` : ''}</p>
      <h1 id="pg-titulo" tabindex="-1">${esc(pr.titulo)}</h1>
      <p class="pr-desc">${esc(pr.descripcion)}</p>
      <p>${chipEstado(pr.estado)} <small class="nota">Actualizado el ${esc(fdt(pr.actualizado))}</small></p>
      <div class="pr-acc"><button type="button" class="btn btn-sm" data-act="pr-editar" data-pid="${esc(pr.id)}">Editar</button>${pr.estado !== 'Aprobado' ? `<button type="button" class="btn btn-sm btn-primary" data-act="pr-aprobar" data-pid="${esc(pr.id)}">Registrar aprobación</button>` : ''}</div>
    </header>
    ${pr.cambioPendiente ? `<p class="pr-aviso pr-aviso-fuerte">Cambio económico pendiente de revisión: la aprobación anterior (${esc(pr.cambioPendiente.modalidadAprobada)}, ${usd(pr.cambioPendiente.totalAprobado, pr.moneda)}) ya no aplica.</p>` : ''}
    ${a ? `<p class="pr-aviso pr-aviso-ok">Aprobado el ${esc(fd(a.fecha))} por ${esc(a.por)} · modalidad «${esc(a.modalidadNombre)}» · ${usd(a.total, pr.moneda)}. La aprobación no significa que la obra se ejecutó ni que se pagó.</p>` : ''}
    ${pr.pendientes.length ? '<p class="pr-aviso">Pendiente de validar materiales y condiciones finales.</p>' : ''}

    <div class="${ev ? 'pr-cuerpo' : ''}"><div class="pr-princ">
    <section class="pr-total" aria-labelledby="pr-t"><h2 id="pr-t">Costo estimado</h2>
      <p class="pr-total-num">${m ? usd(m.total, pr.moneda) : '<span class="mq-pend">Importe pendiente</span>'}</p>
      ${m && !m.completo ? `<p class="pr-aviso">Total incompleto: ${plural(c.faltan, 'partida sin importe', 'partidas sin importe')}. No se cuentan como cero.</p>` : ''}
      ${m && m.nota ? `<p class="pr-aclara">${esc(m.nota)}</p>` : ''}
    </section>

    <section class="pj-sec pr-sec" aria-labelledby="pr-alc"><h2 id="pr-alc">Qué se hará</h2>
      ${pr.alcance.length ? `<ol class="pr-alcance">${pr.alcance.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<p class="vacio">Alcance pendiente de describir.</p>'}
      ${pr.alcanceNota ? `<p class="nota">${esc(pr.alcanceNota)}</p>` : ''}
      <p class="nota">Duración, fecha de inicio y garantía del servicio: no informadas.</p>
    </section>

    <section class="pj-sec pr-sec" aria-labelledby="pr-des"><h2 id="pr-des">Desglose</h2>
      <dl class="pr-desglose">
        ${pr.partidas.map(p => `<div><dt>${esc(p.concepto)}${p.cantidad !== null ? ` <small class="nota">${fmt(p.cantidad).replace(/,00$/, '')} × ${pr.moneda} ${fmt(p.precioUnitario)}</small>` : ''}</dt><dd>${usd(PR.valorPartida(p), pr.moneda)}</dd></div>`).join('')}
        <div class="pr-sub"><dt>Subtotal materiales y flete</dt><dd>${usd(c.subtotal, pr.moneda)}${c.faltan ? ' <small class="nota">(parcial)</small>' : ''}</dd></div>
        ${m ? `<div><dt>Mano de obra</dt><dd>${usd(m.manoObra, pr.moneda)}</dd></div>` : ''}
        <div class="pr-tot"><dt>Total estimado</dt><dd>${m ? usd(m.total, pr.moneda) : '—'}</dd></div>
      </dl>
    </section>

    ${alt.map(x => `<details class="pr-det"><summary>${esc(x.nombre)}</summary>
      ${x.nota ? `<p>${esc(x.nota)}</p>` : ''}
      <dl class="pr-desglose">
        <div><dt>Materiales y flete</dt><dd>${usd(c.subtotal, pr.moneda)}</dd></div>
        <div><dt>Mano de obra</dt><dd>${x.manoObra === null ? '<span class="mq-pend">Importe pendiente</span>' : `${x.equivalente ? 'equivalente en bolívares a ' : ''}${usd(x.manoObra, pr.moneda)}`}</dd></div>
        <div class="pr-tot"><dt>Total de referencia${x.equivalente ? ` (en ${esc(pr.moneda)} equivalentes)` : ''}</dt><dd>${usd(x.total, pr.moneda)}</dd></div>
      </dl>
      <p class="nota">Es una alternativa a la modalidad principal: los totales no se suman.${x.equivalente ? ' Este total es una referencia comparativa: no significa que todo se pague en bolívares ni todo en dólares. No se calcula un monto en bolívares sin tasa, fecha y condición acordadas.' : ''}</p>
    </details>`).join('')}

    ${pr.pendientes.length ? `<details class="pr-det"><summary>Pendientes de confirmación (${pr.pendientes.length})</summary>
      <ul>${pr.pendientes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    <details class="pr-det"><summary>Materiales y especificaciones</summary>
      ${pr.materiales.length ? `<ul>${pr.materiales.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="vacio">Sin lista de materiales.</p>'}
      ${pr.materialesNota ? `<p class="nota">${esc(pr.materialesNota)}</p>` : ''}</details>

    ${pr.observaciones ? `<section class="pj-sec pr-sec"><h2>Observaciones</h2><p class="pre">${esc(pr.observaciones)}</p></section>` : ''}
    ${proy ? `<p class="nota pr-proy">Proyecto relacionado: <a href="${rutaRegistro(proy)}">${esc(proy.nombre)}</a> (Mejorar el taller). La aprobación del presupuesto no cambia el estado del proyecto.</p>` : ''}
    </div>
    ${ev ? `<aside class="pj-sec pr-sec pr-lateral" aria-labelledby="pr-ev"><h2 id="pr-ev">Evidencia del estado actual</h2>
      <p class="nota">Fotos y videos del ${esc(fd(ev.fecha))}. Toca una foto para verla en grande.</p>
      <ul class="pr-evid">${ev.archivos.map(x => x.tipo === 'video'
        ? `<li><video controls preload="none" playsinline poster="${esc(x.portada || '')}" src="${esc(x.src)}" aria-label="${esc(x.texto)}"></video></li>`
        : `<li><a href="${esc(x.src)}" target="_blank" rel="noopener"><img src="${esc(x.src)}" alt="${esc(x.texto)}" loading="lazy"></a></li>`).join('')}</ul>
    </aside>` : ''}
    </div>
    <p class="nota pr-local">Los cambios se guardan para todo el equipo (piden el PIN y tu nombre).</p>`;
}

/* Bloque para la página del proyecto: apunta al mismo registro, sin copiarlo. */
export function enlaceProyectoHtml(pid) {
  const l = PR.deProyecto(pid); if (!l.length) return '';
  return `<section class="pj-sec pr-sec" aria-labelledby="pr-proy-t"><h2 id="pr-proy-t">Presupuesto</h2><ul class="pr-docs">${l.map(pr => { const m = PR.calcular(pr).principal;
    return `<li><a href="#/presupuestos/${encodeURIComponent(pr.id)}"><b>${esc(pr.titulo)}</b></a> · ${m ? usd(m.total, pr.moneda) : 'importe pendiente'} · ${chipEstado(pr.estado)}</li>`; }).join('')}</ul></section>`;
}

/* ── Formularios ── */
const filaPartida = (p = {}) => `<fieldset class="pr-partida" data-partida data-id="${esc(p.id || '')}"><legend class="sr-only">Partida</legend>
  <input name="concepto" maxlength="200" value="${esc(p.concepto || '')}" placeholder="Concepto" aria-label="Concepto">
  <input name="cantidad" inputmode="decimal" value="${p.cantidad ?? ''}" placeholder="Cant." aria-label="Cantidad">
  <input name="precioUnitario" inputmode="decimal" value="${p.precioUnitario ?? ''}" placeholder="Precio unit." aria-label="Precio unitario">
  <input name="importe" inputmode="decimal" value="${p.importe ?? ''}" placeholder="Importe" aria-label="Importe (si no hay cantidad y precio)">
  <button type="button" class="icon-btn sm" data-pr-quitar aria-label="Quitar partida">×</button></fieldset>`;
export const filaPartidaHtml = filaPartida;
const filaDoc = (d = {}) => `<fieldset class="pr-doc" data-doc data-id="${esc(d.id || '')}"><legend class="sr-only">Documento</legend>
  <input name="tipo" maxlength="120" value="${esc(d.tipo || '')}" placeholder="Tipo (cotización, fotos…)" aria-label="Tipo de documento">
  <input name="referencia" maxlength="200" value="${esc(d.referencia || '')}" placeholder="Referencia o número" aria-label="Referencia">
  <input name="enlace" maxlength="600" value="${esc(d.enlace || '')}" placeholder="Enlace https:// (solo si el archivo está disponible)" aria-label="Enlace al documento">
  <button type="button" class="icon-btn sm" data-pr-quitar aria-label="Quitar documento">×</button></fieldset>`;
export const filaDocHtml = filaDoc;
export function formEditarHtml(pr, autor) {
  const area = (n, t, v, rows = 3, hint = '') => `<label class="fld"><span>${t}${hint ? ` <small class="nota">${hint}</small>` : ''}</span><textarea name="${n}" rows="${rows}">${esc(v || '')}</textarea></label>`;
  return `<form class="dlg-form pr-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Presupuesto</p><h2 id="dlg-titulo">Editar «${esc(pr.titulo)}»</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="pr-preview" data-preview aria-live="polite"></p>
      <label class="fld"><span>Nombre</span><input name="titulo" maxlength="160" value="${esc(pr.titulo)}"></label>
      ${area('descripcion', 'Descripción', pr.descripcion, 2)}
      <div class="fld-row">
        <label class="fld"><span>Estado</span><select name="estado">${PR.ESTADOS.map(e => `<option ${e === pr.estado ? 'selected' : ''} ${e === 'Aprobado' && pr.estado !== 'Aprobado' ? 'disabled' : ''}>${esc(e)}</option>`).join('')}</select></label>
        <label class="fld"><span>Fecha del antecedente</span><input type="date" name="fechaAntecedente" value="${esc(pr.fechaAntecedente)}"></label>
        <label class="fld"><span>Vigencia</span><input name="vigencia" maxlength="200" value="${esc(pr.vigencia)}"></label>
      </div>
      <fieldset class="fld"><legend>Partidas de materiales y flete</legend>
        <p class="hint">Usa cantidad × precio unitario, o solo el importe. Deja vacío lo que no se conoce: queda como pendiente, no como cero. El IVA ya incluido no se suma aparte.</p>
        <div data-partidas>${pr.partidas.map(filaPartida).join('')}</div>
        <button type="button" class="btn btn-sm" data-pr-agregar-partida>+ Agregar partida</button></fieldset>
      <fieldset class="fld"><legend>Modalidades de pago (alternativas, no se suman)</legend>
        ${pr.modalidades.map(m => `<div class="pr-mod" data-mod="${esc(m.id)}"><div class="fld-row">
          <label class="fld"><span>Nombre${m.principal ? ' (principal)' : ''}</span><input name="mod-nombre" maxlength="80" value="${esc(m.nombre)}"></label>
          <label class="fld"><span>Mano de obra (${esc(pr.moneda)}${m.equivalente ? ' equivalentes' : ''})</span><input name="mod-mano" inputmode="decimal" value="${m.manoObra ?? ''}"></label></div>
          <label class="fld"><span>Aclaración</span><textarea name="mod-nota" rows="2">${esc(m.nota || '')}</textarea></label></div>`).join('')}
      </fieldset>
      ${area('alcance', 'Qué se hará', pr.alcance.join('\n'), 5, 'un paso por línea')}
      <label class="fld"><span>Nota del alcance</span><input name="alcanceNota" maxlength="400" value="${esc(pr.alcanceNota || '')}"></label>
      ${area('pendientes', 'Pendientes de confirmación', pr.pendientes.join('\n'), 5, 'uno por línea')}
      ${area('materiales', 'Materiales y especificaciones', pr.materiales.join('\n'), 5, 'uno por línea')}
      ${area('materialesNota', 'Nota de materiales', pr.materialesNota, 2)}
      ${area('condicionesPago', 'Condiciones de pago', pr.condicionesPago, 2)}
      <fieldset class="fld"><legend>Cotizaciones y documentos</legend>
        <p class="hint">Agrega el enlace solo si el archivo está realmente disponible. Sin enlace se muestra «Documento pendiente de incorporar».</p>
        <div data-docs>${pr.documentos.map(filaDoc).join('')}</div>
        <button type="button" class="btn btn-sm" data-pr-agregar-doc>+ Agregar documento</button></fieldset>
      ${area('observaciones', 'Observaciones', pr.observaciones, 2)}
      <div class="fld-row"><label class="fld"><span>Motivo del cambio</span><input name="motivo" maxlength="300" placeholder="Ej.: nueva cotización del herrero"></label>
        <label class="fld"><span>Registrado por</span><input name="autor" maxlength="80" value="${esc(autor || '')}" autocomplete="name"></label></div>
      ${pr.aprobacion ? '<p class="pr-aviso">Está aprobado: si cambias partidas, mano de obra o moneda, la aprobación dejará de aplicar y volverá a «Por revisar».</p>' : ''}
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
export function formAprobarHtml(pr, autor) {
  const c = PR.calcular(pr);
  const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${esc(pr.titulo)}</p><h2 id="dlg-titulo">Registrar aprobación</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Registra una aprobación ya confirmada. No ejecuta la obra, no efectúa pagos, no envía mensajes ni cambia el estado del proyecto.</p>
      <fieldset class="fld"><legend>Modalidad aprobada <b class="req">*</b></legend>
        ${c.modalidades.map(m => `<label class="check"><input type="radio" name="modalidad" value="${esc(m.id)}" ${m.completo ? '' : 'disabled'}> ${esc(m.nombre)} · ${m.total === null ? 'importe pendiente' : `${esc(pr.moneda)} ${fmt(m.total)}${m.equivalente ? ' equivalentes' : ''}`}</label>`).join('')}</fieldset>
      <div class="fld-row">
        <label class="fld"><span>Quién la confirmó <b class="req">*</b></span><input name="por" maxlength="120" autocomplete="off"></label>
        <label class="fld"><span>Fecha <b class="req">*</b></span><input type="date" name="fecha" value="${hoy}" max="${hoy}"></label>
      </div>
      <label class="fld"><span>Nota</span><textarea name="nota" rows="2" maxlength="600"></textarea></label>
      <input type="hidden" name="autor" value="${esc(autor || '')}">
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar aprobación</button></div>
  </form>`;
}
