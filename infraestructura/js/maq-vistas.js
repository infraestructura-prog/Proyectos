/* Máquinas de simulación · vistas (funciones puras que devuelven HTML).
   Ventanas: Resumen · Postventa · Stock (Equipos y kits | Repuestos) · Equipos en operación.
   La interfaz no muestra nombres de archivos, pestañas ni identificadores de hojas (solo «Actualizado» / «No se pudo actualizar»). */
import { esc, plural, migasHtml } from './componentes.js';
import { AREA } from './datos.js';
import * as D from './maq-datos.js';
import * as RP from './maq-repuestos.js';
import * as SY from './maq-sync.js';

export const VENTANAS = [
  { id: 'resumen', titulo: 'Resumen', ruta: '#/maquinas' },
  { id: 'postventa', titulo: 'Postventa', ruta: '#/maquinas/postventa' },
  { id: 'stock', titulo: 'Stock', ruta: '#/maquinas/stock' },
  { id: 'operacion', titulo: 'Equipos en operación', ruta: '#/maquinas/operacion' }
];
export const fdt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
export const pend = (t = 'Pendiente') => `<span class="mq-pend">${esc(t)}</span>`;
const IMG_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
/* Enlaces de Drive «/file/d/ID/view» no se muestran como imagen: se usa su miniatura pública. */
const imgSrc = u => { const m = String(u).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/); return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600` : u; };
export const imagenHtml = (u, cls = 'mq-img') => (u.imagen
  ? `<span class="${cls}"><img src="${esc(imgSrc(u.imagen))}" alt="Imagen de ${esc(u.codigo || u.id)}" loading="lazy" onerror="this.parentNode.classList.add('sin');this.remove()"><small>${IMG_SVG}Imagen pendiente</small></span>`
  : `<span class="${cls} sin"><small>${IMG_SVG}Imagen pendiente</small></span>`);
const condChip = c => `<span class="mq-chip c-${c === 'En stock' ? 'stock' : c === 'Vendida' ? 'vendida' : 'otra'}">${esc(c || 'Sin condición')}</span>`;
export const tipoTxt = u => D.TIPOS_UNIDAD[u.tipo] || u.tipo;

/* Cabecera común: migas, título y pestañas de las cuatro ventanas. */
export function cabecera(ventana, extraMiga) {
  const v = VENTANAS.find(x => x.id === ventana);
  return `${migasHtml([{ t: AREA.nombre, href: '#/objetivos' }, { t: 'Máquinas de simulación', href: '#/maquinas' }, ...(ventana === 'resumen' ? [] : [{ t: v.titulo, href: extraMiga ? v.ruta : '' }]), ...(extraMiga ? [{ t: extraMiga }] : [])].filter(x => x.t))}
    <header class="pj-head ficha-head mq-head">
      <p class="pg-kicker">${esc(AREA.nombre)} · Maquinaria</p>
      <h1 id="pg-titulo" tabindex="-1">${ventana === 'resumen' ? 'Máquinas de simulación' : esc(v.titulo)}</h1>
      <nav class="pj-tabs mq-tabs" aria-label="Ventanas de Máquinas de simulación">${VENTANAS.map(x => `<a href="${x.ruta}" ${x.id === ventana ? 'aria-current="page"' : ''}>${esc(x.titulo)}</a>`).join('')}</nav>
    </header>`;
}

/* Estado de la lectura de la hoja (sin nombres técnicos). */
export function estadoLectura() {
  const M = D.M;
  const txt = M.estado === 'cargando' ? 'Actualizando…'
    : M.estado === 'error' ? 'No se pudo actualizar y no hay datos guardados.'
      : M.desdeCache ? `No se pudo actualizar · se muestran los datos del ${fdt(M.leido)}`
        : M.leido ? `Actualizado · ${fdt(M.leido)}` : '';
  const base = `<div class="mq-estado ${M.desdeCache || M.estado === 'error' ? 'aviso-lectura' : ''}"><span>${esc(txt)}</span>
    <button type="button" class="btn btn-sm" data-act="maq-actualizar" ${M.estado === 'cargando' ? 'disabled' : ''}>Actualizar</button></div>`;
  return base + syncHtml();
}

/* Barra de información compartida: última sincronización, cambios pendientes de enviar y acceso al diálogo. */
export function syncHtml() {
  if (!SY.disponible()) return '';
  const m = SY.meta(), n = SY.pendientes().length, na = SY.noAplicados().length;
  const txt = !m ? 'Información compartida: todavía no sincronizaste este navegador. Los datos de clientes solo se ven con la clave.'
    : `Información compartida · última sincronización ${fdt(m.fecha)}`;
  return `<div class="mq-estado mq-sync ${!m || n ? 'aviso-lectura' : ''}"><span>${esc(txt)}${n ? ` · <b>${plural(n, 'cambio sin enviar', 'cambios sin enviar')}</b>` : m ? ' · todo enviado' : ''}${na ? ` · <b>${plural(na, 'cambio no aplicado', 'cambios no aplicados')}</b>` : ''}</span>
    <button type="button" class="btn btn-sm ${!m || n ? 'btn-primary' : ''}" data-act="sync-abrir">Sincronizar</button></div>`;
}

/* Diálogo de sincronización: clave (solo en memoria), nombre para el registro y cambios no aplicados. */
export function formSyncHtml(autor) {
  const n = SY.pendientes().length, na = SY.noAplicados(), m = SY.meta();
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Máquinas de simulación</p><h2 id="dlg-titulo">Sincronizar información compartida</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p>${n ? `Se enviarán <b>${plural(n, 'cambio', 'cambios')}</b> de este navegador y` : 'No hay cambios por enviar;'} se traerá lo que registraron los demás.</p>
      <p class="nota">Se abrirá una ventana de Google para confirmar tu sesión. Si otra persona cambió lo mismo antes, se conserva su versión y la tuya queda guardada aquí para revisarla.</p>
      ${SY.tieneClave() ? '<p class="nota">La clave ya está escrita en esta sesión.</p>' : `<label class="fld"><span>Clave <b class="req">*</b></span><input type="password" name="clave" autocomplete="off" required><small class="err" hidden>Escribe la clave.</small></label>`}
      <label class="fld"><span>Tu nombre (queda registrado junto a tus cambios)</span><input name="autor" maxlength="80" value="${esc(autor || '')}" autocomplete="name"></label>
      ${m ? `<p class="nota">Última sincronización: ${esc(fdt(m.fecha))}${m.autor ? ` · ${esc(m.autor)}` : ''}.</p>` : ''}
      ${na.length ? `<details class="mas"><summary>Cambios no aplicados (${na.length})</summary><p class="nota">Tus versiones que no se guardaron porque otra persona cambió lo mismo antes. Revisa y vuelve a hacer el cambio si sigue siendo necesario.</p>
        <ul class="vt-evid">${na.map(x => `<li><b>${esc(x.coleccion)}</b> · ${esc(x.id)} <small class="nota">${esc(fdt(x.fecha))}</small><details><summary>Ver tu versión</summary><pre class="pre sync-pre">${esc(x.datos ? JSON.stringify(JSON.parse(x.datos), null, 1).slice(0, 4000) : 'Lo habías eliminado.')}</pre></details></li>`).join('')}</ul>
        <button type="button" class="btn btn-sm btn-ghost" data-sync-descartar>Ya los revisé: quitar de la lista</button></details>` : ''}
      <p class="mq-form-msg" data-msg></p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Sincronizar</button></div>
  </form>`;
}

