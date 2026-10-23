/* Cabecera de Neotropya: laboratorio creativo. Ilustraciones de línea suave (SVG propio, sin enlaces externos)
   de sus líneas de trabajo: impresión 3D, nodos de conectividad, energía solar y, como línea futura, prótesis. */
import { esc } from './ui.js';

const F = '#315C49'; // trazo principal (verde bosque)

export const NEO_ART = `<svg viewBox="0 0 520 260" fill="none" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Ilustración: impresora 3D, nodo de conectividad, panel solar y mano protésica">
  <!-- formas orgánicas de fondo -->
  <path d="M40 150 C 20 90, 80 40, 140 52 S 214 110, 196 168 S 100 232, 64 206 S 52 176, 40 150 Z" fill="#EAF1E8"/>
  <path d="M206 70 C 210 34, 268 22, 298 46 S 318 112, 278 124 S 200 108, 206 70 Z" fill="#DCEAF0"/>
  <path d="M338 92 C 350 48, 430 40, 468 70 S 492 156, 446 184 S 346 190, 334 150 S 330 118, 338 92 Z" fill="#FBE3D2"/>
  <path d="M214 170 C 222 150, 286 146, 302 168 S 300 232, 262 240 S 208 196, 214 170 Z" fill="#EEF4EC"/>
  <!-- conexiones punteadas entre proyectos -->
  <g stroke="#A8C3A0" stroke-width="2" stroke-dasharray="1 7">
    <path d="M170 92 C 196 70, 214 70, 226 80"/>
    <path d="M292 92 C 318 92, 330 100, 346 112"/>
    <path d="M180 176 C 200 190, 214 196, 228 196"/>
    <path d="M304 200 C 330 196, 350 186, 362 172"/>
  </g>
  <g fill="#A8C3A0"><circle cx="226" cy="80" r="4"/><circle cx="346" cy="112" r="4"/><circle cx="228" cy="196" r="4"/><circle cx="362" cy="172" r="4"/></g>

  <!-- impresora 3D -->
  <g stroke="${F}" stroke-width="2.4">
    <rect x="62" y="70" width="100" height="120" rx="10" fill="#fff"/>
    <path d="M62 96 H162"/>
    <rect x="98" y="90" width="26" height="16" rx="4" fill="#DCEAF0"/>
    <path d="M111 106 L106 114 H116 Z" fill="${F}"/>
    <path d="M76 172 H148"/>
    <path d="M84 190 V198 M140 190 V198"/>
  </g>
  <!-- pieza impresa por capas -->
  <g stroke="${F}" stroke-width="1.8" fill="#F3C5A5">
    <rect x="98" y="160" width="26" height="12" rx="2"/>
    <rect x="101" y="150" width="20" height="10" rx="2"/>
    <rect x="104" y="141" width="14" height="9" rx="2"/>
  </g>
  <path d="M111 118 V136" stroke="#F3C5A5" stroke-width="2" stroke-dasharray="2 3"/>

  <!-- nodo de conectividad (maleta con antena) -->
  <g stroke="${F}" stroke-width="2.4">
    <rect x="222" y="78" width="62" height="40" rx="8" fill="#fff"/>
    <path d="M242 78 V72 a4 4 0 0 1 4 -4 h14 a4 4 0 0 1 4 4 V78"/>
    <circle cx="238" cy="98" r="4" fill="#A8C3A0"/>
    <path d="M250 98 H270"/>
    <path d="M276 78 V48"/>
    <circle cx="276" cy="44" r="4" fill="${F}"/>
  </g>
  <g stroke="${F}" stroke-width="2" opacity=".8">
    <path d="M287 36 a16 16 0 0 1 0 16"/><path d="M294 30 a26 26 0 0 1 0 28"/>
    <path d="M265 36 a16 16 0 0 0 0 16"/>
  </g>

  <!-- panel solar con sol -->
  <g stroke="${F}" stroke-width="2.4">
    <circle cx="444" cy="66" r="14" fill="#F3C5A5"/>
    <path d="M444 42 V36 M444 96 V90 M420 66 H414 M474 66 H468 M427 49 l-4 -4 M465 87 l-4 -4 M461 49 l4 -4 M423 87 l4 -4" stroke-width="2"/>
    <path d="M352 150 L420 116 L456 140 L388 174 Z" fill="#fff"/>
    <path d="M369 141.5 L438 128 M386 133 L404 166 M403 124.5 L422 157 M370 158 L438 128" stroke-width="1.6"/>
    <path d="M404 166 V196 M392 196 H416"/>
  </g>

  <!-- mano protésica (línea futura): trazo discontinuo -->
  <g stroke="${F}" stroke-width="2.2" fill="#fff">
    <rect x="232" y="186" width="50" height="40" rx="12"/>
    <rect x="234" y="154" width="10" height="34" rx="5"/>
    <rect x="246" y="148" width="10" height="40" rx="5"/>
    <rect x="258" y="150" width="10" height="38" rx="5"/>
    <rect x="270" y="158" width="10" height="30" rx="5"/>
    <rect x="212" y="192" width="30" height="11" rx="5.5" transform="rotate(-28 227 197)"/>
  </g>
  <g fill="#A8C3A0"><circle cx="239" cy="170" r="2.2"/><circle cx="251" cy="166" r="2.2"/><circle cx="263" cy="167" r="2.2"/><circle cx="275" cy="172" r="2.2"/><circle cx="257" cy="206" r="3.5"/></g>
  <path d="M226 236 C 240 244, 276 244, 290 236" stroke="#A8C3A0" stroke-width="2" stroke-dasharray="3 5"/>
</svg>`;

/* Líneas de trabajo: las tres primeras existen hoy; las prótesis son una línea futura (sin enlace). */
const LINES = [
  { t: 'Impresión 3D', c: '#F3C5A5' },
  { t: 'Nodos de conectividad', c: '#DCEAF0' },
  { t: 'Energía solar', c: '#A8C3A0' },
  { t: 'Prótesis · próximamente', c: '#EAF1E8', future: true }
];

export function neoHero({ compact = false, title = 'Neotropya', subtitle = 'Ideas que conectan, soluciones que ayudan',
  description = 'Laboratorio de Suspensiones CCS donde combinamos fabricación digital, conectividad y energía solar para desarrollar soluciones útiles para las personas.',
  kicker = 'Laboratorio creativo', actions = '', lines = true } = {}) {
  return `<header class="neo-hero ${compact ? 'compact' : ''}">
    <div>
      <p class="neo-hero-kicker"><span class="dot" aria-hidden="true"></span>${esc(kicker)}</p>
      <h1>${esc(title)}</h1>
      <p class="neo-sub">${esc(subtitle)}</p>
      ${description ? `<p class="neo-desc">${esc(description)}</p>` : ''}
      ${lines ? `<ul class="neo-lines" aria-label="Líneas de trabajo">${LINES.map(l => `<li class="${l.future ? 'future' : ''}"><span class="sw" style="background:${l.c}" aria-hidden="true"></span>${esc(l.t)}</li>`).join('')}</ul>` : ''}
      ${actions ? `<div class="neo-hero-actions">${actions}</div>` : ''}
    </div>
    <div class="neo-hero-art">${NEO_ART}</div>
  </header>`;
}
