/* Indicador de guardado compartido + ventana de nombre/PIN, cambios no aplicados e historial de cambios.
   Es independiente de cada aplicación: se monta en <body> y usa los colores del tablero si existen. */
import * as N from './nube.js';

const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hora = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
let nombres = {}, chip = null, dlg = null;

const CSS = `
.nube-chip{position:fixed;right:14px;bottom:14px;z-index:900;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 28px);padding:7px 12px;border-radius:20px;border:1px solid var(--line-hi,#454D46);background:var(--in-graphite,#202421);color:var(--text,#F1F0E8);font:600 13px/1.2 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer}
.nube-chip:focus-visible{outline:3px solid var(--in-orange,#F28C28);outline-offset:2px}
.nube-chip .p{width:9px;height:9px;border-radius:50%;background:#7fb86a;flex:none}
.nube-chip.aviso{border-color:var(--in-orange,#F28C28)} .nube-chip.aviso .p{background:var(--in-orange,#F28C28)}
.nube-chip.error .p{background:var(--in-err,#EF6B5E)} .nube-chip.neutro .p{background:#9AA39B}
.nube-dlg{width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 40px);padding:0;border:1px solid var(--line-hi,#454D46);border-radius:8px;background:var(--in-graphite,#202421);color:var(--text,#F1F0E8)}
.nube-dlg::backdrop{background:rgba(0,0,0,.55)}
.nube-dlg header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line,#353B36)}
.nube-dlg h2{margin:0;font-size:18px} .nube-dlg section{padding:12px 16px;border-bottom:1px solid var(--line,#353B36)}
.nube-dlg h3{margin:0 0 8px;font-size:15px} .nube-dlg p{margin:6px 0;font-size:14px;line-height:1.45}
.nube-dlg label{display:block;margin:8px 0;font-size:13px} .nube-dlg input{display:block;width:100%;margin-top:4px;padding:8px;border-radius:4px;border:1px solid var(--line-hi,#454D46);background:var(--in-carbon,#141615);color:inherit;font:inherit}
.nube-dlg button{font:700 13px system-ui,sans-serif;padding:7px 12px;border-radius:4px;border:1px solid var(--line-hi,#454D46);background:transparent;color:inherit;cursor:pointer}
.nube-dlg button.pri{background:var(--in-orange,#F28C28);border-color:var(--in-orange,#F28C28);color:#1A1206}
.nube-dlg .msg{min-height:1em;color:var(--in-err,#EF6B5E);font-size:13px} .nube-dlg .nota{color:var(--text-2,#C9CEC6);font-size:13px}
.nube-dlg ol{margin:0;padding-left:18px;max-height:260px;overflow:auto;font-size:13px} .nube-dlg li{margin:3px 0}
.nube-dlg .acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.nube-dlg pre{max-height:180px;overflow:auto;white-space:pre-wrap;font-size:12px;background:var(--in-carbon,#141615);padding:8px;border-radius:4px}`;

export function montar(nombresColecciones) {
  nombres = nombresColecciones || {};
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  chip = document.createElement('button'); chip.type = 'button'; chip.className = 'nube-chip neutro'; chip.setAttribute('aria-haspopup', 'dialog');
  chip.addEventListener('click', abrir); document.body.append(chip);
  dlg = document.createElement('dialog'); dlg.className = 'nube-dlg'; dlg.setAttribute('aria-labelledby', 'nube-t'); document.body.append(dlg);
  N.alCambiar(pintarChip); pintarChip(N.estado());
}

function pintarChip(s) {
  if (!chip) return;
  let t = '', cls = 'neutro';
  if (s.fase === 'sin-config') { t = 'Guardado solo en este navegador'; }
  else if (s.fase === 'inicial' || s.fase === 'conectando') t = 'Conectando con la base compartida…';
  else if (s.fase === 'error') { t = 'Sin conexión con la base compartida'; cls = 'error'; }
  else if (s.nubeVacia) { t = 'Base compartida vacía: falta la carga inicial'; cls = 'aviso'; }
  else if (s.enviando) t = 'Guardando para todos…';
  else if (s.pendientes && !s.desbloqueado) { t = `${s.pendientes} ${s.pendientes === 1 ? 'cambio' : 'cambios'} sin guardar · escribe tu PIN`; cls = 'aviso'; }
  else if (s.pendientes) { t = s.error ? `${s.pendientes} sin guardar · se reintentará` : 'Guardando…'; cls = s.error ? 'error' : 'aviso'; }
  else { t = `Guardado para todos${s.ultimo ? ` · ${hora(s.ultimo)}` : ''}`; cls = ''; }
  const na = N.noAplicados().length;
  chip.className = `nube-chip ${cls}`;
  chip.innerHTML = `<span class="p" aria-hidden="true"></span><span>${e(t)}${na ? ` · ${na} no aplicados` : ''}</span>`;
  chip.title = s.desbloqueado ? `Guardando como ${N.autor()}` : 'Leer es libre; para guardar cambios y ver teléfonos se pide el PIN';
}