/* ── Ventanas aún no construidas: estado honesto, sin cifras ── */
export function pendienteHtml(ventana, texto) {
  return `${cabecera(ventana)}
    <section class="pj-sec mq-vacio"><h2>Información pendiente de levantar</h2><p>${esc(texto)}</p>
      <p class="nota">Esta ventana se construye en una próxima etapa de la reorganización.</p></section>`;
}

/* ═════════ Stock ═════════ */
export function stockHtml(S) {
  const sub = S.maqSub === 'repuestos' ? 'repuestos' : 'equipos';
  return `${cabecera('stock')}
    <nav class="mq-subtabs" aria-label="Stock"><a href="#/maquinas/stock" ${sub === 'equipos' ? 'aria-current="page"' : ''}>Equipos y kits</a><a href="#/maquinas/stock/repuestos" ${sub === 'repuestos' ? 'aria-current="page"' : ''}>Repuestos</a></nav>
    ${sub === 'repuestos' ? repuestosHtml(S) : equiposHtml(S)}`;
}

/* ═════════ Stock › Repuestos ═════════ */
const usd = n => (n === null || n === undefined ? '—' : `US$ ${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const num = (n, d = 0) => (n === null || n === undefined ? '—' : n.toLocaleString('es', { maximumFractionDigits: d }));
const repImg = r => imagenHtml({ imagen: r.imagen, codigo: r.descEs || r.ref, id: r.id });
function estadoRepuestos() {
  const R = RP.R;
  const txt = R.estado === 'cargando' ? 'Actualizando…' : R.estado === 'error' ? 'No se pudo actualizar y no hay datos guardados.'
    : R.desdeCache ? `No se pudo actualizar · se muestran los datos del ${fdt(R.leido)}` : R.leido ? `Actualizado · ${fdt(R.leido)}` : '';
  return `<div class="mq-estado ${R.desdeCache || R.estado === 'error' ? 'aviso-lectura' : ''}"><span>${esc(txt)}</span>
    <button type="button" class="btn btn-sm" data-act="rep-actualizar" ${R.estado === 'cargando' ? 'disabled' : ''}>Actualizar</button></div>`;
}
const existenciaHtml = r => (r.existencia === null ? pend('Sin dato') : `<b class="rp-exist ${r.existencia === 0 ? 'cero' : ''}">${num(r.existencia)}</b>`);
const marcas = r => [RP.tieneIncidencia(r) ? `<span class="mq-chip c-falta" title="Incidencia/garantía registrada en la hoja: ${esc(r.incidencia)}">Incidencia</span>` : '',
  RP.difiereRecibido(r) ? `<span class="mq-chip c-otra" title="Pedido ${num(r.pedido)}, recibido ${num(r.recibido)}">Recibido ≠ pedido</span>` : '',
  r.ajustada ? '<span class="mq-chip c-otra" title="La existencia se modificó en la aplicación">Ajustada</span>' : ''].filter(Boolean).join(' ');
function repuestosHtml(S) {
  const R = RP.R;
  if (R.estado === 'cargando' && !R.lista.length) return `${estadoRepuestos()}<p class="vacio">Cargando repuestos…</p>`;
  if (R.estado === 'error' && !R.lista.length) return `${estadoRepuestos()}<div class="aviso err">No se pudieron leer los repuestos. Revisa la conexión y pulsa «Actualizar».</div>`;
  const todos = RP.repuestos(), ind = RP.indicadores(todos), vista = S.repVista === 'tabla' ? 'tabla' : 'tarjetas';
  const q = String(S.repBusca || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const f = S.repFiltro || '';
  const lista = todos.filter(r => (!q || `${r.ref} ${r.descEs} ${r.descEn} ${r.ubicacion} ${r.compatibilidad}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q))
    && (!f || (f === 'sin' && r.existencia === 0) || (f === 'incidencia' && RP.tieneIncidencia(r)) || (f === 'diferencia' && RP.difiereRecibido(r))));
  return `${estadoRepuestos()}
    <ul class="mq-cifras" aria-label="Repuestos">
      <li><b>${ind.referencias}</b><span>Referencias</span></li>
      <li><b>${ind.sinExistencias}</b><span>Referencias sin existencias</span></li>
      <li><b>${ind.incidencias}</b><span>Con incidencia o garantía</span></li>
      <li><b>${ind.diferencias}</b><span>Recibido distinto de lo pedido</span></li>
    </ul>
    <div class="mq-barra">
      <div class="seg" role="group" aria-label="Vista">
        <button type="button" data-act="rep-vista" data-vista="tarjetas" aria-pressed="${vista === 'tarjetas'}">Tarjetas</button>
        <button type="button" data-act="rep-vista" data-vista="tabla" aria-pressed="${vista === 'tabla'}">Tabla</button></div>
      <label class="mq-filtro"><span class="sr-only">Buscar repuesto</span><input type="search" data-act="rep-busca" value="${esc(S.repBusca || '')}" placeholder="Buscar repuesto…" autocomplete="off"></label>
      <label class="mq-filtro"><span class="sr-only">Filtrar repuestos</span><select data-act="rep-filtro">
        ${[['', 'Todas las referencias'], ['sin', 'Sin existencias'], ['incidencia', 'Con incidencia'], ['diferencia', 'Recibido ≠ pedido']].map(([v, t]) => `<option value="${v}" ${f === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    ${!lista.length ? '<p class="vacio">No hay referencias con este filtro.</p>' : vista === 'tabla'
      // Vista simple (pedido de Cristian, 16/11): foto, nombre y cantidad en stock. Lo demás está en el detalle (clic en el nombre).
      ? `<div class="tabla-wrap"><table class="map-tabla mq-tabla rp-tabla"><thead><tr><th>Foto</th><th>Nombre</th><th>En stock</th></tr></thead><tbody>
        ${lista.map(r => `<tr><td class="rp-mini">${repImg(r)}</td>
          <td><button type="button" class="mq-link" data-act="rep-ficha" data-rid="${esc(r.id)}">${esc(r.descEs || r.descEn)}</button></td>
          <td>${existenciaHtml(r)}</td></tr>`).join('')}</tbody></table></div>`
      : `<ul class="mq-grid rp-grid">${lista.map(r => `<li class="mq-card">
          <button type="button" class="mq-card-btn" data-act="rep-ficha" data-rid="${esc(r.id)}" aria-label="Abrir ${esc(r.descEs || r.descEn)}">${repImg(r)}</button>
          <div class="mq-card-body">
            <h3 class="rp-titulo"><button type="button" class="mq-link" data-act="rep-ficha" data-rid="${esc(r.id)}">${esc(r.descEs || r.descEn)}</button></h3>
            <p class="rp-stock">En stock ${existenciaHtml(r)}</p>
          </div></li>`).join('')}</ul>`}`;
}

export function fichaRepuestoHtml(r) {
  const fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
  return `<div class="dlg-head"><div><p class="dlg-kicker">Repuesto</p><h2 id="dlg-titulo">${esc(r.descEs || r.descEn)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha">
      ${repImg(r).replace('class="mq-img', 'class="mq-img mq-img-lg')}
      <h3 class="rp-h">Existencia</h3>
      <dl class="org-dl">
        ${fila('Existencia actual', existenciaHtml(r) + (r.ajustada ? ' <span class="nota">(modificada en la aplicación)</span>' : ''))}
        ${r.ajustada && r.stockHoja !== r.existencia ? fila('Stock según la hoja', `${num(r.stockHoja)}${r.existenciaHojaAlAjustar !== null && r.existenciaHojaAlAjustar !== r.stockHoja ? ' <span class="mq-pend">La hoja cambió después del ajuste</span>' : ''}`) : ''}
        ${fila('Unidad de medida', r.unidad ? esc(r.unidad) : '<span class="nota">No documentada</span>')}
        ${fila('Ubicación', r.ubicacion ? esc(r.ubicacion) : '<span class="nota">Sin registrar</span>')}
        ${fila('Compatibilidad', r.compatibilidad ? esc(r.compatibilidad) : '<span class="nota">Sin registrar</span>')}
      </dl>
      <h3 class="rp-h">Compra y recepción</h3>
      <dl class="org-dl">
        ${fila('N.º en la lista de compra', esc(r.ref))}
        ${fila('Cantidad pedida', num(r.pedido))}
        ${fila('Cantidad recibida', `${num(r.recibido)}${RP.difiereRecibido(r) ? ' <span class="mq-chip c-otra">Distinta de lo pedido</span>' : ''}`)}
        ${fila('Incidencia / garantía', r.incidencia ? `<span class="mq-chip c-falta">${esc(r.incidencia)}</span>` : '<span class="nota">Ninguna registrada</span>')}
        ${r.pronosticado ? fila('Pronosticado', esc(r.pronosticado)) : ''}
      </dl>
      <h3 class="rp-h">Costos</h3>
      <dl class="org-dl">
        ${fila('Precio unitario', usd(r.precio))}${fila('Envío unitario', usd(r.envioUnit))}${fila('Costo unitario con envío', usd(r.costoConEnvio))}
        ${fila('Costo total de envío', usd(r.envioTotal))}${fila('Precio total', usd(r.total))}${fila('Volumen (CBM)', num(r.cbm, 4))}
      </dl>
      ${r.descEn ? `<p class="nota">Descripción en inglés: ${esc(r.descEn)}</p>` : ''}
      ${r.observaciones ? `<p class="pre">${esc(r.observaciones)}</p>` : ''}
      ${r.historial.length ? `<details class="mas"><summary>Historial (${r.historial.length})</summary><ol class="hist">${[...r.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol></details>` : ''}
    </div>
    <div class="dlg-foot"><button type="button" class="btn btn-ghost" data-ficha="datos">Editar ubicación y otros datos</button><span class="sp"></span>
      <button type="button" class="btn btn-primary" data-ficha="existencia">Cambiar existencia</button></div>`;
}
export function formExistenciaHtml(r) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Cambiar cantidad en stock</p><h2 id="dlg-titulo">${esc(r.descEs || r.descEn)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p>Existencia actual: <b>${r.existencia === null ? 'sin dato' : num(r.existencia)}</b>${r.ajustada ? ` · según la hoja: ${num(r.stockHoja)}` : ''}</p>
      <label class="fld"><span>Nueva existencia <b class="req">*</b></span><input name="existencia" type="number" min="0" step="1" inputmode="numeric" value="${r.existencia ?? ''}" required><small class="err" hidden></small></label>
      <label class="fld"><span>Motivo</span><input name="motivo" maxlength="300" autocomplete="off" placeholder="Conteo físico, uso en reparación, ingreso…"></label>
      <p class="nota">Se guarda en esta aplicación con su historial. La hoja de repuestos no se modifica.</p>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}
export function formRepuestoHtml(r) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Repuesto</p><h2 id="dlg-titulo">${esc(r.descEs || r.descEn)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <div class="fld-row">
        <label class="fld"><span>Ubicación</span><input name="ubicacion" maxlength="200" value="${esc(r.ubicacion)}" autocomplete="off" placeholder="Almacén, estante, gaveta…"></label>
        <label class="fld"><span>Unidad de medida</span><input name="unidad" maxlength="40" value="${esc(r.unidad)}" autocomplete="off" placeholder="unidad, par, juego…"></label>
      </div>
      <label class="fld"><span>Compatibilidad</span><input name="compatibilidad" maxlength="600" value="${esc(r.compatibilidad)}" autocomplete="off" placeholder="Solo si está confirmada"></label>
      <label class="fld"><span>Imagen (enlace https)</span><input name="imagen" type="url" maxlength="1000" value="${esc(r.imagen)}" autocomplete="off" placeholder="Pega el enlace cuando tengas la foto"><small class="err" hidden>El enlace debe empezar por https://</small></label>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="3" maxlength="2000">${esc(r.observaciones)}</textarea></label>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

function equiposHtml(S) {
  const M = D.M;
  if (M.estado === 'cargando' && !M.maquinas.length) return `${estadoLectura()}<p class="vacio">Cargando máquinas…</p>`;
  if (M.estado === 'error' && !M.maquinas.length) return `${estadoLectura()}<div class="aviso err">No se pudieron leer las máquinas. Revisa la conexión y pulsa «Actualizar».</div>`;
  const modo = S.maqModo === 'kits' ? 'kits' : 'individual', vista = S.maqVista === 'tabla' ? 'tabla' : 'tarjetas';
  const us = D.unidades(), ks = D.kits(), act = ks.filter(k => k.activo);
  const ev = act.map(k => D.evaluarKit(k)), suel = D.sueltas(), est = D.estimacionArmables();
  const cuenta = t => us.filter(u => u.tipo === t && u.condicion === 'En stock').length;
  const sop = us.filter(u => u.tipo === 'soporte');
  return `${estadoLectura()}
    <ul class="mq-cifras" aria-label="Existencias en stock">
      <li><b>${cuenta('maquina-cc')}</b><span>Máquinas con chapa en stock</span></li>
      <li><b>${cuenta('maquina-sc')}</b><span>Máquinas sin chapa en stock</span></li>
      <li>${sop.length ? `<b>${cuenta('soporte')}</b><span>Soportes en stock</span>` : `<b class="mq-nd">—</b><span>Soportes: información pendiente de levantar</span>`}</li>
      <li><b>${act.length}</b><span>Kits registrados · ${ev.filter(e => e.completo).length} completos · ${ev.filter(e => !e.completo).length} incompletos</span></li>
      <li><b>${suel.length}</b><span>Unidades sueltas (sin kit)</span></li>
    </ul>
    <div class="mq-barra">
      <div class="seg" role="group" aria-label="Modo de inventario">
        <button type="button" data-act="maq-modo" data-modo="individual" aria-pressed="${modo === 'individual'}">Individual</button>
        <button type="button" data-act="maq-modo" data-modo="kits" aria-pressed="${modo === 'kits'}">Kits</button></div>
      <div class="seg" role="group" aria-label="Vista">
        <button type="button" data-act="maq-vista" data-vista="tarjetas" aria-pressed="${vista === 'tarjetas'}">Tarjetas</button>
        <button type="button" data-act="maq-vista" data-vista="tabla" aria-pressed="${vista === 'tabla'}">Tabla</button></div>
      ${modo === 'individual' ? `<label class="mq-filtro"><span class="sr-only">Tipo de unidad</span><select data-act="maq-filtro-tipo">
          ${[['', 'Todos los tipos'], ['maquina-cc', 'Máquinas con chapa'], ['maquina-sc', 'Máquinas sin chapa'], ['soporte', 'Soportes'], ['sueltas', 'Solo unidades sueltas']].map(([v, t]) => `<option value="${v}" ${S.maqFiltro === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      <span class="sp"></span>
      ${modo === 'individual' ? `<button type="button" class="btn btn-sm" data-act="maq-nuevo-soporte">+ Agregar soporte</button>
        ${D.puedeEditarHoja() ? '<button type="button" class="btn btn-sm" data-act="maq-nueva-maquina">+ Agregar máquina</button>' : ''}`
        : '<button type="button" class="btn btn-sm btn-primary" data-act="maq-nuevo-kit">+ Nuevo kit</button>'}
    </div>
    ${modo === 'kits' ? kitsHtml(ks, vista, est) : individualHtml(us, vista, S.maqFiltro)}`;
}

/* ── Inventario individual ── */
function individualHtml(us, vista, filtro) {
  const lista = us.filter(u => !filtro || (filtro === 'sueltas' ? !D.kitDeUnidad(u.id) : u.tipo === filtro))
    .sort((a, b) => (a.tipo === 'soporte') - (b.tipo === 'soporte') || String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), 'es', { numeric: true }));
  if (!lista.length) return `<p class="vacio">${filtro === 'soporte' ? 'Aún no hay soportes registrados: información pendiente de levantar. Usa «Agregar soporte» para incorporarlos.' : 'No hay unidades con este filtro.'}</p>`;
  const kitTxt = u => { const k = D.kitDeUnidad(u.id); return k ? `<button type="button" class="mq-link" data-act="maq-ver-kit" data-kit="${esc(k.id)}">Kit ${esc(k.codigo)}</button>` : '<span class="nota">Sin kit</span>'; };
  if (vista === 'tabla') return `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Unidad</th><th>Tipo</th><th>Escalera</th><th>Serial</th><th>Condición</th><th>Kit</th><th>Ubicación</th><th>Estado operativo</th></tr></thead><tbody>
    ${lista.map(u => `<tr><td><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}"><b>${esc(u.codigo || u.id)}</b></button></td><td>${esc(tipoTxt(u))}</td>
      <td>${u.tipo === 'soporte' ? '<span class="nota">No aplica</span>' : esc(u.escalera || '—')}</td><td>${u.serial ? `<code>${esc(u.serial)}</code>` : pend('Sin serial')}</td>
      <td>${condChip(u.condicion)}</td><td>${kitTxt(u)}</td><td>${u.ubicacion ? esc(u.ubicacion) : pend('Ubicación pendiente')}</td><td>${u.estadoOperativo ? esc(u.estadoOperativo) : pend('Por confirmar')}</td></tr>`).join('')}
    </tbody></table></div>`;
  return `<ul class="mq-grid">${lista.map(u => `<li class="mq-card t-${esc(u.tipo)}">
      <button type="button" class="mq-card-btn" data-act="maq-ficha" data-uid="${esc(u.id)}" aria-label="Abrir la ficha de ${esc(u.codigo || u.id)}">${imagenHtml(u)}</button>
      <div class="mq-card-body">
        <p class="mq-tipo">${esc(tipoTxt(u))}</p>
        <h3><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}">${esc(u.codigo || u.id)}</button></h3>
        <dl class="mq-dl">
          ${u.tipo !== 'soporte' ? `<div><dt>Escalera</dt><dd>${esc(u.escalera || '—')}</dd></div>` : ''}
          <div><dt>Serial</dt><dd>${u.serial ? `<code>${esc(u.serial)}</code>` : pend('Sin serial')}</dd></div>
          <div><dt>Kit</dt><dd>${kitTxt(u)}</dd></div>
          <div><dt>Ubicación</dt><dd>${u.ubicacion ? esc(u.ubicacion) : pend('Pendiente')}</dd></div>
        </dl>
        <p>${condChip(u.condicion)}${u.estadoOperativo ? ` <span class="mq-chip c-otra">${esc(u.estadoOperativo)}</span>` : ''}</p>
      </div></li>`).join('')}</ul>`;
}

/* ── Kits ── */
function posicionHtml(k, p, u, editable) {
  // Solo unidades sueltas del tipo correcto; para las máquinas, con la escalera opuesta a la de su pareja en el kit.
  const par = (p.id === 'cc' || p.id === 'sc') && k.posiciones[p.id === 'cc' ? 'sc' : 'cc'] ? D.unidadPorId(k.posiciones[p.id === 'cc' ? 'sc' : 'cc']) : null;
  const opciones = () => D.sueltas().filter(x => x.tipo === p.tipo && (!par || D.opuestas(x, par))).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  return `<li class="mq-pos ${u ? 'ok' : 'falta'}"><span class="mq-pos-t">${esc(p.titulo)}</span>
    ${u ? `<span class="mq-pos-u"><button type="button" class="mq-link" data-act="maq-ficha" data-uid="${esc(u.id)}">${esc(u.codigo || u.id)}</button>
        ${u.tipo !== 'soporte' ? `<small>Escalera ${esc(u.escalera || '—')}${u.serial ? ` · ${esc(u.serial)}` : ' · sin serial'}</small>` : `<small>${u.serial ? esc(u.serial) : 'Identificador interno ' + esc(u.id)}</small>`}</span>
        ${editable ? `<button type="button" class="icon-btn sm" data-act="maq-quitar" data-kit="${esc(k.id)}" data-pos="${p.id}" aria-label="Quitar ${esc(u.codigo || u.id)} del kit ${esc(k.codigo)}">×</button>` : ''}`
      : `${pend('Posición pendiente')}${editable && opciones().length ? `<label class="sr-only" for="as-${esc(k.id)}-${p.id}">Asignar ${esc(p.titulo.toLowerCase())}</label>
        <select id="as-${esc(k.id)}-${p.id}" class="mq-asignar" data-act="maq-asignar" data-kit="${esc(k.id)}" data-pos="${p.id}"><option value="">Asignar…</option>${opciones().map(x => `<option value="${esc(x.id)}">${esc(x.codigo || x.id)}${x.escalera && x.tipo !== 'soporte' ? ` · ${esc(x.escalera)}` : ''}</option>`).join('')}</select>` : ''}`}
  </li>`;
}
function kitsHtml(ks, vista, est) {
  const act = ks.filter(k => k.activo), inact = ks.filter(k => !k.activo);
  const estimacion = `<aside class="mq-estim"><b>Estimación (no son kits registrados):</b> con las unidades sueltas en stock se podrían armar <b>${est.kits}</b> kit(s) más.
    <small>${plural(est.pares, 'pareja', 'parejas')} de máquinas con escaleras opuestas · ${plural(est.soportes, 'soporte libre', 'soportes libres')}${est.soportes < 2 ? ' (faltan soportes)' : ''}.</small></aside>`;
  if (!act.length) return `${estimacion}<p class="vacio">No hay kits registrados. Usa «Nuevo kit» para crear uno y asignarle unidades existentes.</p>`;
  const lista = act.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  const cuerpo = vista === 'tabla'
    ? `<div class="tabla-wrap"><table class="map-tabla mq-tabla"><thead><tr><th>Kit</th><th>Composición</th>${D.POSICIONES.map(p => `<th>${esc(p.titulo)}</th>`).join('')}<th>Disponibilidad</th></tr></thead><tbody>
      ${lista.map(k => { const e = D.evaluarKit(k); return `<tr><td><button type="button" class="mq-link" data-act="maq-ver-kit" data-kit="${esc(k.id)}"><b>${esc(k.codigo)}</b></button></td>
        <td><span class="mq-chip ${e.completo ? 'c-stock' : 'c-falta'}">${e.completo ? 'Completo' : `Incompleto · ${e.asignadas}/4`}</span></td>
        ${D.POSICIONES.map(p => `<td>${e.unidades[p.id] ? esc(e.unidades[p.id].codigo || e.unidades[p.id].id) : pend()}</td>`).join('')}<td>${esc(e.disponibilidad)}</td></tr>`; }).join('')}</tbody></table></div>`
    : `<ul class="mq-kits">${lista.map(k => {
      const e = D.evaluarKit(k);
      return `<li class="mq-kit ${e.completo ? 'completo' : ''}" id="kit-${esc(k.id)}">
        <div class="mq-kit-head"><h3>Kit ${esc(k.codigo)}</h3><span class="mq-chip ${e.completo ? 'c-stock' : 'c-falta'}">${e.completo ? 'Completo' : `Incompleto · ${e.asignadas} de 4`}</span></div>
        <p class="nota">Disponibilidad: ${esc(e.disponibilidad)}</p>
        <ul class="mq-pos-lista">${D.POSICIONES.map(p => posicionHtml(k, p, e.unidades[p.id], true)).join('')}</ul>
        ${e.avisos.length ? `<ul class="conf-list">${e.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
        <details class="mas" data-keep="kit-${esc(k.id)}"><summary>Detalle e historial</summary>
          <div class="mas-body">${k.origen ? `<p class="nota">${esc(k.origen)}</p>` : ''}${k.observaciones ? `<p>${esc(k.observaciones)}</p>` : ''}
            <ol class="hist">${[...k.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol>
            <button type="button" class="btn btn-sm btn-ghost fu-borrar" data-act="maq-desactivar-kit" data-kit="${esc(k.id)}">Desactivar kit (libera sus unidades)</button></div></details>
      </li>`; }).join('')}</ul>`;
  return `${estimacion}${cuerpo}${inact.length ? `<p class="nota">${plural(inact.length, 'kit desactivado', 'kits desactivados')} (se conservan con su historial).</p>` : ''}`;
}

/* ═════════ Fichas y formularios (ventana de diálogo) ═════════ */
export function fichaHtml(u) {
  const k = D.kitDeUnidad(u.id), hoja = u.origen === 'hoja';
  return `<div class="dlg-head"><div><p class="dlg-kicker">${esc(tipoTxt(u))}</p><h2 id="dlg-titulo">${esc(u.codigo || u.id)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">×</button></div>
    <div class="dlg-body mq-ficha">
      ${imagenHtml(u, 'mq-img mq-img-lg')}
      <dl class="org-dl">
        <div><dt>Identificador interno</dt><dd><code>${esc(u.id)}</code></dd></div>
        <div><dt>Tipo</dt><dd>${esc(tipoTxt(u))}</dd></div>
        ${hoja ? `<div><dt>Categoría</dt><dd>${esc(u.categoria || '—')}</dd></div><div><dt>Lado de la escalera</dt><dd>${esc(u.escalera || '—')}</dd></div>` : ''}
        <div><dt>Serial</dt><dd>${u.serial ? `<code>${esc(u.serial)}</code>` : (hoja ? pend('Sin serial') : '<span class="nota">Sin serial (se usa el identificador interno)</span>')}</dd></div>
        <div><dt>Condición comercial</dt><dd>${condChip(u.condicion)}</dd></div>
        <div><dt>Estado operativo</dt><dd>${u.estadoOperativo ? esc(u.estadoOperativo) : pend('Por confirmar')}</dd></div>
        <div><dt>Marca / modelo</dt><dd>${u.marca || u.modelo ? esc([u.marca, u.modelo].filter(Boolean).join(' · ')) : pend('Sin datos')}</dd></div>
        <div><dt>Ubicación</dt><dd>${u.ubicacion ? esc(u.ubicacion) : pend('Ubicación pendiente')}</dd></div>
        <div><dt>Kit</dt><dd>${k ? `Kit ${esc(k.codigo)}` : '<span class="nota">Sin kit (unidad suelta)</span>'}</dd></div>
        ${u.observaciones ? `<div><dt>Observaciones</dt><dd class="pre">${esc(u.observaciones)}</dd></div>` : ''}
      </dl>
      ${hoja ? '<p class="nota">Categoría, serial, escalera, condición e imagen vienen de la hoja de máquinas; marca, modelo, ubicación, estado operativo y observaciones se guardan en esta aplicación.</p>' : ''}
      ${(u.historial || []).length ? `<details class="mas"><summary>Historial (${u.historial.length})</summary><ol class="hist">${[...u.historial].reverse().map(h => `<li><span class="nota">${esc(fdt(h.fecha))}</span> ${esc(h.nota)}</li>`).join('')}</ol></details>` : ''}
    </div>
    <div class="dlg-foot">
      ${hoja && D.puedeEditarHoja() ? `<button type="button" class="btn btn-ghost" data-ficha="hoja">Editar datos de la hoja</button>` : ''}
      ${!hoja && !k && !u.instalada ? `<button type="button" class="btn btn-ghost tk-borrar" data-ficha="borrar">Eliminar soporte</button>` : ''}
      <span class="sp"></span>
      <button type="button" class="btn btn-primary" data-ficha="editar">${hoja ? 'Editar datos complementarios' : 'Editar soporte'}</button>
    </div>`;
}

const opc = (lista, act, vacio) => `${vacio ? `<option value="">${esc(vacio)}</option>` : ''}${lista.map(x => `<option ${x === act ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
export function formComplementoHtml(u, soporte) {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${soporte ? (u.id ? 'Editar soporte' : 'Nuevo soporte') : 'Datos complementarios'}</p><h2 id="dlg-titulo">${soporte && !u.id ? 'Agregar soporte' : esc(u.codigo || u.id)}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      ${soporte ? `<label class="fld"><span>Código interno <b class="req">*</b></span><input name="codigo" maxlength="60" value="${esc(u.codigo || '')}" required autocomplete="off" placeholder="Por ejemplo, SOP-01"><small class="err" hidden>Escribe el código interno del soporte.</small></label>
        <label class="fld"><span>Serial</span><input name="serial" maxlength="80" value="${esc(u.serial || '')}" autocomplete="off" placeholder="Solo si el soporte tiene uno"></label>` : ''}
      <div class="fld-row">
        <label class="fld"><span>Marca</span><input name="marca" maxlength="120" value="${esc(u.marca || '')}" autocomplete="off"></label>
        <label class="fld"><span>Modelo</span><input name="modelo" maxlength="120" value="${esc(u.modelo || '')}" autocomplete="off"></label>
      </div>
      <div class="fld-row">
        <label class="fld"><span>Ubicación</span><input name="ubicacion" maxlength="200" value="${esc(u.ubicacion || '')}" autocomplete="off" placeholder="Almacén, estante…"></label>
        <label class="fld"><span>Estado operativo</span><select name="estadoOperativo">${opc(D.ESTADOS_OPERATIVOS, u.estadoOperativo, 'Por confirmar')}</select></label>
        ${soporte ? `<label class="fld"><span>Condición comercial</span><select name="condicion">${opc(['En stock', 'Vendida'], u.condicion || 'En stock')}</select></label>` : ''}
      </div>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="3" maxlength="2000">${esc(u.observaciones || '')}</textarea></label>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

/* Edición de los datos que viven en la hoja (Apps Script existente con clave). */
export function formHojaHtml(u) {
  const v = u || { codigo: '', categoria: '', serial: '', escalera: '', condicion: 'En stock', imagen: '' };
  const radios = (name, ops, act) => `<div class="radios">${ops.map(o => `<label class="check"><input type="radio" name="${name}" value="${esc(o)}" ${o === act ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">${u ? 'Datos de la hoja' : 'Nueva máquina'}</p><h2 id="dlg-titulo">${u ? esc(u.codigo) : 'Agregar máquina'}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Se guarda directamente en la hoja de máquinas. Pide iniciar sesión en Google y la clave de edición.</p>
      <label class="fld"><span>Codificación <b class="req">*</b></span><input name="codificacion" maxlength="60" value="${esc(v.codigo)}" required autocomplete="off" placeholder="A - CC - DER"><small class="err" hidden>Escribe la codificación.</small></label>
      <label class="fld"><span>Serial</span><input name="serial" maxlength="80" value="${esc(v.serial)}" autocomplete="off" placeholder="Vacío si no tiene"></label>
      <fieldset class="fld"><legend>Categoría <b class="req">*</b></legend>${radios('categoria', ['Con chapa', 'Sin chapa'], v.categoria)}<small class="err" hidden>Elige la categoría.</small></fieldset>
      <fieldset class="fld"><legend>Lado de la escalera <b class="req">*</b></legend>${radios('escalera', ['Derecha', 'Izquierda'], v.escalera)}<small class="err" hidden>Elige el lado de la escalera.</small></fieldset>
      <fieldset class="fld"><legend>Condición <b class="req">*</b></legend>${radios('condicion', ['En stock', 'Vendida'], v.condicion)}</fieldset>
      <label class="fld"><span>Imagen (enlace https)</span><input name="imagen" type="url" maxlength="1000" value="${esc(v.imagen)}" autocomplete="off" placeholder="https://…"></label>
      ${D.tieneClave() ? '' : `<label class="fld"><span>Clave de edición <b class="req">*</b></span><input name="clave" type="password" autocomplete="off"><small class="err" hidden>Escribe la clave de edición.</small></label>`}
      <div class="mq-form-msg" data-msg></div>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar en la hoja</button></div>
  </form>`;
}

export function formKitHtml() {
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Kits</p><h2 id="dlg-titulo">Nuevo kit</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <p class="nota">Un kit agrupa unidades que ya existen: máquina con chapa, máquina sin chapa (con escaleras opuestas) y dos soportes. Se crea vacío y luego se asignan sus unidades.</p>
      <label class="fld"><span>Código del kit <b class="req">*</b></span><input name="codigo" maxlength="40" required autocomplete="off"><small class="err" hidden></small></label>
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="2" maxlength="2000"></textarea></label>
    </div>
    <div class="dlg-foot"><button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Crear kit</button></div>
  </form>`;
}
