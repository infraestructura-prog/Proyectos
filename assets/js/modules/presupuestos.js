/* Neotropya › Presupuestos · productos por comprar, comparación de opciones y aprobación dentro de un máximo.
   Fuente inicial: assets/data/presupuestos/equipamiento-taller-v1.json (extraído de «Equipamiento de Taller V1»).
   Solo se usa la primera vez: después todo vive en localStorage de este navegador (y las imágenes subidas,
   en IndexedDB). No se sincroniza con Google Docs ni con Drive. Las reglas de dinero están en presupuestos-core.js. */
import { esc, ICON, openModal, confirmDialog, toast, alertBox, fmtDate } from '../ui.js';
import {
  PLATAFORMAS, IMPORTANCIAS, ESTADOS, CARGOS, CARGO_ESTADOS, parseMoney, parseRate, rateText, moneyText, fmtMoney,
  productTotal, budgetAmount, totals, checkApprove, invariants
} from './presupuestos-core.js';

const DATA_URL = '/assets/data/presupuestos/equipamiento-taller-v1.json';
const STORE_KEY = 'ccs-presupuestos-v1';
const PREFS_KEY = 'ccs-presupuestos-prefs';
const SCHEMA = 'ccs-presupuestos-v1';
const SEED_IMG = '/assets/data/presupuestos/img/';
const MONEDAS = ['USD', 'EUR', 'VES', 'COP'];
const IMP_RANK = { Alta: 0, Media: 1, Baja: 2, '': 3 };
const ORDENES = [['importancia', 'Importancia'], ['precio-asc', 'Precio: menor a mayor'], ['precio-desc', 'Precio: mayor a menor'], ['nombre', 'Nombre']];

const small = icon => icon.replace('<svg', '<svg width="16" height="16"');
const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const webUrl = s => { try { return ['https:', 'http:'].includes(new URL(s).protocol); } catch { return false; } };
const uid = p => p + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
const curOk = c => /^[A-Z]{3}$/.test(c);
const now = () => new Date().toISOString();

/* ═════════ Normalización (datos guardados, semilla e importación) ═════════ */
function normProduct(x) {
  const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const arr = v => (Array.isArray(v) ? v.filter(s => typeof s === 'string').map(s => s.trim().slice(0, 600)).filter(Boolean).slice(0, 40) : []);
  const int = v => (Number.isInteger(v) && v >= 0 ? v : null);
  const cargo = c => {
    const estado = CARGO_ESTADOS.some(([k]) => k === (c && c.estado)) ? c.estado : 'pendiente';
    const cents = ['conocido', 'estimado'].includes(estado) ? int(c.cents) : 0;
    return cents == null ? { estado: 'pendiente', cents: 0 } : { estado, cents };
  };
  const img = x.imagen && typeof x.imagen === 'object' ? x.imagen : null;
  let imagen = null;
  if (img && img.tipo === 'semilla' && typeof img.valor === 'string' && img.valor.startsWith(SEED_IMG)) imagen = { tipo: 'semilla', valor: img.valor };
  else if (img && img.tipo === 'url' && webUrl(img.valor)) imagen = { tipo: 'url', valor: str(img.valor, 1500) };
  else if (img && img.tipo === 'archivo' && /^img-[\w-]{4,40}$/.test(img.valor)) imagen = { tipo: 'archivo', valor: img.valor };
  const moneda = curOk(x.moneda) ? x.moneda : '';
  const p = {
    id: str(x.id, 60), nombre: str(x.nombre, 160), marca: str(x.marca, 120), modelo: str(x.modelo, 120), categoria: str(x.categoria, 120),
    plataforma: PLATAFORMAS.includes(x.plataforma) ? x.plataforma : 'Otro', proveedor: str(x.proveedor, 200),
    enlace: webUrl(x.enlace) ? str(x.enlace, 3000) : '', imagen,
    descripcion: str(x.descripcion, 3000), especificaciones: arr(x.especificaciones), justificacion: str(x.justificacion, 3000),
    precioCents: int(x.precioCents), precioOriginal: str(x.precioOriginal, 60), moneda,
    tasa: x.tasa && Number.isInteger(x.tasa.micro) && x.tasa.micro > 0 && curOk(x.tasa.destino) && moneda
      ? { micro: x.tasa.micro, destino: x.tasa.destino, fuente: str(x.tasa.fuente, 200) } : null,
    cantidad: Number.isInteger(x.cantidad) && x.cantidad >= 1 && x.cantidad <= 100000 ? x.cantidad : 1,
    cargos: Object.fromEntries(CARGOS.map(([k]) => [k, cargo(x.cargos && x.cargos[k])])),
    importancia: IMPORTANCIAS.includes(x.importancia) ? x.importancia : '',
    estado: ESTADOS.includes(x.estado) ? x.estado : 'Pendiente',
    compra: null, grupo: str(x.grupo, 80),
    videos: Array.isArray(x.videos) ? x.videos.filter(v => v && webUrl(v.url)).map(v => ({ titulo: str(v.titulo, 300) || 'Video', url: str(v.url, 1500) })).slice(0, 10) : [],
    observaciones: arr(x.observaciones), pendientes: arr(x.pendientes),
    historial: Array.isArray(x.historial) ? x.historial.filter(h => h && typeof h.accion === 'string').map(h => ({ at: str(h.at, 40), accion: str(h.accion, 80), detalle: str(h.detalle, 600) })).slice(-200) : []
  };
  if (p.estado === 'Comprado') {
    const c = x.compra;
    if (c && int(c.cents) != null && curOk(c.moneda)) p.compra = { cents: c.cents, moneda: c.moneda, fecha: str(c.fecha, 40) };
    else p.estado = 'Aprobado'; // compra sin importe registrado: se trata como aprobada y la valida el límite
  }
  return p;
}

/* Devuelve { ok, value, error }. Se usa al leer lo guardado y al importar. */
export function validateState(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
  if (obj.schema !== SCHEMA) return { ok: false, error: `No es un respaldo de Presupuestos (se esperaba «${SCHEMA}»).` };
  if (!Array.isArray(obj.productos)) return { ok: false, error: 'Falta la lista de productos.' };
  if (obj.productos.length > 300) return { ok: false, error: 'Demasiados productos (máximo 300).' };
  const productos = obj.productos.map(normProduct);
  const bad = productos.findIndex(p => !p.id || !p.nombre);
  if (bad >= 0) return { ok: false, error: `El producto n.º ${bad + 1} no tiene identificador o nombre.` };
  if (new Set(productos.map(p => p.id)).size !== productos.length) return { ok: false, error: 'Hay productos con el mismo identificador.' };
  const b = obj.presupuesto || {};
  const presupuesto = { maxCents: Number.isInteger(b.maxCents) && b.maxCents >= 0 ? b.maxCents : null, moneda: curOk(b.moneda) ? b.moneda : '' };
  const registro = Array.isArray(obj.registro) ? obj.registro.filter(r => r && typeof r === 'object').slice(-500) : [];
  const semilla = Array.isArray(obj.semilla) ? obj.semilla.filter(s => typeof s === 'string').slice(0, 500) : null;
  const value = { schema: SCHEMA, rev: Number.isInteger(obj.rev) ? obj.rev : 0, savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : null, presupuesto, productos, registro, semilla };
  const inv = invariants(value);
  if (inv) return { ok: false, error: 'Los datos no cumplen el límite del presupuesto: ' + inv };
  return { ok: true, value };
}

const seedProduct = (seed, x) => normProduct({
  ...x, estado: 'Pendiente', importancia: '', grupo: '', justificacion: '',
  historial: [{ at: now(), accion: 'Cargado', detalle: x.origen ? `Desde: ${x.origen}.` : `Desde el documento «${seed.fuente.documento}».` }]
});

function fromSeed(seed) {
  const productos = (seed.productos || []).map(x => seedProduct(seed, x));
  return { schema: SCHEMA, rev: 0, savedAt: null, presupuesto: { maxCents: null, moneda: '' }, productos, registro: [], semilla: productos.map(p => p.id) };
}

/* Productos añadidos a la fuente después de que este navegador guardó sus datos: se agregan como pendientes.
   `semilla` recuerda los que ya se ofrecieron, así un producto eliminado no reaparece. Los datos guardados
   antes de existir `semilla` ya recibieron la primera tanda (los productos sin «agregado»). */