export function abrir() {
  const s = N.estado(), na = N.noAplicados();
  dlg.innerHTML = `<header><h2 id="nube-t">Guardado compartido</h2><button type="button" data-n="cerrar" aria-label="Cerrar">×</button></header>
    <section>${s.fase === 'sin-config' ? '<p>La conexión con la base compartida no está configurada: los cambios se guardan solo en este navegador.</p>'
      : s.fase === 'error' ? `<p>No hay conexión con la base compartida. ${e(s.error)}</p><p class="nota">Tus cambios quedan guardados en este navegador y se enviarán al volver la conexión.</p>`
      : `<p>Los cambios se guardan solos y todos los ven al momento. Leer es libre; <b>para guardar y ver teléfonos</b> hace falta el PIN.</p>
         ${s.pendientes ? `<p><b>${s.pendientes} ${s.pendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'}</b> de enviar desde este navegador.</p>` : ''}`}</section>
    ${s.fase === 'listo' ? (s.desbloqueado
      ? `<section><p>Guardando como <b>${e(N.autor())}</b>. Los teléfonos están visibles.</p><div class="acc"><button type="button" data-n="salir">Cerrar sesión (ocultar teléfonos)</button></div></section>`
      : `<section><h3>Escribe tu nombre y el PIN</h3><form data-n="form" novalidate>
          <label>Tu nombre (queda registrado en cada cambio)<input name="nombre" maxlength="80" autocomplete="name" value="${e(N.autor())}" required></label>
          <label>PIN<input name="pin" type="password" autocomplete="off" inputmode="text" required></label>
          <p class="msg" data-n="msg" aria-live="polite"></p><div class="acc"><button type="submit" class="pri">Entrar</button></div></form>
          <p class="nota">El PIN se recuerda solo mientras esta pestaña esté abierta.</p></section>`) : ''}
    ${s.fase === 'listo' && s.nubeVacia ? `<section><h3>Carga inicial</h3><p>La base compartida todavía está vacía. Sube los datos de <b>este navegador</b> como punto de partida. Hazlo solo desde el navegador que tiene la información más completa y actualizada.</p>
      <div class="acc"><button type="button" class="pri" data-n="subir" ${s.desbloqueado ? '' : 'disabled title="Primero escribe tu nombre y el PIN"'}>Subir los datos de este navegador</button></div><p class="msg" data-n="msg-subir" aria-live="polite"></p></section>` : ''}
    ${na.length ? `<section><h3>Cambios no aplicados (${na.length})</h3><p class="nota">Tus versiones que no se guardaron porque otra persona cambió lo mismo antes. Revísalas y vuelve a hacer el cambio si sigue siendo necesario.</p>
      <ol>${na.slice().reverse().map(x => `<li><b>${e(nombres[x.coleccion] || x.coleccion)}</b> · ${e(x.id)} <span class="nota">${e(hora(x.fecha))}</span><details><summary>Ver tu versión</summary><pre>${e(JSON.stringify(x.datos, null, 1).slice(0, 4000))}</pre></details></li>`).join('')}</ol>
      <div class="acc"><button type="button" data-n="descartar">Ya los revisé: quitar de la lista</button></div></section>` : ''}
    ${N.copiaPrevia().length ? `<section><h3>Copia de este navegador antes de conectarse</h3><p class="nota">Al conectarse por primera vez, ${N.copiaPrevia().length} registros de este navegador eran distintos de la versión compartida. Se usó la compartida y lo que había aquí quedó guardado en esta copia, por si hace falta recuperar algo.</p>
      <div class="acc"><button type="button" data-n="copia">Descargar copia</button><button type="button" data-n="borrar-copia">Borrar copia</button></div></section>` : ''}
    ${s.fase === 'listo' ? '<section><h3>Historial de cambios</h3><div data-n="hist"><p class="nota">Cargando…</p></div></section>' : ''}`;
  dlg.showModal();
  const q = sel => dlg.querySelector(`[data-n="${sel}"]`);
  dlg.onclick = async ev => {
    const b = ev.target.closest('[data-n]'); if (ev.target === dlg) { dlg.close(); return; } if (!b) return;
    if (b.dataset.n === 'cerrar') dlg.close();
    if (b.dataset.n === 'salir') { N.bloquear(); abrir(); }
    if (b.dataset.n === 'descartar') { N.descartarNoAplicados(); pintarChip(N.estado()); abrir(); }
    if (b.dataset.n === 'copia') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(N.copiaPrevia(), null, 1)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `copia-navegador-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (b.dataset.n === 'borrar-copia') { if (confirm('¿Borrar la copia de este navegador? No se puede deshacer.')) { N.borrarCopiaPrevia(); abrir(); } }
    if (b.dataset.n === 'subir') {
      if (!confirm('¿Subir los datos de este navegador como punto de partida para todos?')) return;
      b.disabled = true; const m = q('msg-subir'); m.textContent = 'Subiendo…';
      try { await N.subirDatosIniciales(); m.textContent = ''; abrir(); } catch (er) { m.textContent = er.message; b.disabled = false; }
    }
  };
  const f = q('form');
  if (f) f.addEventListener('submit', async ev => {
    ev.preventDefault(); const m = q('msg'), btn = f.querySelector('button[type="submit"]');
    btn.disabled = true; m.textContent = 'Comprobando…';
    try { await N.desbloquear(f.elements.nombre.value, f.elements.pin.value); abrir(); }
    catch (er) { m.textContent = er.message; btn.disabled = false; f.elements.pin.value = ''; f.elements.pin.focus(); }
  });
  const h = q('hist');
  if (h) N.historial().then(l => {
    h.innerHTML = l.length ? `<ol>${l.map(x => `<li><span class="nota">${e(hora(x.fecha))}</span> <b>${e(x.autor)}</b> ${x.accion === 'crear' ? 'creó' : x.accion === 'borrar' ? 'eliminó' : 'modificó'} ${e(nombres[x.coleccion] || x.coleccion)} · ${e(x.registro_id)}${x.cambio_protegido ? ' <span class="nota">(incluye teléfonos)</span>' : ''}</li>`).join('')}</ol>` : '<p class="nota">Todavía no hay cambios registrados.</p>';
  }).catch(() => { h.innerHTML = '<p class="nota">No se pudo cargar el historial.</p>'; });
}
/* Para que las aplicaciones puedan pedir el PIN, por ejemplo al intentar ver un teléfono. */
export const pedirPin = () => abrir();
