/* Cabecera de Infraestructura con identidad de taller todoterreno.
   Si existe una foto en assets/img/infraestructura-hero.jpg y se activa --in-hero-image en infra.css,
   se muestra como fondo; si no, se ve esta composición técnica en SVG (no depende de enlaces externos). */
import { esc, ICON } from './ui.js';

/* Plano técnico decorativo: todoterreno con suspensión elevada, amortiguador coilover y cotas. */
const ART = `<svg viewBox="0 0 720 260" preserveAspectRatio="xMaxYMid slice" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <g stroke="#5C665D" stroke-width="1.4">
    <!-- suelo y cota de batalla -->
    <path d="M300 226 H712" stroke-dasharray="2 6"/>
    <path d="M392 244 H566 M392 238 V250 M566 238 V250"/>
    <!-- carrocería pick-up elevada -->
    <path d="M330 156 V116 H460 L466 76 L528 73 L566 110 L626 114 L640 130 V156 Z" stroke="#7A857B" stroke-width="2"/>
    <path d="M476 110 L480 84 L524 82 L548 110 Z"/>
    <path d="M470 66 H530 M478 66 V74 M522 66 V74" />
    <path d="M330 124 H460 M566 128 H640"/>
    <path d="M636 132 h10 v14 h-10" stroke="#7A857B"/>
    <path d="M330 156 H640" stroke="#7A857B" stroke-width="2"/>
    <!-- chasis y brazos de suspensión -->
    <path d="M368 172 H596" stroke-width="2.2"/>
    <path d="M392 192 L420 172 M566 192 L540 172"/>
    <!-- ruedas todoterreno -->
    <g stroke="#7A857B" stroke-width="2">
      <circle cx="392" cy="192" r="34"/><circle cx="566" cy="192" r="34"/>
    </g>
    <circle cx="392" cy="192" r="28" stroke-dasharray="5 4"/><circle cx="566" cy="192" r="28" stroke-dasharray="5 4"/>
    <circle cx="392" cy="192" r="13"/><circle cx="566" cy="192" r="13"/>
    <circle cx="392" cy="192" r="3"/><circle cx="566" cy="192" r="3"/>
    <!-- amortiguador grande en despiece (izquierda) -->
    <circle cx="150" cy="44" r="10"/>
    <path d="M150 54 V112"/>
    <rect x="134" y="112" width="32" height="88" rx="3" stroke="#7A857B" stroke-width="2"/>
    <path d="M134 132 H166 M134 186 H166"/>
    <circle cx="150" cy="216" r="9"/>
    <path d="M150 200 V207"/>
    <!-- cotas del amortiguador -->
    <path d="M196 34 V226 M190 34 H202 M190 226 H202"/>
    <path d="M104 112 H124 M104 200 H124 M110 112 V200"/>
    <!-- engranaje -->
    <circle cx="252" cy="84" r="20"/><circle cx="252" cy="84" r="7"/>
    <circle cx="252" cy="84" r="25" stroke-width="7" stroke-dasharray="5.2 4.6" opacity=".8"/>
    <!-- llave -->
    <path d="M236 168 l34 -34 m-4 -10 a10 10 0 1 0 14 14 l-6 -2 -2 -6 z" />
  </g>
  <!-- detalles naranjas: resortes y marcas de cota -->
  <g stroke="#F28C28" stroke-width="2.2">
    <path d="M136 60 L164 68 L136 76 L164 84 L136 92 L164 100 L136 108"/>
    <path d="M404 120 L420 126 L404 132 L420 138 L404 144 L420 150 L404 156" opacity=".9"/>
    <path d="M552 120 L568 126 L552 132 L568 138 L552 144 L568 150 L552 156" opacity=".9"/>
    <circle cx="196" cy="34" r="2.5" fill="#F28C28"/><circle cx="196" cy="226" r="2.5" fill="#F28C28"/>
  </g>
  <g fill="#8E978F" font-family="JetBrains Mono, monospace" font-size="11" stroke="none">
    <text x="204" y="134">L 510</text>
    <text x="74" y="160">Ø 2.5"</text>
    <text x="452" y="257">WB 2850</text>
    <text x="566" y="60" fill="#A3B07F">CCS-4X4</text>
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