function seedAdditions(state, seed) {
  const list = seed.productos || [];
  const seen = new Set(state.semilla || list.filter(x => !x.agregado).map(x => x.id));
  const have = new Set(state.productos.map(p => p.id));
  const nuevos = list.filter(x => !seen.has(x.id) && !have.has(x.id)).map(x => seedProduct(seed, x));
  return { nuevos, semilla: [...new Set([...seen, ...list.map(x => x.id)])] };
}

/* ═════════ Almacenamiento ═════════ */
const storage = {
  raw() { try { return localStorage.getItem(STORE_KEY); } catch { return undefined; } },
  write(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return null; } catch (e) { return e && e.name === 'QuotaExceededError' ? 'el almacenamiento del navegador está lleno' : 'el almacenamiento del navegador no está disponible'; } },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch { /* sin almacenamiento */ } }
};
const prefs = {
  read() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } },
  write(v) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
};

/* Imágenes subidas como archivo: IndexedDB (localStorage se llenaría con pocas fotos). */
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ccs-presupuestos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('imagenes');
    r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const tx = db.transaction('imagenes', mode); const out = fn(tx.objectStore('imagenes'));
    tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
  return {
    get: k => run('readonly', s => s.get(k)),
    put: (k, blob) => run('readwrite', s => s.put(blob, k)),
    del: k => run('readwrite', s => s.delete(k)),
    clear: () => run('readwrite', s => s.clear())
  };
})();

/* Reduce la foto a 1200 px de lado mayor en JPEG para no llenar el almacenamiento. */
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', 0.85));
}
const blobToDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

/* ═════════ Presentación ═════════ */
const estadoChip = e => `<span class="pp-state st-${e.toLowerCase()}">${e === 'Comprado' ? small(ICON.ok) : e === 'Aprobado' ? small(ICON.lock) : ''}${e}</span>`;
const impChip = i => i ? `<span class="pp-imp imp-${i.toLowerCase()}">Importancia ${i.toLowerCase()}</span>` : '<span class="pp-imp imp-none">Importancia sin asignar</span>';
const priceText = p => p.precioCents == null ? 'Por cotizar' : `${p.moneda || '$'} ${moneyText(p.precioCents)}`;
const placeholder = `<div class="pp-ph" aria-hidden="true">${ICON.image}<span>Sin imagen</span></div>`;

function imageTag(p, cls = '') {
  if (!p.imagen) return placeholder;
  const alt = `Imagen de ${esc(p.nombre)}`;
  if (p.imagen.tipo === 'archivo') return `<img class="pp-photo ${cls}" data-key="${esc(p.imagen.valor)}" alt="${alt}">${placeholder}`;
  return `<img class="pp-photo ${cls}" src="${esc(p.imagen.valor)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">${placeholder}`;
}

