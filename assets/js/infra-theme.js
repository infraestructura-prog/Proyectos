/* Cabecera de Infraestructura con identidad de taller.
   Si existe una foto en assets/img/infraestructura-hero.jpg y se activa --in-hero-image en infra.css,
   se muestra como fondo; si no, se ve esta composición técnica en SVG (no depende de enlaces externos). */
import { esc, ICON } from './ui.js';

/* Contorno de un engranaje: dientes trapezoidales alrededor de (cx, cy). */
function gearPath(cx, cy, r, teeth, phase = 0) {
  const root = r - Math.max(5, r * 0.14), step = (Math.PI * 2) / teeth, pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * step;
    [[root, 0], [r, 0.2], [r, 0.46], [root, 0.66]].forEach(([rad, f]) => {
      const t = a + f * step;
      pts.push(`${(cx + rad * Math.cos(t)).toFixed(1)} ${(cy + rad * Math.sin(t)).toFixed(1)}`);
    });
  }
  return `M${pts.join(' L')} Z`;
}

/* Engranaje completo: dientes, aro, cubo, eje, aligeramientos y ejes de referencia de plano. */
function gear({ cx, cy, r, teeth, phase = 0, accent = false, holes = 5, label = '' }) {
  const stroke = accent ? '#F28C28' : '#7A857B';
  const holesSvg = Array.from({ length: holes }, (_, i) => {
    const t = (i / holes) * Math.PI * 2 + phase;
    return `<circle cx="${(cx + r * 0.5 * Math.cos(t)).toFixed(1)}" cy="${(cy + r * 0.5 * Math.sin(t)).toFixed(1)}" r="${(r * 0.11).toFixed(1)}"/>`;
  }).join('');
  return `<g>
    <path d="M${cx - r - 14} ${cy} H${cx + r + 14} M${cx} ${cy - r - 14} V${cy + r + 14}" stroke="#454D46" stroke-dasharray="6 3 1 3"/>
    <path d="${gearPath(cx, cy, r, teeth, phase)}" stroke="${stroke}" stroke-width="${accent ? 2.2 : 1.8}"/>
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.74).toFixed(1)}" stroke="#5C665D" stroke-dasharray="3 4"/>
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.28).toFixed(1)}" stroke="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.max(3, r * 0.1).toFixed(1)}" stroke="#7A857B"/>
    <g stroke="#5C665D">${holesSvg}</g>
    ${label ? `<text x="${cx + r * 0.32}" y="${cy - r * 0.34}" fill="#8E978F" stroke="none" font-family="JetBrains Mono, monospace" font-size="10">${label}</text>` : ''}
  </g>`;
}

/* Plano técnico decorativo: tren de engranajes engranados, amortiguador en despiece y cotas. */
const ART = `<svg viewBox="0 0 720 260" preserveAspectRatio="xMaxYMid slice" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <g stroke-width="1.4">
    ${gear({ cx: 520, cy: 132, r: 78, teeth: 20, phase: 0.1, holes: 6, label: 'Z20' })}
    ${gear({ cx: 609, cy: 62, r: 44, teeth: 11, phase: 0.42, accent: true, holes: 4, label: 'Z11' })}
    ${gear({ cx: 595, cy: 199, r: 30, teeth: 8, phase: 0.2, holes: 0 })}
    ${gear({ cx: 671, cy: 85, r: 26, teeth: 7, phase: 0.05, holes: 0 })}
    ${gear({ cx: 424, cy: 87, r: 36, teeth: 9, phase: 0.3, accent: true, holes: 3, label: 'Z9' })}
  </g>
  <!-- flechas de giro -->
  <g stroke="#F28C28" stroke-width="2" opacity=".9">
    <path d="M452 214 A 92 92 0 0 1 430 170"/><path d="M430 170 l-2 10 M430 170 l8 6"/>
    <path d="M646 32 A 52 52 0 0 1 662 50"/><path d="M662 50 l-9 -3 M662 50 l1 -9"/>
  </g>
  <g stroke="#5C665D" stroke-width="1.4">
    <!-- amortiguador en despiece (izquierda) -->
    <circle cx="150" cy="44" r="10"/>
    <path d="M150 54 V112"/>
    <rect x="134" y="112" width="32" height="88" rx="3" stroke="#7A857B" stroke-width="2"/>
    <path d="M134 132 H166 M134 186 H166"/>
    <circle cx="150" cy="216" r="9"/>
    <path d="M150 200 V207"/>
    <!-- cotas -->
    <path d="M196 34 V226 M190 34 H202 M190 226 H202"/>
    <path d="M104 112 H124 M104 200 H124 M110 112 V200"/>
    <path d="M520 236 H609 M520 230 V242 M609 230 V242" stroke-dasharray="2 3"/>
    <!-- llave -->
    <path d="M250 196 l34 -34 m-4 -10 a10 10 0 1 0 14 14 l-6 -2 -2 -6 z"/>
  </g>
  <g stroke="#F28C28" stroke-width="2.2">
    <path d="M136 60 L164 68 L136 76 L164 84 L136 92 L164 100 L136 108"/>
    <circle cx="196" cy="34" r="2.5" fill="#F28C28"/><circle cx="196" cy="226" r="2.5" fill="#F28C28"/>
  </g>
  <g fill="#8E978F" font-family="JetBrains Mono, monospace" font-size="11" stroke="none">
    <text x="204" y="134">L 510</text>
    <text x="74" y="160">Ø 2.5"</text>
    <text x="536" y="252">a 113.5</text>
    <text x="300" y="40" fill="#A3B07F">M 2.5 · CCS</text>
  </g>
</svg>`;

const TAG_ICONS = { Taller: ICON.wrench, Maquinaria: ICON.gear, Oficinas: ICON.build, Proyectos: ICON.ruler };

export function infraHero({ kicker = 'Suspensiones CCS · Taller', title = 'Infraestructura', subtitle = 'Mantenimiento, taller y desarrollo de proyectos',
  tags = [], actions = '', compact = false, headingLevel = 1 } = {}) {
  const h = `h${headingLevel}`;
  return `<header class="infra-hero ${compact ? 'compact' : ''}">
    <div class="infra-hero-art">${ART}</div>
    <div class="infra-hero-body">
      <p class="infra-hero-kicker"><span class="plate">CCS</span>${esc(kicker)}</p>
      <${h}><span class="bar" aria-hidden="true"></span>${esc(title)}</${h}>
      <p class="infra-hero-sub">${esc(subtitle)}</p>
      ${tags.length ? `<div class="infra-hero-tags">${tags.map(t => `<span>${TAG_ICONS[t] || ''}${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    ${actions ? `<div class="infra-hero-actions">${actions}</div>` : ''}
  </header>`;
}
