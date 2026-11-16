/* Máquinas de simulación · mapa de Postventa (ubicación de las ventas).
   · Leaflet 1.9.4 desde cdnjs (versión fija) + teselas estándar de OpenStreetMap por HTTPS. Sin claves, sin cuentas
     y sin servicios de pago. Los créditos «© colaboradores de OpenStreetMap» quedan siempre visibles.
   · Política de uso de OpenStreetMap: solo se piden las teselas que se ven en pantalla, con la caché normal del
     navegador; no hay descargas masivas, precarga de regiones, capas satelitales ni búsquedas automáticas.
   · El mapa principal se crea UNA vez y su elemento se vuelve a colocar tras cada repintado: no se pierde el zoom
     ni la posición al filtrar o abrir fichas. Solo se encuadran todos los puntos al crearlo o con «Ver todas».
   · Si la cartografía falla, el listado de ventas sigue disponible y el mapa ofrece «Reintentar». */
import { cargarLeaflet, capaBase, VENEZUELA } from './maq-mapa.js';

let estado = { fase: 'inicial' };   // inicial | cargando | listo | error
export const estadoMapa = () => estado;
export function cargarMapa() {
  if (window.L) { estado = { fase: 'listo' }; return Promise.resolve(window.L); }
  estado = { fase: 'cargando' };
  return cargarLeaflet().then(L => { estado = { fase: 'listo' }; return L; },
    e => { estado = { fase: 'error', mensaje: e.message || 'No se pudo cargar el mapa.' }; throw e; });
}
export const reiniciarCarga = () => { if (estado.fase === 'error') estado = { fase: 'inicial' }; };
const tactil = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

