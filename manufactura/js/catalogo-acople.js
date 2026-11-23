/* Catálogos de motos y parrillas: agregar y editar tarjetas.
   Los datos del estudio (datos/investigaciones/acople-nodo-moto.json) no se tocan: lo que se agrega o edita aquí
   se guarda aparte (una copia completa de cada tarjeta) y se combina al mostrar. Al guardar, la tarjeta editada
   reemplaza a la del estudio con el mismo identificador; las nuevas se agregan al final.
   Se comparte con el guardado compartido (colecciones «acople-motos» y «acople-parrillas»). */
import { esc } from './componentes.js';

const PREF = 'ccs-manufactura-v1:';
export const CLAVES = { motos: PREF + 'acople-motos', parrillas: PREF + 'acople-parrillas' };
const leer = k => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string') : []; } catch { return []; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const TIPOS_PAR = { 'anunciada-original': 'Anunciada como original', 'original-verificada': 'Original verificada', generica: 'Genérica', reforzada: 'Reforzada', pendiente: 'Pendiente de verificar' };
export const VARIANTES = { nueva: 'Nueva', antigua: 'Antigua', 'por-precisar': 'Por precisar' };
export const VALIDACION = { 'sin-probar': 'Montaje pendiente de validación física', compatible: 'Compatible directamente', adaptador: 'Requiere adaptador', incompatible: 'Incompatible' };

/* Datos del estudio + lo agregado o editado. */
export function mezclar(d) {
  if (!d || !Array.isArray(d.motos)) return d;
  const une = (base, ed) => { const out = base.map(x => ed.find(y => y.id === x.id) || x); ed.forEach(y => { if (!base.some(x => x.id === y.id)) out.push(y); }); return out; };
  return { ...d, motos: une(d.motos, leer(CLAVES.motos)), parrillas: une(d.parrillas || [], leer(CLAVES.parrillas)) };
}

