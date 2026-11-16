/* Mapa de Postventa.
   Biblioteca: Leaflet 1.9.4 (BSD-2) + Leaflet.markercluster 1.5.3 (MIT), desde cdnjs con versión fija; se cargan
   solo al abrir el mapa. Cartografía: teselas estándar de OpenStreetMap (detalle hasta nivel de calle).
   · Atribución obligatoria: «© colaboradores de OpenStreetMap» (visible en el mapa; no se debe quitar).
   · Costo: sin costo, con la política de uso justo de OpenStreetMap (uso moderado, sin descargas masivas).
     Si el uso crece, se puede cambiar TESELAS por un proveedor con plan (MapTiler, Carto…) sin tocar el resto.
   · Solo se dibujan talleres con coordenadas confirmadas; los demás aparecen en la lista como «Ubicación pendiente». */
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const RECURSOS = {
  css: [CDN + 'leaflet/1.9.4/leaflet.css', CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.css', CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.Default.css'],
  js: [CDN + 'leaflet/1.9.4/leaflet.js', CDN + 'leaflet.markercluster/1.5.3/leaflet.markercluster.js']
};
const TESELAS = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19,
  atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>' };
export const VENEZUELA = { centro: [7.0, -66.2], zoom: 6 };

let carga = null;
export function cargarLeaflet() {
  if (window.L && window.L.markerClusterGroup) return Promise.resolve(window.L);
  if (carga) return carga;
  const css = h => new Promise(res => { if (document.querySelector(`link[href="${h}"]`)) return res(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; l.onload = res; l.onerror = res; document.head.append(l); });
  const js = s => new Promise((res, rej) => { const e = document.createElement('script'); e.src = s; e.onload = res; e.onerror = () => rej(new Error('No se pudo cargar el mapa. Revisa la conexión.')); document.head.append(e); });
  carga = Promise.all(RECURSOS.css.map(css)).then(() => js(RECURSOS.js[0])).then(() => js(RECURSOS.js[1])).then(() => window.L)
    .catch(e => { carga = null; throw e; });
  return carga;
}
export const capaBase = L => L.tileLayer(TESELAS.url, { maxZoom: TESELAS.max, attribution: TESELAS.atribucion });
const icono = (L, n) => L.divIcon({ className: 'mq-marcador', html: `<span>${n || ''}</span>`, iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26] });

/* Mapa principal: un marcador por taller con coordenadas confirmadas, agrupados cuando están cerca.
   popupHtml(t) devuelve el resumen del taller (con un botón para abrir su ficha). */
let mapaActual = null;
export async function montarMapa(el, items, popupHtml) {
  const L = await cargarLeaflet();
  if (mapaActual) { mapaActual.remove(); mapaActual = null; }
  if (!el.isConnected) return null;
  const mapa = L.map(el, { scrollWheelZoom: true }).setView(VENEZUELA.centro, VENEZUELA.zoom);
  capaBase(L).addTo(mapa);
  const grupo = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
  const puntos = [];
  items.forEach(({ t, n }) => {
    const m = L.marker([t.lat, t.lng], { icon: icono(L, n), title: t.nombre, keyboard: true });
    m.bindPopup(popupHtml(t), { maxWidth: 280 });
    grupo.addLayer(m); puntos.push([t.lat, t.lng]);
  });
  mapa.addLayer(grupo);
  if (puntos.length === 1) mapa.setView(puntos[0], 16); else if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 });
  mapaActual = mapa;
  setTimeout(() => mapa.invalidateSize(), 50);
  return mapa;
}
export function desmontarMapa() { if (mapaActual) { mapaActual.remove(); mapaActual = null; } }

/* Mapa pequeño del formulario del taller: clic para marcar la entrada del taller (acercarse hasta ver la calle). */
export async function miniMapa(el, lat, lng, alElegir) {
  const L = await cargarLeaflet();
  const hay = Number.isFinite(lat) && Number.isFinite(lng);
  const mapa = L.map(el).setView(hay ? [lat, lng] : VENEZUELA.centro, hay ? 17 : VENEZUELA.zoom);
  capaBase(L).addTo(mapa);
  let m = hay ? L.marker([lat, lng], { icon: icono(L, '') }).addTo(mapa) : null;
  mapa.on('click', e => {
    const p = e.latlng;
    if (m) m.setLatLng(p); else m = L.marker(p, { icon: icono(L, '') }).addTo(mapa);
    alElegir(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), mapa.getZoom());
  });
  setTimeout(() => mapa.invalidateSize(), 80);
  return { mover: (a, b) => { if (!Number.isFinite(a) || !Number.isFinite(b)) return; if (m) m.setLatLng([a, b]); else m = L.marker([a, b], { icon: icono(L, '') }).addTo(mapa); mapa.setView([a, b], Math.max(mapa.getZoom(), 16)); }, quitar: () => mapa.remove() };
}
