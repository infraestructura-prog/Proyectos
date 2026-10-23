/* Armazón de la aplicación: rutas (#/…), migas de pan, cambio de área y sesión. */
import { TREE, resolve, pathOf } from './registry.js';
import { esc, ICON, openModal, closeAllModals, toast, alertBox } from './ui.js';
import { api } from './api.js';
import { infraHero, INFRA_ART } from './infra-theme.js';
import { neoHero, NEO_ART } from './neo-theme.js';

/* ═════════ Sesión ═════════ */
export const auth = { user: null, role: null, configured: null, checked: false };
const authListeners = new Set();
export const onAuthChange = fn => { authListeners.add(fn); return () => authListeners.delete(fn); };
export const canEdit = () => auth.role === 'editor';
const emitAuth = () => { renderSession(); authListeners.forEach(fn => fn(auth)); };

async function checkSession() {
  try {
    const d = await api('/api/auth');
    Object.assign(auth, { user: d.user || null, role: d.role || null, configured: !!d.configured });
  } catch {
    Object.assign(auth, { user: null, role: null, configured: false });
  }
  auth.checked = true;
  emitAuth();
}

export function openLogin(reason = '') {
  const m = openModal({
    size: 'sm',
    html: `<form novalidate>
      <div class="modal-head"><div><p class="kicker">Acceso</p><h2 data-modal-title>Iniciar sesión</h2></div>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="modal-body form-grid" style="grid-template-columns:1fr">
        ${reason ? `<p class="muted">${esc(reason)}</p>` : ''}
        <div class="field"><label for="lg-user">Usuario <span class="req">*</span></label>
          <input id="lg-user" name="user" class="input" autocomplete="username" required autofocus></div>
        <div class="field"><label for="lg-pass">Contraseña <span class="req">*</span></label>
          <input id="lg-pass" name="password" type="password" class="input" autocomplete="current-password" required></div>
        <div data-msg></div>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${ICON.lock}<span>Entrar</span></button></div>
    </form>`
  });
  const form = m.el.querySelector('form'), msg = m.el.querySelector('[data-msg]'), btn = form.querySelector('[type=submit]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (btn.disabled) return;
    const user = form.user.value.trim(), password = form.password.value;
    if (!user || !password) { msg.innerHTML = alertBox('err', 'Escribe tu usuario y tu contraseña.'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Verificando…</span>';
    try {
      const d = await api('/api/auth', { method: 'POST', body: { action: 'login', user, password } });
      Object.assign(auth, { user: d.user, role: d.role, configured: true });
      m.close('force'); emitAuth(); toast(`Sesión iniciada como ${d.user}.`);
    } catch (err) {
      msg.innerHTML = alertBox('err', 'No se pudo iniciar sesión', `<p>${esc(err.message)}</p>`);
      btn.disabled = false; btn.innerHTML = `${ICON.lock}<span>Entrar</span>`;
      form.password.select();
    }
  });
}

async function logout() {
  try { await api('/api/auth', { method: 'POST', body: { action: 'logout' } }); } catch { /* la cookie expira igual */ }
  Object.assign(auth, { user: null, role: null });
  emitAuth(); toast('Sesión cerrada.');
}

function renderSession() {
  const el = document.getElementById('session');
  if (!auth.checked) { el.innerHTML = ''; return; }
  if (auth.user) {
    el.innerHTML = `<span class="who" title="Rol: ${esc(auth.role)}">${esc(auth.user)} · ${auth.role === 'editor' ? 'editor' : 'lector'}</span>
      <button class="btn btn-sm" id="btn-logout">${ICON.logout}<span>Salir</span></button>`;
    el.querySelector('#btn-logout').onclick = logout;
  } else if (auth.configured) {
    el.innerHTML = `<button class="btn btn-sm" id="btn-login">${ICON.lock}<span>Iniciar sesión</span></button>`;
    el.querySelector('#btn-login').onclick = () => openLogin();
  } else {
    // Sin usuarios configurados en el servidor no se muestra el botón (la edición de máquinas usa su propia clave).
    el.innerHTML = '';
  }
}

/* ═════════ Rutas ═════════ */
const main = document.getElementById('main');
let cleanup = null, routeToken = 0;

const segmentsOf = () => (location.hash.replace(/^#\/?/, '').split('?')[0]).split('/').filter(Boolean).map(decodeURIComponent);

function renderCrumbs(chain, extra = []) {
  const items = chain.map((n, i) => ({ title: n.title, href: pathOf(chain.slice(0, i + 1)) })).concat(extra);
  document.getElementById('crumbs').innerHTML = `<ol>${items.map((it, i) => i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.title)}</span></li>`
    : `<li><a href="${it.href}">${esc(it.title)}</a></li>`).join('')}</ol>`;
  document.title = (items.length > 1 ? items[items.length - 1].title + ' · ' : '') + 'Departamento de Ensamblaje · Suspensiones CCS';
}

function renderAreaSwitch(chain) {
  const active = chain[1] && chain[1].id;
  document.getElementById('area-switch').innerHTML =
    `<a href="#/" ${!active ? 'aria-current="true"' : ''}>Inicio</a>` +
    TREE.children.map(a => `<a href="#/${a.id}" ${a.id === active ? 'aria-current="true"' : ''}>${esc(a.title)}</a>`).join('');
}

const card = (n, href, cls = '') => {
  // La tarjeta de Infraestructura en el inicio adelanta su identidad de taller (estilos en infra.css).
  const infra = n.id === 'infraestructura';
  return `<a class="area-card ${n.tone === 'mint' && !infra ? 'mint' : ''} ${infra ? 'infra-card' : ''} ${cls}" href="${href}">
  <span class="ic">${ICON[n.icon] || ICON.list}</span>
  ${infra ? '<span class="infra-tag">Taller · Maquinaria · Oficinas</span>' : ''}
  <h2>${esc(n.title)}</h2><p>${esc(n.desc || '')}</p>
  <span class="go">Abrir ${ICON.arrow.replace('<svg', '<svg width="16" height="16"')}</span></a>`;
};

/* Tarjetas de acceso del inicio: misma estructura (ilustración, etiqueta, título, descripción, acción);
   cada una adelanta la identidad visual de su área. */
const HOME_CARDS = {
  neotropya: { cls: 'neo-card', tagCls: 'neo-tag', art: () => NEO_ART, tag: 'Impresión 3D · Conectividad · Energía solar',
    desc: 'Fabricación digital, conectividad y soluciones para las personas', go: 'Entrar a Neotropya' },
  infraestructura: { cls: 'infra-card', tagCls: 'infra-tag', art: () => INFRA_ART, tag: 'Taller · Maquinaria · Oficinas',
    desc: 'Mantenimiento, taller y desarrollo de proyectos', go: 'Entrar a Infraestructura' }
};

function renderHome() {
  main.innerHTML = `<section class="hero fade-in">
      <p class="eyebrow">Espacio de trabajo</p>
      <h1>Departamento de Ensamblaje · <span class="accent">Suspensiones CCS</span></h1>
      <p>Bienvenido. Elige el área en la que vas a trabajar hoy.</p>
    </section>
    <section class="home-cards fade-in" aria-label="Áreas">
      ${TREE.children.map(a => {
        const c = HOME_CARDS[a.id];
        if (!c) return card(a, '#/' + a.id);
        return `<a class="area-card home-card ${c.cls}" href="#/${a.id}">
          <span class="home-art" aria-hidden="true">${c.art()}</span>
          <span class="home-tag ${c.tagCls}">${esc(c.tag)}</span>
          <h2>${esc(a.title)}</h2>
          <p>${esc(c.desc)}</p>
          <span class="go">${esc(c.go)} ${ICON.arrow.replace('<svg', '<svg width="16" height="16"')}</span>
        </a>`;
      }).join('')}
    </section>`;
  // Las ilustraciones son decorativas dentro de la tarjeta (el enlace ya tiene su texto).
  main.querySelectorAll('.home-art svg').forEach(s => { s.removeAttribute('role'); s.removeAttribute('aria-label'); s.setAttribute('aria-hidden', 'true'); });
}

function renderBranch(chain) {
  const node = chain[chain.length - 1], parent = chain[chain.length - 2];
  const back = `<a class="btn" href="${pathOf(chain.slice(0, -1))}">${ICON.back}<span>Volver a ${esc(parent.title)}</span></a>`;
  const head = node.id === 'infraestructura'
    ? infraHero({ tags: ['Taller', 'Maquinaria', 'Oficinas', 'Proyectos'], actions: back })
    : node.id === 'neotropya'
      ? neoHero({ actions: back })
      : chain[1].id === 'neotropya'
        ? neoHero({ compact: true, kicker: 'Neotropya', title: node.title, subtitle: node.desc || '', description: '', lines: false, actions: back })
        : `<div class="section-head fade-in"><div><h1>${esc(node.title)}</h1><p>${esc(node.desc || '')}</p></div>${back}</div>`;
  main.innerHTML = `${head}
    <section class="child-cards fade-in" aria-label="Secciones de ${esc(node.title)}">
      ${(node.children || []).map(c => card(c, pathOf(chain) + '/' + c.id, chain[1].tone === 'mint' ? 'mint' : '')).join('')}
    </section>`;
}

function renderNotFound() {
  main.innerHTML = `<div class="state"><h3>No encontramos esta página</h3><p>La dirección no corresponde a ninguna sección.</p>
    <div class="alert-actions"><a class="btn btn-primary" href="#/">Ir al inicio</a></div></div>`;
}

async function route() {
  const token = ++routeToken;
  closeAllModals();
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }

  const { chain, rest, notFound } = resolve(segmentsOf());
  // El área activa define el tema visual (infra.css solo aplica con data-area="infraestructura").
  document.body.dataset.area = (chain[1] && chain[1].id) || 'inicio';
  renderAreaSwitch(chain);
  const node = chain[chain.length - 1];

  if (notFound) { renderCrumbs(chain, [{ title: 'No encontrado' }]); renderNotFound(); return; }
  if (chain.length === 1) { renderCrumbs(chain); renderHome(); return focusMain(); }
  if (!node.load) { renderCrumbs(chain); renderBranch(chain); return focusMain(); }

  renderCrumbs(chain);
  main.innerHTML = `<div class="skeleton" style="height:120px"></div>`;
  try {
    const mod = await node.load();
    if (token !== routeToken) return;
    // Cada montaje recibe un contenedor nuevo: los eventos del módulo anterior desaparecen con él.
    const host = document.createElement('div');
    main.replaceChildren(host);
    const ctx = {
      sub: rest,
      base: pathOf(chain),
      setExtraCrumbs: extra => renderCrumbs(chain, extra),
      auth, canEdit, onAuthChange, openLogin
    };
    cleanup = mod.mount(host, ctx) || null;
  } catch (e) {
    console.error(e);
    main.innerHTML = alertBox('err', 'No se pudo cargar esta sección', `<p>${esc(e.message)}</p>`, `<button class="btn" onclick="location.reload()">Reintentar</button>`);
  }
  focusMain();
}

let firstRoute = true;
function focusMain() {
  // Al navegar, el foco va al contenido para que lectores de pantalla y teclado reconozcan el cambio.
  if (firstRoute) { firstRoute = false; return; }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
checkSession();