function guardar(clave, reg) {
  const l = leer(clave), i = l.findIndex(x => x.id === reg.id);
  if (i >= 0) l[i] = reg; else l.push(reg);
  return escribir(clave, l);
}
function quitar(clave, id) { return escribir(clave, leer(clave).filter(x => x.id !== id)); }

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const slug = s => str(s, 80).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const https = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const opciones = (mapa, sel) => Object.entries(mapa).map(([v, t]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
const marcaEdicion = (autor) => ({ fecha: new Date().toISOString(), por: autor || '' });

/* Foto: se reduce en el navegador (máx. 900 px, JPEG) para que quepa en el guardado compartido. */
function leerFoto(file) {
  return new Promise((ok, mal) => {
    if (!file) return ok('');
    if (!/^image\//.test(file.type)) return mal(new Error('El archivo no es una imagen.'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.78));
    };
    im.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
    im.src = url;
  });
}
const campoFoto = (actual, alt) => `<div class="fld"><span>Foto</span>
    ${actual ? `<img class="cat-foto-prev" src="${esc(actual)}" alt="Foto actual de ${esc(alt)}">` : ''}
    <input type="file" name="foto" accept="image/*" data-foto>
    <label class="fld"><span class="lbl">… o pega el enlace de una imagen</span><input name="fotoUrl" type="url" maxlength="1000" placeholder="https://…/foto.jpg" autocomplete="off">
      <small class="err" hidden>El enlace debe empezar por https://</small></label>
    <small class="hint">${actual ? 'Si no eliges otra, se mantiene la foto actual.' : 'Opcional.'} El archivo se reduce solo para guardarlo. Con un enlace, la foto depende de que esa página la siga mostrando.</small>
    ${actual ? '<label class="check"><input type="checkbox" name="quitarFoto"> Quitar la foto</label>' : ''}</div>`;
const fotoSrc = src => (!src ? '' : /^(data:|img\/|https:\/\/)/.test(src) ? src : 'img/motos/' + String(src).split('/').pop());
/* Foto elegida en el formulario: archivo (tiene prioridad) o enlace. Devuelve undefined si no se eligió nada nuevo. */
async function fotoDelForm(form) {
  const f = form.elements.foto.files[0];
  if (f) return { src: await leerFoto(f), tipo: 'archivo' };
  const u = str(form.elements.fotoUrl.value, 1000), err = form.elements.fotoUrl.parentElement.querySelector('.err');
  err.hidden = true; form.elements.fotoUrl.removeAttribute('aria-invalid');
  if (!u) return undefined;
  if (!https(u)) { err.hidden = false; form.elements.fotoUrl.setAttribute('aria-invalid', 'true'); form.elements.fotoUrl.focus(); throw new Error(''); }
  return { src: u, tipo: 'enlace' };
}

/* ── Formularios ── */
function formMotoHtml(m, d, nueva) {
  const marcas = [...new Set(d.motos.map(x => x.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const grupos = [...new Set([...(d.gruposParrilla || []).map(g => g.id), ...d.motos.map(x => x.parrilla)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Catálogo de motos</p><h2 id="dlg-titulo">${nueva ? 'Agregar moto' : `Editar ${esc(`${m.marca} ${m.modelo}`)}`}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <div class="fld-row">
        <label class="fld"><span>Marca <b class="req">*</b></span><input name="marca" required maxlength="60" list="cat-marcas" value="${esc(m.marca || '')}" autocomplete="off"><small class="err" hidden>Escribe la marca.</small></label>
        <label class="fld"><span>Modelo <b class="req">*</b></span><input name="modelo" required maxlength="80" value="${esc(m.modelo || '')}" autocomplete="off"><small class="err" hidden>Escribe el modelo.</small></label>
      </div>
      <datalist id="cat-marcas">${marcas.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="fld"><span>Misma parrilla (grupo)</span><input name="parrilla" maxlength="40" list="cat-grupos" value="${esc(m.parrilla || '')}" autocomplete="off" placeholder="Sin grupo">
        <small class="hint">Las motos con el mismo grupo comparten parrilla. Déjalo vacío si no se sabe.</small></label>
      <datalist id="cat-grupos">${grupos.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="check"><input type="checkbox" name="pendiente" ${m.pendiente ? 'checked' : ''}> Modelo por identificar</label>
      <label class="fld"><span>Estado de la parrilla</span><input name="parrillaEstado" maxlength="120" value="${esc(m.parrillaEstado || '')}" placeholder="Ej.: Parrilla de referencia pendiente" autocomplete="off"></label>
      <label class="fld"><span>Nota sobre la parrilla</span><textarea name="parrillaEstadoNota" rows="2" maxlength="600">${esc(m.parrillaEstadoNota || '')}</textarea></label>
      ${campoFoto(m.foto && m.foto.src ? fotoSrc(m.foto.src) : '', `${m.marca || ''} ${m.modelo || ''}`)}
      <p class="err" data-err hidden></p>
    </div>
    <div class="dlg-foot">${!nueva && m._propia ? '<button type="button" class="btn btn-danger" data-borrar>Eliminar</button>' : ''}<button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

function siguienteCodigo(d) {
  const ns = (d.parrillas || []).map(p => /^EK-P(\d+)/.exec(p.id)).filter(Boolean).map(x => +x[1]);
  return 'EK-P' + String((ns.length ? Math.max(...ns) : 0) + 1).padStart(2, '0');
}

function formParrillaHtml(p, d, nueva) {
  const grupos = [...new Set([...(d.gruposParrilla || []).map(g => g.id), ...d.motos.map(x => x.parrilla)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const marcadas = new Set((p.motos || []).map(r => r.id));
  const motos = [...d.motos].sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, 'es'));
  return `<form class="dlg-form" novalidate>
    <div class="dlg-head"><div><p class="dlg-kicker">Catálogo de parrillas</p><h2 id="dlg-titulo">${nueva ? 'Agregar parrilla' : `Editar ${esc(p.id)}`}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cancelar">×</button></div>
    <div class="dlg-body">
      <div class="fld-row">
        <label class="fld"><span>Código <b class="req">*</b></span><input name="id" required maxlength="30" value="${esc(p.id || siguienteCodigo(d))}" ${nueva ? '' : 'readonly'} autocomplete="off">
          <small class="hint">${nueva ? 'Se propone el siguiente código libre.' : 'El código no cambia.'}</small><small class="err" hidden>Escribe un código que no exista.</small></label>
        <label class="fld"><span>Grupo</span><select name="grupo"><option value="">Sin grupo</option>${grupos.map(g => `<option value="${esc(g)}"${g === p.grupo ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      </div>
      <label class="fld"><span>Nombre <b class="req">*</b></span><input name="nombre" required maxlength="160" value="${esc(p.nombre || '')}" autocomplete="off"><small class="err" hidden>Escribe el nombre.</small></label>
      <label class="fld"><span>Título de la publicación</span><input name="publicacion" maxlength="200" value="${esc(p.publicacion || '')}" autocomplete="off"></label>
      <div class="fld-row">
        <label class="fld"><span>Marca</span><input name="marca" maxlength="80" value="${esc(p.marca || '')}" autocomplete="off"></label>
        <label class="fld"><span>Código de la pieza</span><input name="referencia" maxlength="60" value="${esc(p.referencia || '')}" autocomplete="off"></label>
      </div>
      <div class="fld-row">
        <label class="fld"><span>Tipo de pieza</span><select name="tipo">${opciones(TIPOS_PAR, p.tipo || 'pendiente')}</select></label>
        <label class="fld"><span>Variante</span><select name="variante">${opciones(VARIANTES, p.variante || 'por-precisar')}</select></label>
        <label class="fld"><span>Validación con nuestra base</span><select name="validacion">${opciones(VALIDACION, p.validacion || 'sin-probar')}</select></label>
      </div>
      <fieldset class="fld"><legend>Anunciada para</legend>
        <div class="cat-motos">${motos.map(m => `<label class="check"><input type="checkbox" name="moto" value="${esc(m.id)}" ${marcadas.has(m.id) ? 'checked' : ''}> ${esc(`${m.marca} ${m.modelo}`)}</label>`).join('')}</div>
        <small class="hint">Marca solo los modelos para los que la publicación o el vendedor la anuncian.</small></fieldset>
      <label class="fld"><span>Enlace</span><input name="url" type="url" maxlength="500" value="${esc(p.url || '')}" placeholder="https://…" autocomplete="off"><small class="err" hidden>El enlace debe empezar por https://</small></label>
      <label class="check"><input type="checkbox" name="esBusqueda" ${p.esBusqueda ? 'checked' : ''}> El enlace es una búsqueda, no una pieza concreta</label>
      ${campoFoto(p.foto || '', p.nombre || '')}
      <label class="fld"><span>Observaciones</span><textarea name="observaciones" rows="3" maxlength="2000">${esc((p.observaciones || []).join('\n'))}</textarea><small class="hint">Una por línea.</small></label>
      <label class="fld"><span>Para el acople de la maleta</span><textarea name="acople" rows="3" maxlength="2000">${esc((p.acople || []).join('\n'))}</textarea><small class="hint">Una por línea.</small></label>
      <label class="check"><input type="checkbox" name="identificada" ${p.identificada ? 'checked' : ''}> Identificada en catálogo</label>
      <p class="err" data-err hidden></p>
    </div>
    <div class="dlg-foot">${!nueva && p._propia ? '<button type="button" class="btn btn-danger" data-borrar>Eliminar</button>' : ''}<button type="button" class="btn" data-dlg-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
  </form>`;
}

/* ── Abrir y guardar ──
   ui: { dlg, abrirDialogo, cerrar, confirmar, render, toast, autor } */
function marcarPropias(base, mezcla, k) { const ids = new Set((base[k] || []).map(x => x.id)); return id => !ids.has(id); }

export function editarMoto(base, id, ui) {
  const d = mezclar(base), nueva = !id;
  const propia = marcarPropias(base, d, 'motos');
  const m = nueva ? {} : { ...d.motos.find(x => x.id === id), _propia: propia(id) };
  if (!nueva && !m.id) return;
  ui.abrirDialogo(formMotoHtml(m, d, nueva), nueva ? '[data-act="cat-moto-nueva"]' : `[data-act="cat-moto-editar"][data-id="${id}"]`);
  const form = ui.dlg.querySelector('form'), errG = form.querySelector('[data-err]');
  const borrar = form.querySelector('[data-borrar]');
  if (borrar) borrar.addEventListener('click', () => ui.confirmar('Eliminar moto', `<p>Se eliminará «${esc(`${m.marca} ${m.modelo}`)}» del catálogo.</p><p>Solo se pueden eliminar las motos agregadas aquí; las del estudio se mantienen.</p>`, 'Eliminar', () => {
    quitar(CLAVES.motos, m.id); ui.render(); ui.toast('Moto eliminada.');
  }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const g = n => str(form.elements[n] && form.elements[n].value, 600);
    let ok = true;
    ['marca', 'modelo'].forEach(n => { const vacio = !g(n); form.elements[n].setAttribute('aria-invalid', vacio); form.elements[n].parentElement.querySelector('.err').hidden = !vacio; if (vacio) ok = false; });
    if (!ok) { form.querySelector('[aria-invalid="true"]').focus(); return; }
    let foto = m.foto || null;
    try {
      const nf = await fotoDelForm(form);
      if (nf) foto = { src: nf.src, fuente: `Foto agregada en el dashboard${ui.autor() ? ` por ${ui.autor()}` : ''}`, consultado: new Date().toISOString().slice(0, 10), ...(nf.tipo === 'enlace' ? { pagina: nf.src } : {}) };
      else if (form.elements.quitarFoto && form.elements.quitarFoto.checked) foto = null;
    } catch (x) { if (x.message) { errG.textContent = x.message; errG.hidden = false; } return; }
    let nuevoId = m.id;
    if (nueva) { const b = slug(`${g('marca')} ${g('modelo')}`) || 'moto'; nuevoId = b; let i = 2; while (d.motos.some(x => x.id === nuevoId)) nuevoId = `${b}-${i++}`; }
    const { _propia, ...antes } = m;
    const reg = { ...antes, id: nuevoId, marca: g('marca'), modelo: g('modelo'), parrilla: str(g('parrilla'), 40), pendiente: form.elements.pendiente.checked,
      parrillaEstado: str(g('parrillaEstado'), 120), parrillaEstadoNota: g('parrillaEstadoNota'), editado: marcaEdicion(ui.autor()) };
    if (foto) reg.foto = foto; else delete reg.foto;
    ['parrillaEstado', 'parrillaEstadoNota'].forEach(k => { if (!reg[k]) delete reg[k]; });
    if (!reg.pendiente) delete reg.pendiente;
    if (!guardar(CLAVES.motos, reg)) { errG.textContent = 'No se pudo guardar en este navegador (la foto puede ser muy grande).'; errG.hidden = false; return; }
    ui.cerrar(); ui.render({ foco: `[data-act="cat-moto-editar"][data-id="${nuevoId}"]` }); ui.toast(nueva ? 'Moto agregada.' : 'Moto guardada.');
  });
}

export function editarParrilla(base, id, ui) {
  const d = mezclar(base), nueva = !id;
  const propia = marcarPropias(base, d, 'parrillas');
  const p = nueva ? {} : { ...d.parrillas.find(x => x.id === id), _propia: propia(id) };
  if (!nueva && !p.id) return;
  ui.abrirDialogo(formParrillaHtml(p, d, nueva), nueva ? '[data-act="cat-par-nueva"]' : `[data-act="cat-par-editar"][data-id="${id}"]`);
  const form = ui.dlg.querySelector('form'), errG = form.querySelector('[data-err]');
  const borrar = form.querySelector('[data-borrar]');
  if (borrar) borrar.addEventListener('click', () => ui.confirmar('Eliminar parrilla', `<p>Se eliminará «${esc(p.id)} · ${esc(p.nombre)}» del catálogo.</p><p>Solo se pueden eliminar las parrillas agregadas aquí; las del estudio se mantienen.</p>`, 'Eliminar', () => {
    quitar(CLAVES.parrillas, p.id); ui.render(); ui.toast('Parrilla eliminada.');
  }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const g = n => str(form.elements[n] && form.elements[n].value, 2000);
    const marca = (n, malo) => { form.elements[n].setAttribute('aria-invalid', malo); form.elements[n].parentElement.querySelector('.err').hidden = !malo; return !malo; };
    const codigo = str(g('id'), 30).toUpperCase();
    let ok = marca('id', !codigo || (nueva && d.parrillas.some(x => x.id.toUpperCase() === codigo)));
    ok = marca('nombre', !g('nombre')) && ok;
    ok = marca('url', !!g('url') && !https(g('url'))) && ok;
    if (!ok) { form.querySelector('[aria-invalid="true"]').focus(); return; }
    let foto = p.foto || '';
    try {
      const nf = await fotoDelForm(form);
      if (nf) foto = nf.src;
      else if (form.elements.quitarFoto && form.elements.quitarFoto.checked) foto = '';
    } catch (x) { if (x.message) { errG.textContent = x.message; errG.hidden = false; } return; }
    const ids = [...form.querySelectorAll('input[name="moto"]:checked')].map(c => c.value);
    const previas = new Map((p.motos || []).map(r => [r.id, r]));
    const { _propia, ...antes } = p;
    const reg = { ...antes, id: nueva ? codigo : p.id, nombre: str(g('nombre'), 160), publicacion: str(g('publicacion'), 200), marca: str(g('marca'), 80),
      referencia: str(g('referencia'), 60), grupo: g('grupo'), tipo: g('tipo'), variante: g('variante'), validacion: g('validacion'),
      motos: ids.map(x => previas.get(x) || { id: x, relacion: 'Indicada al registrar la parrilla en el dashboard', fuente: 'Registro interno' }),
      url: g('url'), esBusqueda: form.elements.esBusqueda.checked, foto,
      observaciones: g('observaciones').split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 20),
      acople: g('acople').split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 20), identificada: form.elements.identificada.checked, editado: marcaEdicion(ui.autor()) };
    if (f_fuente(p, foto)) reg.fotoFuente = `Foto agregada en el dashboard${ui.autor() ? ` por ${ui.autor()}` : ''}`;
    if (!foto) delete reg.fotoFuente;
    if (!guardar(CLAVES.parrillas, reg)) { errG.textContent = 'No se pudo guardar en este navegador (la foto puede ser muy grande).'; errG.hidden = false; return; }
    ui.cerrar(); ui.render({ foco: `[data-act="cat-par-editar"][data-id="${reg.id}"]` }); ui.toast(nueva ? 'Parrilla agregada.' : 'Parrilla guardada.');
  });
}
const f_fuente = (p, foto) => !!foto && foto !== p.foto;
