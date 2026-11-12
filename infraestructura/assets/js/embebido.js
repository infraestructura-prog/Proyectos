/* Monta en modulo.html uno de los módulos traídos del dashboard publicado: modulo.html?m=<id>.
   Los módulos son copias sin cambios de lógica; aquí solo se les da el contexto que esperaban del sitio
   (sin sesión ni permisos de edición) y se redirigen sus enlaces internos («#/…») a la página principal. */
import { alertBox, esc } from './ui.js';

export const MODULOS = {
  maquinas: { carga: () => import('./modules/maquinas.js'), base: '#/maquinas' }
};
// Rutas del sitio publicado → rutas del prototipo (para los botones «Volver a…» de los módulos).
const RUTAS = [[/^#\/infraestructura\/maquinas/, '#/maquinas'], [/^#\/infraestructura/, '#/objetivos']];
const traducir = h => { const r = RUTAS.find(([re]) => re.test(h)); return r ? r[1] : h; };

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]'); if (!a) return;
  e.preventDefault();
  window.parent.location.hash = traducir(a.getAttribute('href'));
}, true);

const id = new URLSearchParams(location.search).get('m');
const main = document.getElementById('main');
const m = MODULOS[id];
if (!m) main.innerHTML = alertBox('err', 'Módulo no encontrado', `<p>No existe el módulo «${esc(id || '')}».</p>`);
else {
  try {
    const mod = await m.carga();
    const host = document.createElement('div');
    main.replaceChildren(host);
    const sub = (new URLSearchParams(location.search).get('sub') || '').split('/').filter(Boolean);
    mod.mount(host, { sub, base: m.base, setExtraCrumbs() {}, auth: null, canEdit: () => false, onAuthChange() { return () => {}; }, openLogin() {} });
  } catch (err) {
    console.error(err);
    main.innerHTML = alertBox('err', 'No se pudo cargar este módulo', `<p>${esc(err.message)}</p>`);
  }
}
// Si el módulo cambia su propio hash (p. ej., después de una acción), la página principal lo sigue.
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) window.parent.location.hash = traducir(location.hash); });
