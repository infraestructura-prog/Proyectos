/* Utilidades de interfaz compartidas: escape, iconos, cuadros de diálogo accesibles y avisos. */

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
};

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICON = {
  node: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>'),
  build: svg('<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6M9 11h6"/>'),
  case: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
  machine: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4M7 9h4M7 12h7"/><circle cx="17" cy="9" r="1.5"/>'),
  list: svg('<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  wrench: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  ruler: svg('<path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z"/><path d="m7.5 10.5 2-2M10.5 13.5l2-2M13.5 16.5l2-2"/>'),
  kanban: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M5.5 7h2M11.5 7h2M17.5 7h2M11.5 11h2M5.5 11h2"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  warn: svg('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  error: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  ok: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  chip: svg('<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'),
  note: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  tag: svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>')
};

export function alertBox(kind, title, body = '', actions = '') {
  const icon = kind === 'err' ? ICON.error : kind === 'info' ? ICON.info : ICON.warn;
  return `<div class="alert alert-${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${icon}<div class="alert-body">${title ? `<b>${title}</b>` : ''}${body}${actions ? `<div class="alert-actions">${actions}</div>` : ''}</div></div>`;
}

export const fmtDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
};

/* ── Cuadros de diálogo con gestión de foco ── */
const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openModal({ html, label, size = '', onClose, initialFocus }) {
  const prev = document.activeElement;
  const id = 'm' + Math.random().toString(36).slice(2, 8);
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-bg" data-close></div><div class="modal-scroll" data-scroll>
    <div class="modal-box fade-in ${size}" role="dialog" aria-modal="true" ${label ? `aria-label="${esc(label)}"` : `aria-labelledby="${id}-t"`}>${html.replace(/data-modal-title/g, `id="${id}-t"`)}</div></div>`;
  document.getElementById('modal-root').appendChild(wrap);
  document.body.classList.add('modal-open');
  stack.forEach(m => m.wrap.setAttribute('aria-hidden', 'true'));

  const box = wrap.querySelector('.modal-box');
  let canClose = () => true;
  const close = (reason) => {
    if (!wrap.isConnected) return;
    if (reason !== 'force' && !canClose()) return;
    wrap.remove();
    stack.splice(stack.indexOf(entry), 1);
    if (stack.length) stack[stack.length - 1].wrap.removeAttribute('aria-hidden');
    else document.body.classList.remove('modal-open');
    onClose && onClose(reason);
    if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus();
  };
  const entry = { wrap, close };
  stack.push(entry);

  // Cierra al pulsar fuera del cuadro o un botón con data-close.
  wrap.addEventListener('click', e => {
    if (e.target.matches('[data-scroll], .modal-bg') || e.target.closest('button[data-close]')) close('dismiss');
  });
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close('dismiss'); return; }
    if (e.key !== 'Tab') return;
    const f = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  const target = (initialFocus && box.querySelector(initialFocus)) || box.querySelector('[autofocus]') || box.querySelector(FOCUSABLE) || box;
  if (target === box) box.setAttribute('tabindex', '-1');
  setTimeout(() => target.focus(), 0);

  return { el: box, close, setCanClose: fn => { canClose = fn; } };
}

export function closeAllModals() { [...stack].reverse().forEach(m => m.close('force')); }

export function confirmDialog({ title, body, confirm = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return new Promise(resolve => {
    let answered = false;
    const m = openModal({
      size: 'sm',
      html: `<div class="modal-head"><h2 data-modal-title>${title}</h2></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot"><button class="btn" data-act="no">${cancel}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${confirm}</button></div>`,
      initialFocus: '[data-act="no"]',
      onClose: () => { if (!answered) resolve(false); }
    });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      answered = true; resolve(b.dataset.act === 'yes'); m.close('force');
    });
  });
}

export function toast(msg, kind = 'ok', ms = 4500) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  t.innerHTML = `${kind === 'err' ? ICON.error : ICON.ok}<div>${esc(msg)}</div>`;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}