/* Marcador: etiqueta con el ID de la venta + símbolo y texto de precisión (no depende solo del color). */
const pinHtml = (v, activo) => {
  const ex = v.ubicacion.precision === 'exacta';
  const id = String(v.id).replace(/[<>&"]/g, '');
  return `<span class="vt-pin ${ex ? 'vt-pin-exacta' : 'vt-pin-aprox'}${activo ? ' activo' : ''}"><span class="vt-pin-ico" aria-hidden="true">${ex ? '✓' : '≈'}</span><b>${id}</b><small>${ex ? 'Exacta' : 'Aprox.'}</small></span>`;
};
const icono = (L, v, activo) => L.divIcon({ className: 'vt-pin-wrap', html: pinHtml(v, activo), iconSize: [92, 28], iconAnchor: [46, 14], popupAnchor: [0, -14] });

/* ── Mapa principal ── */
let mapa = null, el = null, capa = null, grupo = null, aviso = null, encuadrado = false, activo = '';
let cargadas = 0, fallidas = 0;
const marcas = new Map();   // id de venta → { m, firma, v }
let popup = () => '';

function avisoTeselas(mostrar) {
  if (!aviso) return;
  aviso.hidden = !mostrar;
}
export function montarPrincipal(slot, visibles, todas, popupHtml) {
  if (!window.L) return false;
  const L = window.L; popup = popupHtml;
  if (!el) {
    el = document.createElement('div'); el.className = 'vt-mapa-leaflet'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Mapa de ubicación de las ventas');
    // En pantallas táctiles el mapa no captura el arrastre con un dedo, para no bloquear el desplazamiento de la página:
    // se acerca/aleja con los botones o con dos dedos.
    mapa = L.map(el, { scrollWheelZoom: true, dragging: !tactil(), tap: !tactil(), zoomControl: true }).setView(VENEZUELA.centro, VENEZUELA.zoom);
    capa = capaBase(L).addTo(mapa);
    capa.on('tileload', () => { cargadas++; avisoTeselas(false); });
    capa.on('tileerror', () => { fallidas++; if (fallidas >= 4 && cargadas === 0) avisoTeselas(true); });
    grupo = L.layerGroup().addTo(mapa);
    aviso = document.createElement('div'); aviso.className = 'vt-mapa-fallo'; aviso.hidden = true;
    aviso.innerHTML = '<p><b>No se pudo cargar la cartografía de OpenStreetMap.</b> Revisa la conexión. Las ventas siguen disponibles en el listado.</p><button type="button" class="btn btn-sm" data-act="vt-mapa-reintentar">Reintentar</button>';
    el.append(aviso);
  }
  if (el.parentNode !== slot) { slot.replaceChildren(el); setTimeout(() => mapa.invalidateSize(), 30); }
  const conUb = todas.filter(v => v.ubicacion && v.ubicacion.lat !== null);
  const ids = new Set(conUb.map(v => v.id));
  [...marcas.keys()].forEach(id => { if (!ids.has(id)) { grupo.removeLayer(marcas.get(id).m); marcas.delete(id); } });
  conUb.forEach(v => {
    const firma = [v.ubicacion.lat, v.ubicacion.lng, v.ubicacion.precision, activo === v.id].join('|');
    let x = marcas.get(v.id);
    if (!x) {
      const m = L.marker([v.ubicacion.lat, v.ubicacion.lng], { icon: icono(L, v, activo === v.id), keyboard: true, riseOnHover: true,
        title: `${v.id} · ${v.ubicacion.precision === 'exacta' ? 'ubicación exacta' : 'ubicación aproximada'}`, alt: `Marcador ${v.id}` });
      m.bindPopup(() => popup((marcas.get(v.id) || {}).v || v), { maxWidth: 290, minWidth: 210 });
      x = { m, firma, v }; marcas.set(v.id, x);
    } else if (x.firma !== firma) {
      x.m.setLatLng([v.ubicacion.lat, v.ubicacion.lng]); x.m.setIcon(icono(L, v, activo === v.id)); x.firma = firma;
    }
    x.v = v;
  });
  // Los filtros deciden qué marcadores se ven (sin recrear el mapa ni cambiar el zoom).
  const vis = new Set(visibles.filter(v => ids.has(v.id)).map(v => v.id));
  marcas.forEach((x, id) => { const esta = grupo.hasLayer(x.m); if (vis.has(id) && !esta) grupo.addLayer(x.m); if (!vis.has(id) && esta) { x.m.closePopup(); grupo.removeLayer(x.m); } });
  if (!encuadrado && vis.size) { encuadrar([...vis]); encuadrado = true; }
  return true;
}
function encuadrar(ids) {
  const pts = ids.map(id => marcas.get(id)).filter(Boolean).map(x => x.m.getLatLng());
  if (!pts.length) return;
  if (pts.length === 1) mapa.setView(pts[0], 12); else mapa.fitBounds(window.L.latLngBounds(pts), { padding: [50, 50], maxZoom: 13 });
}
export function verTodas(visibles) { if (mapa) { mapa.closePopup(); encuadrar(visibles.map(v => v.id).filter(id => marcas.has(id) && grupo.hasLayer(marcas.get(id).m))); } }
/* Localiza y resalta la venta elegida en el listado. */
export function localizar(id) {
  const x = marcas.get(id); if (!mapa || !x || !grupo.hasLayer(x.m)) return false;
  const anterior = activo; activo = id;
  [anterior, id].forEach(k => { const y = marcas.get(k); if (y) { y.m.setIcon(icono(window.L, y.v, k === id)); y.firma = [y.v.ubicacion.lat, y.v.ubicacion.lng, y.v.ubicacion.precision, k === id].join('|'); } });
  x.m.setZIndexOffset(1000);
  mapa.setView(x.m.getLatLng(), Math.max(mapa.getZoom(), 11));
  x.m.openPopup();
  return true;
}
/* «Reintentar»: vuelve a pedir las teselas visibles (no descarga nada más). */
export function reintentarTeselas() { if (capa) { fallidas = 0; cargadas = 0; avisoTeselas(false); capa.redraw(); } }
export const hayMapa = () => !!mapa;

/* ── Mapa del editor de ubicación (marcador arrastrable solo aquí) ── */
export function montarEditor(div, punto, alMover) {
  if (!window.L) return null;
  const L = window.L, hay = punto && Number.isFinite(punto.lat) && Number.isFinite(punto.lng);
  const m = L.map(div, { scrollWheelZoom: true }).setView(hay ? [punto.lat, punto.lng] : VENEZUELA.centro, hay ? 15 : VENEZUELA.zoom);
  const c = capaBase(L).addTo(m);
  let ok = 0, ko = 0;
  c.on('tileload', () => { ok++; }); c.on('tileerror', () => { ko++; if (ko >= 4 && !ok && !div.querySelector('.vt-mapa-fallo')) div.insertAdjacentHTML('beforeend', '<div class="vt-mapa-fallo"><p>No se pudo cargar la cartografía. Puedes escribir las coordenadas.</p></div>'); });
  const ico = L.divIcon({ className: 'vt-pin-wrap', html: '<span class="vt-pin vt-pin-edicion"><span class="vt-pin-ico" aria-hidden="true">✥</span><b>Arrástrame</b></span>', iconSize: [110, 28], iconAnchor: [55, 14] });
  let mk = null;
  const poner = (lat, lng, centrar) => {
    if (!mk) {
      mk = L.marker([lat, lng], { icon: ico, draggable: true, keyboard: true, title: 'Punto propuesto (arrástralo para ajustarlo)' }).addTo(m);
      mk.on('dragend', () => { const p = mk.getLatLng(); alMover(+p.lat.toFixed(6), +p.lng.toFixed(6)); });
    } else mk.setLatLng([lat, lng]);
    if (centrar) m.setView([lat, lng], Math.max(m.getZoom(), 15));
  };
  if (hay) poner(punto.lat, punto.lng, false);
  m.on('click', e => { const la = +e.latlng.lat.toFixed(6), ln = +e.latlng.lng.toFixed(6); poner(la, ln, false); alMover(la, ln); });
  setTimeout(() => m.invalidateSize(), 80);
  return { mover: (lat, lng) => { if (Number.isFinite(lat) && Number.isFinite(lng)) poner(lat, lng, true); }, quitar: () => m.remove() };
}