/* ═════════ Módulo ═════════ */
export function mount(root, ctx) {
  const P = prefs.read();
  const S = {
    data: null, seed: null, error: null, rawBad: null,
    q: P.q || '', plat: P.plat || '', imp: P.imp || '', cat: P.cat || '', est: P.est || '', orden: ORDENES.some(([k]) => k === P.orden) ? P.orden : 'importancia',
    panelOpen: false, detailId: null
  };
  let alive = true, detail = null;
  const urls = new Map(); // clave de IndexedDB → URL de objeto

  root.innerHTML = `<div class="pp"><div class="skeleton" style="height:240px" aria-label="Cargando presupuestos"></div></div>`;

  async function load() {
    const raw = storage.raw();
    if (raw) {
      let r; try { r = validateState(JSON.parse(raw)); } catch { r = { ok: false, error: 'El contenido guardado no es JSON válido.' }; }
      if (r.ok) { S.data = r.value; render(); mergeSeed(); return; }
      S.rawBad = { raw, error: r.error }; render(); return; // nunca se sobrescribe en silencio
    }
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      S.seed = await res.json();
    } catch (e) { S.error = 'No se pudieron cargar los datos iniciales (' + e.message + ').'; render(); return; }
    // Primera vez en este navegador: se guarda la semilla para que una nueva versión de la página no la vuelva a aplicar.
    const init = fromSeed(S.seed); init.rev = 1; init.savedAt = now();
    const err = storage.write(init);
    S.data = init;
    if (err) toast(`Los productos iniciales no se pudieron guardar: ${err}. Los cambios no se conservarán.`, 'err', 9000);
    if (alive) render();
  }

  // Agrega a lo guardado los productos nuevos de la fuente, sin tocar los existentes. Si la fuente no carga, no pasa nada.
  async function mergeSeed() {
    let seed;
    try { const res = await fetch(DATA_URL, { cache: 'no-store' }); if (!res.ok) return; seed = await res.json(); } catch { return; }
    if (!alive || !Array.isArray(seed.productos)) return;
    const { nuevos } = seedAdditions(S.data, seed);
    const known = S.data.semilla && seed.productos.every(x => S.data.semilla.includes(x.id));
    if (!nuevos.length && known) return;
    const r = mutate(d => {
      const add = seedAdditions(d, seed);
      const ids = new Set(d.productos.map(p => p.id));
      d.productos.push(...add.nuevos.filter(p => !ids.has(p.id)));
      d.semilla = add.semilla;
    });
    if (r.error) toast(`No se pudieron agregar los productos nuevos de la fuente: ${r.error}`, 'err', 9000);
    else if (nuevos.length) toast(nuevos.length === 1 ? `Se agregó un producto nuevo: ${nuevos[0].nombre}.` : `Se agregaron ${nuevos.length} productos nuevos.`);
  }

  /* Aplica un cambio sobre la versión guardada más reciente (por si otra pestaña cambió algo),
     comprueba el límite y solo entonces guarda. Si algo falla, no se aplica nada. */
  function mutate(fn) {
    let base = S.data;
    const raw = storage.raw();
    if (raw) { try { const r = validateState(JSON.parse(raw)); if (r.ok && r.value.rev >= S.data.rev) base = r.value; } catch { /* se usa la copia en memoria */ } }
    const draft = structuredClone(base);
    const res = fn(draft) || {};
    if (res.error) return { error: res.error };
    const inv = invariants(draft);
    if (inv) return { error: inv };
    draft.rev = (base.rev || 0) + 1; draft.savedAt = now();
    const err = storage.write(draft);
    if (err) return { error: `No se pudo guardar: ${err}. El cambio no se aplicó.` };
    S.data = draft; render();
    return { ok: true, ...res };
  }
  const log = (p, accion, detalle = '') => { p.historial.push({ at: now(), accion, detalle }); if (p.historial.length > 200) p.historial.shift(); };
  const find = (d, id) => d.productos.find(x => x.id === id);
  const B = () => S.data.presupuesto;
  const money = c => (B().moneda ? fmtMoney(c, B().moneda) : c == null ? '—' : moneyText(c));

  function explain(title, html) {
    const m = openModal({ size: 'sm', html: `<div class="modal-head"><h2 data-modal-title>${title}</h2></div><div class="modal-body">${html}</div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>Entendido</button></div>` });
    return m;
  }

  /* ── Filtros ── */
  const savePrefs = () => prefs.write({ q: S.q, plat: S.plat, imp: S.imp, cat: S.cat, est: S.est, orden: S.orden });
  function visible() {
    const q = S.q.trim().toLowerCase();
    const list = S.data.productos.filter(p => (!S.plat || p.plataforma === S.plat) && (!S.cat || p.categoria === S.cat) && (!S.est || p.estado === S.est)
      && (!S.imp || (S.imp === 'sin' ? !p.importancia : p.importancia === S.imp))
      && (!q || [p.nombre, p.marca, p.modelo].join(' ').toLowerCase().includes(q)));
    const byName = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
    // Precio: solo se comparan precios de la misma moneda; las monedas forman bloques y lo que no tiene precio va al final.
    const byPrice = dir => (a, b) => {
      const ka = a.precioCents == null ? 2 : a.moneda ? 0 : 1, kb = b.precioCents == null ? 2 : b.moneda ? 0 : 1;
      if (ka !== kb) return ka - kb;
      if (a.moneda !== b.moneda) return a.moneda.localeCompare(b.moneda);
      return ka === 2 ? byName(a, b) : dir * (a.precioCents - b.precioCents) || byName(a, b);
    };
    const sorts = {
      importancia: (a, b) => IMP_RANK[a.importancia] - IMP_RANK[b.importancia] || byName(a, b),
      'precio-asc': byPrice(1), 'precio-desc': byPrice(-1), nombre: byName
    };
    return list.sort(sorts[S.orden]);
  }

  /* ── Tarjeta ── */
  function flags(p) {
    const t = productTotal(p), out = [];
    if (p.precioCents == null) out.push('<span class="chip chip-warn">Sin precio</span>');
    else if (!p.moneda) out.push('<span class="chip chip-warn">Moneda por confirmar</span>');
    if (t.pend.length && p.precioCents != null) out.push('<span class="chip chip-warn">Cargos por cotizar</span>');
    if (t.est) out.push('<span class="chip chip-upd">Incluye estimación</span>');
    if (p.moneda && B().moneda && p.moneda !== B().moneda) out.push(`<span class="chip chip-other">${p.tasa && p.tasa.destino === B().moneda ? 'Con equivalencia' : 'Otra moneda'}: ${esc(p.moneda)}</span>`);
    if (p.grupo) out.push(`<span class="chip chip-todo">Alternativa · ${esc(p.grupo)}</span>`);
    return out.join('');
  }

  function actions(p, where) {
    const b = (act, label, cls = '', icon = '') => `<button type="button" class="btn btn-sm ${cls}" data-act="${act}" data-id="${esc(p.id)}">${icon}${label}</button>`;
    const out = [];
    if (p.estado === 'Pendiente') out.push(b('approve', 'Aprobar', 'btn-primary', small(ICON.ok)));
    if (p.estado === 'Aprobado') out.push(b('unapprove', 'Retirar aprobación'), b('buy', 'Marcar comprado', 'btn-primary', small(ICON.ok)));
    if (p.estado === 'Comprado' && where === 'detail') out.push(b('correct', 'Corregir compra', '', small(ICON.history)));
    if (where === 'detail') out.push(b('edit', 'Editar', 'btn-ghost', small(ICON.edit)), b('delete', 'Quitar', 'btn-ghost pp-del', small(ICON.trash)));
    return out.join('');
  }

  function card(p) {
    const t = productTotal(p), titleId = `pp-t-${esc(p.id)}`;
    const mm = [p.marca, p.modelo].filter(Boolean).join(' · ');
    return `<article class="pp-card st-${p.estado.toLowerCase()}" data-card="${esc(p.id)}" aria-labelledby="${titleId}">
      <div class="pp-img">${imageTag(p)}${estadoChip(p.estado)}</div>
      <div class="pp-body">
        <p class="pp-cat">${esc(p.categoria || 'Sin categoría')}</p>
        <h3 id="${titleId}"><button type="button" class="pp-open" data-act="open" data-id="${esc(p.id)}">${esc(p.nombre)}</button></h3>
        <p class="pp-mm">${mm ? esc(mm) : '<span class="muted">Marca y modelo sin confirmar</span>'}</p>
        <p class="pp-plat">${small(ICON.tag)}<span>${esc(p.plataforma)}${p.proveedor ? ` · ${esc(p.proveedor)}` : ''}</span></p>
        <dl class="pp-nums">
          <div><dt>Precio unitario</dt><dd>${esc(priceText(p))}${p.precioCents != null && !p.moneda ? '<small>moneda por confirmar</small>' : ''}</dd></div>
          <div><dt>Cantidad</dt><dd>${p.cantidad}</dd></div>
          <div><dt>Subtotal</dt><dd><b>${t.subtotal == null ? '—' : `${esc(p.moneda || '$')} ${moneyText(t.subtotal)}`}</b></dd></div>
        </dl>
        <div class="pp-flags">${flags(p)}</div>
        <div class="pp-impsel"><label for="pp-imp-${esc(p.id)}">Importancia</label>
          <select id="pp-imp-${esc(p.id)}" class="select" data-imp="${esc(p.id)}">
            <option value="" ${p.importancia ? '' : 'selected'}>Sin asignar</option>${IMPORTANCIAS.map(i => `<option ${i === p.importancia ? 'selected' : ''}>${i}</option>`).join('')}
          </select></div>
      </div>
      <footer class="pp-foot">${actions(p, 'card')}${p.estado === 'Comprado' ? `<span class="pp-done">${small(ICON.ok)}Compra realizada</span>` : ''}</footer>
    </article>`;
  }

  /* ── Panel del presupuesto ── */
  function panel() {
    const b = B(), t = totals(S.data), cur = b.moneda;
    const pct = v => (b.maxCents ? Math.min(100, (v / b.maxCents) * 100) : 0);
    const incl = S.data.productos.filter(p => p.estado !== 'Pendiente');
    const amount = p => (p.estado === 'Comprado' ? p.compra.cents : budgetAmount(p, b).cents);
    const over = b.maxCents != null && t.saldo === 0 && t.comprometido > 0;
    return `<section class="pp-panel" aria-labelledby="pp-pt">
      <h2 id="pp-pt">${small(ICON.tag)}Presupuesto</h2>
      <form class="pp-bform" data-budget novalidate>
        <div class="field"><label for="pp-max">Presupuesto máximo</label>
          <input id="pp-max" name="max" class="input" inputmode="decimal" autocomplete="off" placeholder="Sin definir" value="${b.maxCents == null ? '' : esc(moneyText(b.maxCents))}"></div>
        <div class="field"><label for="pp-cur">Moneda</label>
          <input id="pp-cur" name="cur" class="input" list="pp-curs" maxlength="3" autocomplete="off" placeholder="USD" value="${esc(cur)}"></div>
        <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
      </form>
      ${b.maxCents == null ? '<p class="pp-pnote">Define el máximo y su moneda para poder aprobar compras.</p>' : ''}
      <div class="pp-sum">
        <p class="pp-saldo"><span>Saldo disponible</span><b>${t.saldo == null ? '—' : esc(money(t.saldo))}</b></p>
        <div class="pp-meter" role="img" aria-label="Utilización del presupuesto: ${b.maxCents ? Math.round((t.comprometido / b.maxCents) * 100) : 0} %">
          <i class="real" style="width:${pct(t.realizado)}%"></i><i class="res" style="width:${pct(t.reservado)}%"></i></div>
        <p class="pp-util">${b.maxCents ? `${esc(money(t.comprometido))} de ${esc(money(b.maxCents))} comprometido (${Math.round((t.comprometido / b.maxCents) * 100)} %)` : 'Sin máximo definido'}${over ? ' · presupuesto agotado' : ''}</p>
      </div>
      <button type="button" class="btn btn-sm pp-ptoggle" data-act="panel" aria-expanded="${S.panelOpen}" aria-controls="pp-pmore">${S.panelOpen ? 'Ocultar detalle' : 'Ver detalle del presupuesto'}</button>
      <div class="pp-pmore ${S.panelOpen ? 'open' : ''}" id="pp-pmore">
        <dl class="pp-dl">
          <div><dt>Comprometido total</dt><dd>${esc(money(t.comprometido))}</dd></div>
          <div><dt><i class="sw res" aria-hidden="true"></i>Aprobado, por comprar</dt><dd>${esc(money(t.reservado))}</dd></div>
          <div><dt><i class="sw real" aria-hidden="true"></i>Compras realizadas</dt><dd>${esc(money(t.realizado))}</dd></div>
          <div><dt>Productos aprobados</dt><dd>${t.aprobados}${t.comprados ? ` · ${t.comprados} comprado${t.comprados > 1 ? 's' : ''}` : ''}</dd></div>
        </dl>
        <h3>Compras incluidas</h3>
        ${incl.length ? `<ul class="pp-incl">${incl.map(p => `<li><button type="button" class="pp-link" data-act="open" data-id="${esc(p.id)}">${esc(p.nombre)}</button>
            <span>${esc(money(amount(p)))}${p.estado === 'Aprobado' && budgetAmount(p, b).est ? ' <small>(con estimación)</small>' : ''}</span>${estadoChip(p.estado)}</li>`).join('')}</ul>`
          : '<p class="pp-pnote">Ninguna compra aprobada todavía.</p>'}
        <p class="pp-pnote">Aprobar reserva el importe; marcarlo como comprado no lo vuelve a sumar. Los productos pendientes no consumen presupuesto.</p>
      </div>
      <datalist id="pp-curs">${MONEDAS.map(c => `<option value="${c}">`).join('')}</datalist>
    </section>`;
  }

  /* ── Página ── */
  function render() {
    if (!alive) return;
    if (S.error) { root.innerHTML = `<div class="pp">${alertBox('err', 'No se pudo abrir Presupuestos', `<p>${esc(S.error)}</p>`, '<button class="btn btn-sm" onclick="location.reload()">Reintentar</button>')}</div>`; return; }
    if (S.rawBad) {
      root.innerHTML = `<div class="pp">${alertBox('err', 'Los datos guardados en este navegador no se pudieron leer', `<p>${esc(S.rawBad.error)}</p><p>No se ha borrado nada. Descarga una copia antes de restaurar.</p>`,
        '<button class="btn btn-sm" data-act="dump">Descargar copia de lo guardado</button><button class="btn btn-sm btn-danger" data-act="reset">Restaurar datos iniciales</button>')}</div>`;
      return;
    }
    const all = S.data.productos;
    const cats = [...new Set(all.map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    if (S.cat && !cats.includes(S.cat)) S.cat = '';
    const list = visible();
    const opt = (arr, v, label) => `<option value="">${label}</option>` + arr.map(x => { const [k, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
    const focusId = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;

    root.innerHTML = `<div class="pp">
      <header class="inv-head pp-head">
        <div>
          <p class="neo-hero-kicker"><span class="dot" aria-hidden="true"></span>Neotropya · Compras del departamento</p>
          <h1>Presupuestos</h1>
          <p class="inv-desc">Productos que se necesitan comprar: compara opciones y aprueba compras dentro de un presupuesto máximo.</p>
          <p class="inv-source">Fuente inicial: «Equipamiento de Taller V1». Los precios del documento son referencias investigadas, no precios actuales verificados.</p>
        </div>
        <a class="btn" href="#/neotropya">${ICON.back}<span>Volver a Neotropya</span></a>
      </header>
      <div class="pp-layout">
        <aside class="pp-aside" aria-label="Resumen del presupuesto">${panel()}</aside>
        <div class="pp-main">
          <section class="panel toolbar pp-tools" aria-label="Búsqueda y filtros">
            <div class="search">${ICON.search}<label class="sr-only" for="pp-q">Buscar por nombre, marca o modelo</label>
              <input id="pp-q" type="search" placeholder="Buscar por nombre, marca o modelo…" value="${esc(S.q)}"></div>
            <label class="sr-only" for="pp-plat">Plataforma</label><select id="pp-plat" class="select" data-filter="plat">${opt(PLATAFORMAS, S.plat, 'Plataforma: todas')}</select>
            <label class="sr-only" for="pp-fimp">Importancia</label><select id="pp-fimp" class="select" data-filter="imp">${opt([...IMPORTANCIAS, ['sin', 'Sin asignar']], S.imp, 'Importancia: todas')}</select>
            <label class="sr-only" for="pp-cat">Categoría</label><select id="pp-cat" class="select" data-filter="cat">${opt(cats, S.cat, 'Categoría: todas')}</select>
            <label class="sr-only" for="pp-est">Estado</label><select id="pp-est" class="select" data-filter="est">${opt(ESTADOS, S.est, 'Estado: todos')}</select>
            <label class="sr-only" for="pp-ord">Ordenar</label><select id="pp-ord" class="select" data-filter="orden">${ORDENES.map(([k, l]) => `<option value="${k}" ${k === S.orden ? 'selected' : ''}>Orden: ${l}</option>`).join('')}</select>
            <span class="spacer"></span>
            <button type="button" class="btn btn-primary" data-act="add">${ICON.plus}<span>Agregar producto</span></button>
          </section>
          <div class="inv-bar">
            <p class="count" aria-live="polite">Mostrando ${list.length} de ${all.length} productos${S.orden.startsWith('precio') ? ' · los precios se ordenan dentro de cada moneda' : ''}</p>
            <div class="inv-data-actions">
              <button type="button" class="btn btn-sm" data-act="export">${ICON.download}Exportar JSON</button>
              <button type="button" class="btn btn-sm" data-act="import">${ICON.upload}Importar JSON</button>
              <button type="button" class="btn btn-sm btn-ghost" data-act="reset">Restaurar datos iniciales</button>
              <input type="file" accept="application/json,.json" data-import hidden>
            </div>
          </div>
          <p class="inv-storage">Los cambios se conservan solo en este navegador${S.data.savedAt ? ` (último guardado: ${esc(fmtDate(S.data.savedAt))})` : ''} y no se comparten con otros usuarios. Usa «Exportar JSON» para respaldarlos o trasladarlos.</p>
          ${list.length ? `<div class="pp-grid">${list.map(card).join('')}</div>`
            : all.length ? `<div class="state"><h3>Sin resultados</h3><p>Ningún producto coincide con la búsqueda o los filtros.</p><div class="alert-actions"><button class="btn btn-sm" data-act="clear">Limpiar filtros</button></div></div>`
            : '<div class="state"><h3>No hay productos</h3><p>Agrega un producto o restaura los datos iniciales.</p></div>'}
        </div>
      </div>
    </div>`;
    hydrate(root);
    if (focusId) { const n = root.querySelector('#' + CSS.escape(focusId)); n && n.focus(); }
    if (detail) fillDetail();
  }

  /* Fotos: si no cargan, queda el marcador neutro. Las subidas como archivo se leen de IndexedDB. */
  function hydrate(scope) {
    scope.querySelectorAll('img.pp-photo').forEach(img => {
      const box = img.parentNode;
      const ok = () => box.classList.add('has-photo');
      const bad = () => { box.classList.remove('has-photo'); img.remove(); };
      img.addEventListener('load', ok, { once: true }); img.addEventListener('error', bad, { once: true });
      const key = img.dataset.key;
      if (key) {
        if (urls.has(key)) img.src = urls.get(key);
        else idb.get(key).then(blob => {
          if (!blob) return bad();
          if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
          img.src = urls.get(key);
        }).catch(bad);
      } else if (img.complete) { img.naturalWidth ? ok() : bad(); }
    });
  }

  /* ── Ficha detallada ── */
  function openDetail(id) {
    S.detailId = id;
    const m = openModal({ size: 'pp-wide', html: '<div data-detail></div>', label: 'Ficha del producto', onClose: () => { detail = null; S.detailId = null; } });
    detail = m;
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset.id); });
    fillDetail();
  }

  function fillDetail() {
    const p = S.data.productos.find(x => x.id === S.detailId);
    if (!p) { detail.close('force'); return; }
    const t = productTotal(p), b = B(), a = budgetAmount(p, b);
    const mm = [p.marca, p.modelo].filter(Boolean).join(' · ');
    const list = (items, cls = '') => `<ul class="inv-list ${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const cargoRow = ([k, l]) => {
      const c = p.cargos[k];
      const v = c.estado === 'pendiente' ? '<span class="chip chip-warn">Pendiente de cotizar</span>'
        : c.estado === 'cero' ? 'Confirmado en 0,00'
          : `${esc(p.moneda || '$')} ${moneyText(c.cents)}${c.estado === 'estimado' ? ' <span class="chip chip-upd">Estimación</span>' : ''}`;
      return `<div><dt>${l}</dt><dd>${v}</dd></div>`;
    };
    const others = p.grupo ? S.data.productos.filter(x => x.grupo === p.grupo && x.id !== p.id) : [];
    const scroll = detail.el.closest('[data-scroll]'); const top = scroll ? scroll.scrollTop : 0;
    detail.el.querySelector('[data-detail]').innerHTML = `
      <div class="modal-head"><div><p class="kicker">${esc(p.categoria || 'Sin categoría')}</p><h2 class="pp-dtitle">${esc(p.nombre)}</h2>
        <p class="muted">${mm ? esc(mm) : 'Marca y modelo sin confirmar'}</p></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body pp-detail">
        <div class="pp-dtop">
          <div class="pp-img pp-dimg">${imageTag(p)}</div>
          <div>
            <p class="pp-dchips">${estadoChip(p.estado)} ${impChip(p.importancia)}</p>
            <dl class="pp-dl">
              <div><dt>Plataforma</dt><dd>${esc(p.plataforma)}</dd></div>
              <div><dt>Proveedor</dt><dd>${esc(p.proveedor || '—')}</dd></div>
              <div><dt>Precio unitario</dt><dd>${esc(priceText(p))}${p.precioCents != null && !p.moneda ? ' <span class="chip chip-warn">Moneda por confirmar</span>' : ''}</dd></div>
              ${p.precioOriginal ? `<div><dt>Precio en la fuente</dt><dd>${esc(p.precioOriginal)}</dd></div>` : ''}
              <div><dt>Cantidad</dt><dd>${p.cantidad}</dd></div>
              <div><dt>Subtotal</dt><dd>${t.subtotal == null ? '—' : `${esc(p.moneda || '$')} ${moneyText(t.subtotal)}`}</dd></div>
              ${CARGOS.map(cargoRow).join('')}
              <div class="pp-total"><dt>Total presupuestado</dt><dd>${t.cents == null ? 'Sin precio' : `${esc(p.moneda || '$')} ${moneyText(t.cents)}`}${t.pend.length && t.cents != null ? ' <small>(parcial: faltan cargos)</small>' : ''}</dd></div>
              ${p.tasa ? `<div><dt>Equivalencia</dt><dd>1 ${esc(p.moneda)} = ${rateText(p.tasa.micro)} ${esc(p.tasa.destino)}${p.tasa.fuente ? ` · ${esc(p.tasa.fuente)}` : ''}</dd></div>` : ''}
              <div><dt>En el presupuesto</dt><dd>${p.estado === 'Comprado' ? `${esc(fmtMoney(p.compra.cents, p.compra.moneda))} (importe de la compra)` : a.error ? `<span class="pp-no">No aprobable: ${esc(a.error)}</span>` : esc(fmtMoney(a.cents, b.moneda))}</dd></div>
            </dl>
            ${p.enlace ? `<p><a class="btn btn-sm" href="${esc(p.enlace)}" target="_blank" rel="noopener noreferrer">${small(ICON.arrow)}Abrir enlace de compra</a></p>` : '<p class="muted">Sin enlace de compra.</p>'}
          </div>
        </div>
        <section><h3>Descripción</h3>${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : '<p class="none">Sin descripción.</p>'}</section>
        <section><h3>Especificaciones</h3>${p.especificaciones.length ? list(p.especificaciones) : '<p class="none">Por completar con información confirmada.</p>'}</section>
        <section><h3>Justificación de compra</h3>${p.justificacion ? `<p>${esc(p.justificacion)}</p>` : '<p class="none">Sin justificación registrada.</p>'}</section>
        ${p.grupo ? `<section><h3>Alternativas para la misma necesidad («${esc(p.grupo)}»)</h3>${others.length ? `<ul class="pp-incl">${others.map(o => `<li><button type="button" class="pp-link" data-act="open" data-id="${esc(o.id)}">${esc(o.nombre)}</button><span>${esc(priceText(o))}</span>${estadoChip(o.estado)}</li>`).join('')}</ul>` : '<p class="none">No hay otras alternativas en este grupo.</p>'}
          <p class="muted">Agrupar no aprueba nada: la decisión de compra es tuya.</p></section>` : ''}
        ${p.videos.length ? `<section><h3>Videos de referencia</h3><p class="muted">Son videos, no imágenes del producto.</p><ul class="inv-list">${p.videos.map(v => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.titulo)}</a></li>`).join('')}</ul></section>` : ''}
        <section><h3>Observaciones</h3>${p.observaciones.length ? list(p.observaciones) : '<p class="none">Sin observaciones.</p>'}</section>
        <section><h3>Datos pendientes de confirmar</h3>${p.pendientes.length ? list(p.pendientes, 'inv-warn') : '<p class="none">Nada pendiente.</p>'}</section>
        <details class="inv-orig"><summary>Historial (${p.historial.length})</summary>
          <ul class="pp-hist">${p.historial.slice().reverse().map(h => `<li><time>${esc(fmtDate(h.at))}</time> <b>${esc(h.accion)}</b>${h.detalle ? ` · ${esc(h.detalle)}` : ''}</li>`).join('')}</ul></details>
      </div>
      <div class="modal-foot pp-dfoot">${actions(p, 'detail')}</div>`;
    hydrate(detail.el);
    if (scroll) scroll.scrollTop = top;
  }

  /* ── Acciones ── */
  async function approve(id) {
    const p = find(S.data, id); if (!p) return;
    const r = checkApprove(S.data, p);
    if (!r.ok) {
      const b = B();
      explain('No se puede aprobar', `<p><b>${esc(p.nombre)}</b>: ${esc(r.motivo)}</p>
        ${r.falta != null ? `<dl class="pp-dl"><div><dt>Importe del producto</dt><dd>${esc(money(r.importe))}</dd></div>
          <div><dt>Saldo disponible</dt><dd>${esc(money(r.saldo))}</dd></div>
          <div><dt>Total si se aprobara</dt><dd>${esc(money(r.nuevo))}</dd></div>
          <div class="pp-total"><dt>Falta</dt><dd>${esc(money(r.falta))}</dd></div></dl>
          <p class="muted">Aumenta el presupuesto máximo, retira otra aprobación o reduce la cantidad.</p>` : ''}
        ${b.maxCents == null ? '<p class="muted">Defínelo en el panel «Presupuesto».</p>' : ''}`);
      return;
    }
    const rivals = p.grupo ? S.data.productos.filter(x => x.grupo === p.grupo && x.id !== id && x.estado !== 'Pendiente') : [];
    if (rivals.length && !(await confirmDialog({ title: 'Ya hay otra alternativa aprobada', confirm: 'Aprobar también',
      body: `<p>En «${esc(p.grupo)}» ya está ${rivals.map(x => `<b>${esc(x.nombre)}</b> (${x.estado.toLowerCase()})`).join(', ')}. ¿Quieres aprobar también <b>${esc(p.nombre)}</b>?</p>` }))) return;
    const res = mutate(d => {
      const q = find(d, id); const rr = q && checkApprove(d, q);
      if (!rr || !rr.ok) return { error: rr ? rr.motivo : 'El producto ya no existe.' };
      q.estado = 'Aprobado'; log(q, 'Aprobado', `Reserva ${fmtMoney(rr.importe, d.presupuesto.moneda)}${rr.est ? ' (incluye estimación)' : ''}`);
      return { importe: rr.importe };
    });
    if (res.error) explain('No se puede aprobar', `<p>${esc(res.error)}</p>`);
    else toast(`Aprobado: se reservan ${money(res.importe)}. Saldo disponible: ${money(totals(S.data).saldo)}.`);
  }

  function unapprove(id) {
    const res = mutate(d => {
      const q = find(d, id);
      if (!q || q.estado !== 'Aprobado') return { error: 'Solo se puede retirar la aprobación de un producto aprobado y no comprado.' };
      const amt = budgetAmount(q, d.presupuesto).cents;
      q.estado = 'Pendiente'; log(q, 'Aprobación retirada', `Se liberan ${fmtMoney(amt, d.presupuesto.moneda)}`);
      return { amt };
    });
    if (res.error) explain('No se pudo retirar la aprobación', `<p>${esc(res.error)}</p>`);
    else toast(`Aprobación retirada: se liberaron ${money(res.amt)}.`);
  }

  async function buy(id) {
    const p = find(S.data, id); if (!p || p.estado !== 'Aprobado') return;
    const amt = budgetAmount(p, B()).cents;
    const ok = await confirmDialog({ title: 'Marcar como comprado', confirm: 'Marcar comprado',
      body: `<p>Se registrará la compra de <b>${esc(p.nombre)}</b> por ${esc(money(amt))}.</p><p class="muted" style="margin-top:6px">El importe ya está reservado: no se vuelve a sumar. Después, sus importes solo se pueden cambiar con «Corregir compra».</p>` });
    if (!ok) return;
    const res = mutate(d => {
      const q = find(d, id); if (!q || q.estado !== 'Aprobado') return { error: 'El producto ya no está aprobado.' };
      const c = budgetAmount(q, d.presupuesto).cents;
      q.estado = 'Comprado'; q.compra = { cents: c, moneda: d.presupuesto.moneda, fecha: now() };
      log(q, 'Comprado', fmtMoney(c, d.presupuesto.moneda));
    });
    if (res.error) explain('No se pudo registrar la compra', `<p>${esc(res.error)}</p>`); else toast(`«${p.nombre}» marcado como comprado.`);
  }

  /* Una compra realizada no se desmarca: se corrige con motivo y queda registrada. */
  function correct(id) {
    const p = find(S.data, id); if (!p || p.estado !== 'Comprado') return;
    const m = openModal({ size: 'sm', html: `<form novalidate>
      <div class="modal-head"><h2 data-modal-title>Corregir compra</h2></div>
      <div class="modal-body"><p><b>${esc(p.nombre)}</b> · comprado por ${esc(fmtMoney(p.compra.cents, p.compra.moneda))}</p>
        <fieldset class="field" style="margin-top:12px"><legend>Nuevo estado</legend>
          <label class="pp-radio"><input type="radio" name="to" value="Aprobado" checked> Aprobado (la compra no se realizó; mantiene la reserva)</label>
          <label class="pp-radio"><input type="radio" name="to" value="Pendiente"> Pendiente (libera el importe del presupuesto)</label></fieldset>
        <div class="field" data-f="motivo" style="margin-top:12px"><label for="pp-motivo">Motivo de la corrección <span class="req">*</span></label>
          <textarea id="pp-motivo" name="motivo" class="input" rows="3"></textarea><p class="err"></p></div>
        <div data-msg></div></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar corrección</button></div></form>`,
      initialFocus: '#pp-motivo' });
    const form = m.el.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const motivo = form.elements.motivo.value.trim(), to = form.elements.to.value;
      const fl = form.querySelector('[data-f="motivo"]');
      fl.classList.toggle('invalid', !motivo); fl.querySelector('.err').textContent = motivo ? '' : 'Explica el motivo de la corrección.';
      if (!motivo) { form.elements.motivo.focus(); return; }
      const res = mutate(d => {
        const q = find(d, id); if (!q || q.estado !== 'Comprado') return { error: 'El producto ya no está comprado.' };
        const prev = q.compra;
        q.estado = to; q.compra = null;
        log(q, 'Compra corregida', `De comprado (${fmtMoney(prev.cents, prev.moneda)}) a ${to.toLowerCase()}. Motivo: ${motivo}`);
        d.registro.push({ at: now(), productoId: q.id, producto: q.nombre, de: 'Comprado', a: to, cents: prev.cents, moneda: prev.moneda, motivo });
      });
      if (res.error) { form.querySelector('[data-msg]').innerHTML = alertBox('err', 'No se aplicó la corrección', `<p>${esc(res.error)}</p>`); return; }
      m.close('force'); toast('Corrección registrada.');
    });
  }

  async function remove(id) {
    const p = find(S.data, id); if (!p) return;
    if (p.estado === 'Comprado') { explain('No se puede quitar', '<p>Es una compra realizada. Usa primero «Corregir compra» para dejar constancia del cambio.</p>'); return; }
    const ok = await confirmDialog({ title: 'Quitar producto', confirm: 'Quitar', danger: true,
      body: `<p>Se quitará «<b>${esc(p.nombre)}</b>» de este navegador.${p.estado === 'Aprobado' ? ` Está aprobado: se liberarán ${esc(money(budgetAmount(p, B()).cents))}.` : ''}</p>` });
    if (!ok) return;
    const res = mutate(d => { const q = find(d, id); if (q && q.estado === 'Comprado') return { error: 'Ahora figura como comprado.' }; d.productos = d.productos.filter(x => x.id !== id); });
    if (res.error) { explain('No se pudo quitar', `<p>${esc(res.error)}</p>`); return; }
    if (p.imagen && p.imagen.tipo === 'archivo') idb.del(p.imagen.valor).catch(() => {});
    toast(`«${p.nombre}» se quitó.`);
  }

  function setImportance(id, v) {
    const res = mutate(d => { const q = find(d, id); if (!q) return { error: 'El producto ya no existe.' }; q.importancia = v; log(q, 'Importancia', v || 'Sin asignar'); });
    if (res.error) toast(res.error, 'err', 7000);
  }

  function saveBudget(form) {
    const rawMax = form.elements.max.value, cur = form.elements.cur.value.trim().toUpperCase();
    const max = parseMoney(rawMax);
    if (Number.isNaN(max)) { render(); explain('Importe no válido', '<p>Escribe el máximo con hasta dos decimales, por ejemplo «1500» o «1.500,50».</p>'); return; }
    if (cur && !curOk(cur)) { explain('Moneda no válida', '<p>Usa el código de tres letras de la moneda, por ejemplo USD, EUR o VES.</p>'); return; }
    if (max != null && !cur) { explain('Falta la moneda', '<p>Indica en qué moneda está el presupuesto máximo.</p>'); return; }
    const res = mutate(d => {
      d.presupuesto = { maxCents: max, moneda: cur };
      d.registro.push({ at: now(), tipo: 'presupuesto', maxCents: max, moneda: cur });
    });
    if (res.error) { render(); explain('No se cambió el presupuesto', `<p>${esc(res.error)}</p><p class="muted">Se conservan los valores anteriores.</p>`); }
    else toast(max == null ? 'Presupuesto máximo sin definir.' : `Presupuesto máximo: ${fmtMoney(max, cur)}.`);
  }

  /* ── Formulario de producto ── */
  function openForm(p = null) {
    const v = p || normProduct({ id: 'nuevo', nombre: 'x' });
    const locked = p && p.estado === 'Comprado';
    const cats = [...new Set(S.data.productos.map(x => x.categoria).filter(Boolean))];
    const groups = [...new Set(S.data.productos.map(x => x.grupo).filter(Boolean))];
    const field = (id, label, input, hint = '', full = false, req = false) => `<div class="field ${full ? 'full' : ''}" data-f="${id}"><label for="pf-${id}">${label}${req ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<p class="hint">${hint}</p>` : ''}<p class="err"></p></div>`;
    const text = (id, val, ph = '', extra = '') => `<input id="pf-${id}" name="${id}" class="input" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off" ${extra}>`;
    const area = (id, val, rows = 3) => `<textarea id="pf-${id}" name="${id}" class="input" rows="${rows}">${esc(val)}</textarea>`;
    const dis = locked ? 'disabled' : '';
    const cargoField = ([k, l]) => {
      const c = v.cargos[k];
      return `<div class="field pp-cargo" data-f="cargo-${k}"><label for="pf-ce-${k}">${l}</label>
        <div class="pp-cargo-row"><select id="pf-ce-${k}" name="ce-${k}" class="select" ${dis}>${CARGO_ESTADOS.map(([ek, el]) => `<option value="${ek}" ${ek === c.estado ? 'selected' : ''}>${el}</option>`).join('')}</select>
        <input name="cv-${k}" class="input" inputmode="decimal" aria-label="Importe de ${l.toLowerCase()}" placeholder="Importe" value="${['conocido', 'estimado'].includes(c.estado) ? esc(moneyText(c.cents)) : ''}" ${dis}></div><p class="err"></p></div>`;
    };
    const imgNow = v.imagen ? (v.imagen.tipo === 'url' ? 'Enlace' : v.imagen.tipo === 'archivo' ? 'Archivo subido' : 'Imagen del documento') : 'Sin imagen';
    const m = openModal({ size: 'pp-wide', html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">${p ? 'Editar producto' : 'Nuevo producto'}</p><h2 data-modal-title>${p ? esc(p.nombre) : 'Agregar producto'}</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body"><div data-msg></div>
        ${locked ? alertBox('info', 'Compra realizada', '<p>El precio, la moneda, la cantidad y los cargos no se pueden cambiar. Si hubo un error, usa «Corregir compra».</p>') : ''}
        ${p && p.estado === 'Aprobado' ? alertBox('info', 'Producto aprobado', '<p>Si cambias precio, cantidad o cargos, el nuevo total debe caber en el presupuesto; si no cabe, se conservan los valores anteriores.</p>') : ''}
        <div class="form-grid">
          ${field('nombre', 'Nombre', text('nombre', p ? v.nombre : ''), '', false, true)}
          ${field('categoria', 'Categoría', text('categoria', v.categoria, 'Ej. Mobiliario', 'list="pf-cats"') + `<datalist id="pf-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
          ${field('marca', 'Marca', text('marca', v.marca))}
          ${field('modelo', 'Modelo', text('modelo', v.modelo))}
          ${field('plataforma', 'Plataforma', `<select id="pf-plataforma" name="plataforma" class="select">${PLATAFORMAS.map(x => `<option ${x === v.plataforma ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
          ${field('proveedor', 'Proveedor', text('proveedor', v.proveedor, 'Tienda, vendedor o distribuidor'))}
          ${field('enlace', 'Enlace de compra', text('enlace', v.enlace, 'https://…', 'type="url"'), '', true)}
          ${field('precio', 'Precio unitario', text('precio', v.precioCents == null ? '' : moneyText(v.precioCents), 'Vacío = por cotizar', `inputmode="decimal" ${dis}`), 'Hasta dos decimales. Ej. 304,63')}
          ${field('moneda', 'Moneda', text('moneda', v.moneda, 'Vacío = por confirmar', `list="pp-curs" maxlength="3" ${dis}`), 'Código de tres letras (USD, EUR, VES…). Sin moneda no se puede aprobar.')}
          ${field('cantidad', 'Cantidad', `<input id="pf-cantidad" name="cantidad" class="input" type="number" min="1" step="1" value="${v.cantidad}" ${dis}>`)}
          ${field('importancia', 'Importancia', `<select id="pf-importancia" name="importancia" class="select"><option value="">Sin asignar</option>${IMPORTANCIAS.map(x => `<option ${x === v.importancia ? 'selected' : ''}>${x}</option>`).join('')}</select>`, 'Independiente de la aprobación.')}
          <fieldset class="field full pp-fs"><legend>Envío, impuestos y otros cargos</legend>
            <p class="hint">Un cargo pendiente no cuenta como cero: para aprobar, indica su importe, confírmalo en cero o reserva un importe estimado.</p>
            <div class="pp-cargos">${CARGOS.map(cargoField).join('')}</div></fieldset>
          <fieldset class="field full pp-fs"><legend>Equivalencia con la moneda del presupuesto (opcional)</legend>
            <p class="hint">Solo si el producto está en otra moneda. No se convierte nada sin una tasa explícita.</p>
            <div class="pp-cargo-row">${text('tasa', v.tasa ? rateText(v.tasa.micro) : '', '1 unidad = ?', `inputmode="decimal" aria-label="Tasa" ${dis}`)}
              ${text('tasaDestino', v.tasa ? v.tasa.destino : B().moneda, 'Moneda destino', `list="pp-curs" maxlength="3" aria-label="Moneda destino" ${dis}`)}
              ${text('tasaFuente', v.tasa ? v.tasa.fuente : '', 'Fuente y fecha de la tasa', `aria-label="Fuente de la tasa" ${dis}`)}</div><p class="err" data-tasa-err></p></fieldset>
          ${field('grupo', 'Grupo de alternativas', text('grupo', v.grupo, 'Ej. Dobladora de lámina', 'list="pf-groups"') + `<datalist id="pf-groups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>`, 'Productos que cubren la misma necesidad. No aprueba nada por sí solo.', true)}
          ${field('imagenUrl', 'Imagen por enlace', text('imagenUrl', v.imagen && v.imagen.tipo === 'url' ? v.imagen.valor : '', 'https://…', 'type="url"'), `Imagen actual: ${imgNow}.`)}
          ${field('imagenArchivo', 'o subir una imagen', '<input id="pf-imagenArchivo" name="imagenArchivo" type="file" accept="image/*" class="input">', 'Se reduce y se guarda en este navegador.')}
          ${v.imagen ? `<div class="field full"><label class="pp-radio"><input type="checkbox" name="sinImagen"> Quitar la imagen actual</label></div>` : ''}
          ${field('descripcion', 'Descripción', area('descripcion', v.descripcion), '', true)}
          ${field('especificaciones', 'Especificaciones', area('especificaciones', v.especificaciones.join('\n'), 4), 'Una por línea.', true)}
          ${field('justificacion', 'Justificación de compra', area('justificacion', v.justificacion), '', true)}
          ${field('observaciones', 'Observaciones', area('observaciones', v.observaciones.join('\n')), 'Una por línea.', true)}
          ${field('pendientes', 'Datos pendientes de confirmar', area('pendientes', v.pendientes.join('\n')), 'Una por línea.', true)}
        </div></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${ICON.ok}<span>Guardar</span></button></div>
    </form>`, initialFocus: '#pf-nombre' });
    const form = m.el.querySelector('form');
    let dirty = false;
    const syncCargos = () => CARGOS.forEach(([k]) => { const on = ['conocido', 'estimado'].includes(form.elements[`ce-${k}`].value); form.elements[`cv-${k}`].disabled = locked || !on; });
    syncCargos();
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('change', e => { if (e.target.name && e.target.name.startsWith('ce-')) syncCargos(); });
    m.setCanClose(() => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = n => (form.elements[n] ? form.elements[n].value : '');
      const errs = {};
      const precio = locked ? v.precioCents : parseMoney(f('precio'));
      if (Number.isNaN(precio)) errs.precio = 'Precio no válido: usa hasta dos decimales.';
      const moneda = locked ? v.moneda : f('moneda').trim().toUpperCase();
      if (moneda && !curOk(moneda)) errs.moneda = 'Usa un código de tres letras.';
      const cantidad = locked ? v.cantidad : Number(f('cantidad'));
      if (!Number.isInteger(cantidad) || cantidad < 1) errs.cantidad = 'La cantidad debe ser un número entero mayor que cero.';
      const cargos = locked ? v.cargos : {};
      if (!locked) CARGOS.forEach(([k, l]) => {
        const estado = f(`ce-${k}`);
        if (!['conocido', 'estimado'].includes(estado)) { cargos[k] = { estado, cents: 0 }; return; }
        const c = parseMoney(f(`cv-${k}`));
        if (c == null || Number.isNaN(c)) errs[`cargo-${k}`] = `Indica el importe de ${l.toLowerCase()}.`;
        else cargos[k] = { estado, cents: c };
      });
      let tasa = locked ? v.tasa : null;
      const tasaErr = form.querySelector('[data-tasa-err]'); tasaErr.textContent = ''; tasaErr.style.display = 'none';
      if (!locked && f('tasa').trim()) {
        const micro = parseRate(f('tasa')), dest = f('tasaDestino').trim().toUpperCase();
        const msg = Number.isNaN(micro) ? 'Tasa no válida (número positivo, hasta 6 decimales).' : !curOk(dest) ? 'Indica la moneda destino.' : !moneda ? 'Primero indica la moneda del producto.' : dest === moneda ? 'La moneda destino es la misma del producto.' : '';
        if (msg) { errs.tasa = msg; tasaErr.textContent = msg; tasaErr.style.display = 'block'; }
        else tasa = { micro, destino: dest, fuente: f('tasaFuente').trim() };
      }
      const nombre = f('nombre').trim();
      if (!nombre) errs.nombre = 'Escribe el nombre del producto.';
      const enlace = f('enlace').trim();
      if (enlace && !webUrl(enlace)) errs.enlace = 'El enlace debe empezar por https:// o http://';
      const imgUrl = f('imagenUrl').trim();
      if (imgUrl && !webUrl(imgUrl)) errs.imagenUrl = 'El enlace de la imagen debe empezar por https://';
      else if (/youtube\.com|youtu\.be/.test(imgUrl)) errs.imagenUrl = 'Es un enlace de video, no de una imagen.';
      const file = form.elements.imagenArchivo.files[0];
      if (file && !file.type.startsWith('image/')) errs.imagenArchivo = 'El archivo no es una imagen.';
      else if (file && file.size > 15 * 1024 * 1024) errs.imagenArchivo = 'La imagen supera 15 MB.';
      form.querySelectorAll('[data-f]').forEach(fl => { const er = errs[fl.dataset.f]; fl.classList.toggle('invalid', !!er); fl.querySelector('.err').textContent = er || ''; });
      if (Object.keys(errs).length) { const first = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea') || form.elements.tasa; first && first.focus(); return; }

      // Imagen: archivo nuevo > enlace > se conserva la actual (salvo que se pida quitarla).
      let imagen = form.elements.sinImagen && form.elements.sinImagen.checked ? null : v.imagen;
      let newKey = null;
      if (file) {
        newKey = uid('img');
        try { await idb.put(newKey, await shrink(file)); imagen = { tipo: 'archivo', valor: newKey }; }
        catch (er) { form.querySelector('[data-msg]').innerHTML = alertBox('err', 'No se pudo guardar la imagen', `<p>${esc(er && er.message || 'Almacenamiento no disponible')}. El producto no se guardó.</p>`); return; }
      } else if (imgUrl && !(v.imagen && v.imagen.tipo === 'url' && v.imagen.valor === imgUrl && imagen)) imagen = { tipo: 'url', valor: imgUrl };

      const id = p ? p.id : uid('prod');
      const next = normProduct({
        ...(p || {}), id, nombre, marca: f('marca'), modelo: f('modelo'), categoria: f('categoria'), plataforma: f('plataforma'), proveedor: f('proveedor'),
        enlace, imagen, precioCents: precio, moneda, cantidad, cargos, tasa, importancia: f('importancia'), grupo: f('grupo'),
        descripcion: f('descripcion'), especificaciones: lines(f('especificaciones')), justificacion: f('justificacion'),
        observaciones: lines(f('observaciones')), pendientes: lines(f('pendientes')),
        estado: p ? p.estado : 'Pendiente', compra: p ? p.compra : null, historial: p ? p.historial : []
      });
      const res = mutate(d => {
        const cur = find(d, id);
        if (p && !cur) return { error: 'El producto ya no existe.' };
        if (p) { next.estado = cur.estado; next.compra = cur.compra; next.historial = cur.historial; }
        log(next, p ? 'Editado' : 'Agregado');
        d.productos = p ? d.productos.map(x => (x.id === id ? next : x)) : [...d.productos, next];
      });
      if (res.error) {
        if (newKey) idb.del(newKey).catch(() => {});
        form.querySelector('[data-msg]').innerHTML = alertBox('err', 'No se guardaron los cambios', `<p>${esc(res.error)}</p><p>Se conservan los valores anteriores.</p>`);
        form.querySelector('[data-msg]').scrollIntoView({ block: 'nearest' });
        return;
      }
      if (p && p.imagen && p.imagen.tipo === 'archivo' && (!next.imagen || next.imagen.valor !== p.imagen.valor)) idb.del(p.imagen.valor).catch(() => {});
      dirty = false; m.close('force');
      toast(p ? `Cambios guardados en «${next.nombre}».` : `«${next.nombre}» se agregó como pendiente.`);
    });
  }

  /* ── Exportar / importar ── */
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportJson() {
    const imagenesArchivo = {};
    for (const p of S.data.productos) if (p.imagen && p.imagen.tipo === 'archivo') {
      try { const b = await idb.get(p.imagen.valor); if (b) imagenesArchivo[p.imagen.valor] = await blobToDataUrl(b); } catch { /* se exporta sin esa imagen */ }
    }
    download(`presupuestos-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...S.data, exportado: now(), imagenesArchivo }, null, 2));
    toast('Respaldo exportado.');
  }

  async function onImportFile(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) { toast('El archivo es demasiado grande (máximo 40 MB).', 'err'); return; }
    let obj; try { obj = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.', 'err', 7000); return; }
    const r = validateState(obj);
    if (!r.ok) { explain('No se importó', `<p>${esc(r.error)}</p>`); return; }
    const ok = await confirmDialog({ title: 'Reemplazar datos', confirm: 'Reemplazar', danger: true,
      body: `<p>Se reemplazarán los ${S.data.productos.length} productos y el presupuesto de este navegador por los ${r.value.productos.length} productos del archivo «${esc(file.name)}».</p>` });
    if (!ok) return;
    try {
      for (const [k, dataUrl] of Object.entries(obj.imagenesArchivo || {})) {
        if (!/^img-[\w-]{4,40}$/.test(k) || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
        await idb.put(k, await (await fetch(dataUrl)).blob()); urls.delete(k);
      }
    } catch { toast('Algunas imágenes subidas no se pudieron importar; se mostrará el marcador.', 'err', 8000); }
    const res = mutate(d => { d.presupuesto = r.value.presupuesto; d.productos = r.value.productos; d.registro = r.value.registro; });
    if (res.error) explain('No se importó', `<p>${esc(res.error)}</p>`); else toast('Datos importados.');
  }

  async function reset() {
    const ok = await confirmDialog({ title: 'Restaurar datos iniciales', confirm: 'Restaurar', danger: true,
      body: '<p>Se borrarán de este navegador todos los productos, el presupuesto, las aprobaciones y las imágenes subidas, y se cargarán otra vez los productos del documento como pendientes.</p><p class="muted" style="margin-top:6px">Exporta un respaldo antes si quieres conservarlos.</p>' });
    if (!ok) return;
    storage.clear(); idb.clear().catch(() => {});
    urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
    S.data = null; S.rawBad = null; S.error = null;
    await load(); toast('Datos iniciales restaurados.');
  }

  /* ── Eventos ── */
  function act(name, id) {
    switch (name) {
      case 'open': if (detail) { S.detailId = id; fillDetail(); } else openDetail(id); break;
      case 'approve': approve(id); break;
      case 'unapprove': unapprove(id); break;
      case 'buy': buy(id); break;
      case 'correct': correct(id); break;
      case 'edit': { const p = find(S.data, id); if (p) openForm(p); break; }
      case 'delete': remove(id); break;
      case 'add': openForm(); break;
      case 'export': exportJson(); break;
      case 'import': root.querySelector('[data-import]').click(); break;
      case 'reset': reset(); break;
      case 'dump': download(`presupuestos-guardado-${new Date().toISOString().slice(0, 10)}.json`, S.rawBad.raw); break;
      case 'panel': S.panelOpen = !S.panelOpen; render(); root.querySelector('[data-act="panel"]').focus(); break;
      case 'clear': S.q = S.plat = S.imp = S.cat = S.est = ''; savePrefs(); render(); break;
    }
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && root.contains(b)) { act(b.dataset.act, b.dataset.id); return; }
    // Pulsar la tarjeta (fuera de sus controles) abre la ficha.
    const c = e.target.closest('[data-card]');
    if (c && !e.target.closest('a, button, input, select, textarea, label')) openDetail(c.dataset.card);
  });
  root.addEventListener('change', e => {
    if (e.target.dataset.imp) { setImportance(e.target.dataset.imp, e.target.value); return; }
    if (e.target.dataset.filter) { S[e.target.dataset.filter] = e.target.value; savePrefs(); render(); }
    if (e.target.matches('[data-import]')) onImportFile(e);
  });
  root.addEventListener('input', e => {
    if (e.target.id !== 'pp-q') return;
    S.q = e.target.value; savePrefs();
    const pos = e.target.selectionStart; render();
    const n = root.querySelector('#pp-q'); n.focus(); n.setSelectionRange(pos, pos);
  });
  root.addEventListener('submit', e => { if (e.target.matches('[data-budget]')) { e.preventDefault(); saveBudget(e.target); } });

  // Otra pestaña del mismo navegador guardó cambios: se adoptan para no pisarlos.
  const onStorage = e => {
    if (e.key !== STORE_KEY || !S.data || !e.newValue) return;
    try { const r = validateState(JSON.parse(e.newValue)); if (r.ok && r.value.rev > S.data.rev) { S.data = r.value; render(); toast('Se cargaron cambios hechos en otra pestaña.'); } } catch { /* se ignora */ }
  };
  window.addEventListener('storage', onStorage);

  load();
  return () => { alive = false; window.removeEventListener('storage', onStorage); urls.forEach(u => URL.revokeObjectURL(u)); };
}
