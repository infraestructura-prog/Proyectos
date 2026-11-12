/* Resultados de investigación: integra las investigaciones ya desarrolladas en el sitio.
   Los archivos son COPIAS locales (datos/investigaciones/*.json e img/motos/*.jpg) de assets del sitio publicado;
   el prototipo solo los lee. Un mismo archivo puede alimentar varias investigaciones sin duplicar sus datos:
   el estudio del acople nodo–moto contiene los modelos de moto (Compatibilidad) y las bases comerciales (Alternativas).
   Todo lo que se muestra son resultados del estudio, no validaciones ni ensayos propios. */
import { esc } from './componentes.js';

export const FUENTES = {
  acople: { archivo: 'datos/investigaciones/acople-nodo-moto.json' },
  pinturas: { archivo: 'datos/investigaciones/pinturas-maleta.json' }
};
// id de investigación del prototipo → { fuente, vista }. Sin entrada = aún no hay resultados registrados.
export const RESULTADOS = {
  'in-compatibilidad-parrillas': { fuente: 'acople', vista: 'motos' },
  'in-alternativas-acople': { fuente: 'acople', vista: 'productos' },
  'in-pinturas-recubrimientos': { fuente: 'pinturas', vista: 'pinturas' }
};

const img = src => (src ? 'img/motos/' + String(src).split('/').pop() : '');   // ruta del sitio → copia local
const nivel = n => (n === 'pendiente' ? '<span class="pill pend-pill">Pendiente</span>' : '<span class="pill">Según la investigación</span>');
const lista = (xs, cls = 'rs-ul') => (xs && xs.length ? `<ul class="${cls}">${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

/* Resumen corto para la ficha de Inicio. */
export function resumenResultados(r, datos) {
  if (!r) return 'Sin resultados registrados todavía.';
  if (!datos) return 'Resultados disponibles.';
  if (r.vista === 'motos') return `${datos.motos.length} modelos de moto en el catálogo de la investigación (${datos.motos.filter(m => m.pendiente).length} por identificar).`;
  if (r.vista === 'productos') { const sin = datos.productos.filter(p => !p.precio).length; return `${datos.productos.length} opciones de maleta y acople registradas, con enlace de compra${sin ? `; ${sin === datos.productos.length ? 'precios' : sin + ' precios'} por confirmar` : ''}.`; }
  return `${datos.alternativas.length} alternativas comparadas; el estudio recomienda la alternativa ${esc(datos.recomendadaId)}.`;
}

/* Catálogo de motos: desplegable; cada tarjeta solo con la foto y el modelo. */
function motosHtml(d) {
  return `<section class="pj-sec" aria-labelledby="rs-motos-t">
    <details class="rs-desp" data-keep="motos">
      <summary><h2 id="rs-motos-t">Catálogo de modelos de moto</h2><span class="rs-count">${d.motos.length} modelos</span></summary>
      ${d.notas && d.notas.motos ? `<p class="aviso cond">${esc(d.notas.motos)}</p>` : ''}
      <ul class="rs-grid">${d.motos.map(m => `<li class="rs-card ${m.pendiente ? 'is-pend' : ''}">
        ${m.foto && m.foto.src ? `<img src="${esc(img(m.foto.src))}" alt="${esc(`${m.marca} ${m.modelo}`.trim())}" loading="lazy">` : '<div class="rs-noimg" aria-hidden="true">Sin fotografía</div>'}
        <h3>${esc(`${m.marca} ${m.modelo}`.trim())}</h3>
        ${m.pendiente ? '<span class="pill pend-pill">Modelo por identificar</span>' : ''}
      </li>`).join('')}</ul>
    </details></section>`;
}

/* Opciones de maleta y base de acople: misma estética que el catálogo de motos.
   A la vista: nombre, enlace de compra y precio; el resto de la información, en «Ver detalles». */
function productosHtml(d) {
  const etiquetas = { tipo: 'Tipo', capacidad: 'Capacidad', mecanismo: 'Mecanismo', herrajes: 'Herrajes', instalacion: 'Instalación' };
  return `<section class="pj-sec" aria-labelledby="rs-prod-t"><h2 id="rs-prod-t">Opciones de maleta y acople</h2>
    ${d.notas && d.notas.productos ? `<p class="aviso cond">${esc(d.notas.productos)}</p>` : ''}
    <ul class="rs-grid">${d.productos.map(p => `<li class="rs-card rs-opc">
      ${p.imagen ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">` : '<div class="rs-noimg" aria-hidden="true">Imagen pendiente</div>'}
      <h3>${esc(p.nombre)}</h3>
      <p class="rs-precio">${p.precio ? esc(p.precio) : '<span class="vacio">Precio por confirmar</span>'}</p>
      ${p.url ? `<a class="btn btn-sm rs-compra" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(p.plataforma || 'la tienda')}<span class="sr-only"> (abre en otra pestaña)</span></a>` : ''}
      <details class="rs-mas" data-keep="opc-${esc(p.id)}"><summary>Ver detalles</summary>
        ${p.resumenAcople ? `<p class="rs-nota">${esc(p.resumenAcople)}</p>` : ''}
        <dl class="rs-det">${Object.entries(p.detalle || {}).map(([k, v]) => `<div><dt>${esc(etiquetas[k] || k)}</dt><dd>${esc(v.valor)} ${nivel(v.nivel)}</dd></div>`).join('')}</dl>
        ${p.adaptaciones && p.adaptaciones.length ? `<h4>Adaptaciones necesarias</h4>${lista(p.adaptaciones)}` : ''}
        ${p.pendientes && p.pendientes.length ? `<h4>Pendiente de verificar</h4>${lista(p.pendientes)}` : ''}
        ${p.fuente && p.fuente.texto ? `<p class="nota">${esc(p.fuente.texto)}</p>` : ''}
      </details>
    </li>`).join('')}</ul></section>`;
}

function pinturasHtml(d) {
  const de5 = n => `<span class="rs-score" aria-label="${n} de 5">${'●'.repeat(n)}<span class="off">${'●'.repeat(5 - n)}</span></span>`;
  return `<section class="pj-sec" aria-labelledby="rs-pin-t"><h2 id="rs-pin-t">Comparación de alternativas</h2>
    <details class="mas"><summary>Criterios de comparación</summary>
      <dl class="rs-det">${(d.criterios || []).map(c => `<div><dt>${esc(c.nombre)}</dt><dd>${esc(c.descripcion)}</dd></div>`).join('')}</dl></details>
    <ul class="rs-grid rs-alts">${d.alternativas.map(a => `<li class="rs-card rs-alt ${a.id === d.recomendadaId ? 'is-rec' : ''}">
      <p class="ob-kicker">Alternativa ${esc(a.id)} · ${esc(a.categoria)}</p>
      <h3>${esc(a.producto)}</h3>
      ${a.id === d.recomendadaId ? '<span class="pill rec-pill">Recomendada por el estudio</span>' : ''}
      <dl class="rs-det">
        <div><dt>SRI</dt><dd>${esc(a.sri)}</dd></div>
        <div><dt>Durabilidad</dt><dd>${de5(a.durabilidad)}</dd></div>
        <div><dt>Resistencia ambiental</dt><dd>${de5(a.ambiental)}</dd></div>
        <div><dt>Viabilidad</dt><dd>${de5(a.viabilidad)}</dd></div>
        <div><dt>Aplicación</dt><dd>${esc(a.modalidad)} · ${esc(a.tiempo)}</dd></div>
        <div><dt>Vida útil estimada</dt><dd>${esc(a.vidaUtil)}</dd></div>
        <div><dt>Costo del lote</dt><dd>${esc(a.costoTotal)}${a.costoExclusiones ? ` <span class="nota">(${esc(a.costoExclusiones)})</span>` : ''}</dd></div>
        <div><dt>Rendimiento</dt><dd>${esc(a.rendimiento)}</dd></div>
      </dl>
      ${a.ventajas && a.ventajas.length ? `<h4>Ventajas</h4>${lista(a.ventajas)}` : ''}
      ${a.limitaciones && a.limitaciones.length ? `<h4>Limitaciones</h4>${lista(a.limitaciones)}` : ''}
      ${a.observaciones && a.observaciones.length ? `<p class="rs-nota">${a.observaciones.map(esc).join(' ')}</p>` : ''}
    </li>`).join('')}</ul></section>
    <section class="pj-sec" aria-labelledby="rs-conc-t"><h2 id="rs-conc-t">Conclusiones del estudio</h2>
      ${String(d.conclusiones || '').split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}
      ${d.motivosRecomendacion && d.motivosRecomendacion.length ? `<h3>Motivos de la recomendación</h3>${lista(d.motivosRecomendacion)}` : ''}
      ${d.observacionesGenerales && d.observacionesGenerales.length ? `<h3>Observaciones</h3>${lista(d.observacionesGenerales)}` : ''}
      <p class="nota">La recomendación es del estudio: ninguna alternativa está validada sin pruebas.</p>
    </section>`;
}

/* estado: { estado: 'cargando' | 'ok' | 'error', datos, error } */
export function resultadosHtml(r, estado) {
  if (!r) return `<section class="pj-sec"><h2>Resultados de la investigación</h2><p class="vacio">Sin resultados registrados todavía.</p>
    <p class="nota">Cuando la investigación avance, aquí se reunirán sus hallazgos, comparaciones y conclusiones.</p></section>`;
  if (!estado || estado.estado === 'cargando') return '<section class="pj-sec"><p class="nota" role="status">Cargando resultados…</p></section>';
  if (estado.estado === 'error') return `<section class="pj-sec"><h2>Resultados de la investigación</h2><p class="err" role="alert">No se pudieron leer los resultados (${esc(estado.error)}).</p></section>`;
  const d = estado.datos;
  // Solo los resultados: la ficha de fuente y contexto del estudio no se muestra aquí.
  return `<div class="rs">${r.vista === 'motos' ? motosHtml(d) : r.vista === 'productos' ? productosHtml(d) : pinturasHtml(d)}</div>`;
}
