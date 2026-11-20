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

/* Catálogo de motos: desplegable; cada tarjeta solo con la foto y el modelo.
   Filtros por marca y por parrilla compartida (se combinan y se recuerdan mientras la página está abierta).
   Las opciones salen de los propios datos: «parrilla» agrupa los modelos que usan la misma parrilla. */
let marcaSel = '', parrillaSel = '';
export const elegirMarca = m => { marcaSel = m || ''; };
export const elegirParrilla = p => { parrillaSel = p || ''; };
function motosHtml(d) {
  const unicos = k => [...new Set(d.motos.map(m => m[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const marcas = unicos('marca'), parrillas = unicos('parrilla');
  if (marcaSel && !marcas.includes(marcaSel)) marcaSel = '';
  if (parrillaSel && !parrillas.includes(parrillaSel)) parrillaSel = '';
  const lista = d.motos.filter(m => (!marcaSel || m.marca === marcaSel) && (!parrillaSel || m.parrilla === parrillaSel));
  const n = (k, v) => d.motos.filter(x => x[k] === v).length;
  const opc = (v, sel, t) => `<option value="${esc(v)}"${sel === v ? ' selected' : ''}>${esc(t)}</option>`;
  const desp = (act, id, etiqueta, sel, todas, vals, k) => `<label class="rs-filtro" for="${id}"><span class="rs-filtro-t">${etiqueta}</span>
        <select id="${id}" class="rs-sel" data-act="${act}">${opc('', sel, todas)}${vals.map(v => opc(v, sel, `${v} (${n(k, v)})`)).join('')}</select></label>`;
  const filtrado = marcaSel || parrillaSel;
  return `<section class="pj-sec" aria-labelledby="rs-motos-t">
    <details class="rs-desp" data-keep="motos">
      <summary><h2 id="rs-motos-t">Catálogo de modelos de moto</h2><span class="rs-count">${filtrado ? `${lista.length} de ${d.motos.length}` : d.motos.length} modelos</span></summary>
      ${d.notas && d.notas.motos ? `<p class="aviso cond">${esc(d.notas.motos)}</p>` : ''}
      <div class="rs-filtros">
        ${marcas.length > 1 ? desp('moto-marca', 'rs-f-marca', 'Marca', marcaSel, `Todas (${d.motos.length})`, marcas, 'marca') : ''}
        ${parrillas.length ? desp('moto-parrilla', 'rs-f-parrilla', 'Misma parrilla', parrillaSel, 'Todas', parrillas, 'parrilla') : ''}
      </div>
      ${lista.length ? '' : '<p class="vacio">Ningún modelo coincide con los dos filtros.</p>'}
      <ul class="rs-grid">${lista.map(m => `<li class="rs-card ${m.pendiente ? 'is-pend' : ''}">
        ${m.foto && m.foto.src ? `<img src="${esc(img(m.foto.src))}" alt="${esc(`${m.marca} ${m.modelo}`.trim())}" loading="lazy">` : '<div class="rs-noimg" aria-hidden="true">Sin fotografía</div>'}
        <h3>${esc(`${m.marca} ${m.modelo}`.trim())}</h3>
        ${m.parrilla ? `<span class="pill">Parrilla ${esc(m.parrilla)}</span>` : ''}
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
      ${p.imagen ? `<img src="${esc('img/productos/' + String(p.imagen).split('/').pop())}" alt="${esc(p.nombre)}" loading="lazy">` : '<div class="rs-noimg" aria-hidden="true">Imagen pendiente</div>'}
      <h3>${esc(p.nombre)}</h3>
      <p class="rs-precio">${p.precio ? esc(p.precio) : '<span class="vacio">Precio por confirmar</span>'}${p.precio && p.precioConsultado ? ` <span class="rs-precio-f">en ${esc(p.plataforma || 'la tienda')}, al ${esc(p.precioConsultado.split('-').reverse().join('/'))}</span>` : ''}</p>
      ${p.url ? `<a class="btn btn-sm rs-compra" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(p.plataforma || 'la tienda')}<span class="sr-only"> (abre en otra pestaña)</span></a>` : ''}
      <details class="rs-mas" data-keep="opc-${esc(p.id)}"><summary>Ver detalles</summary>
        ${p.resumenAcople ? `<p class="rs-nota">${esc(p.resumenAcople)}</p>` : ''}
        <dl class="rs-det">${Object.entries(p.detalle || {}).map(([k, v]) => `<div><dt>${esc(etiquetas[k] || k)}</dt><dd>${esc(v.valor)} ${nivel(v.nivel)}</dd></div>`).join('')}</dl>
        ${p.adaptaciones && p.adaptaciones.length ? `<h4>Adaptaciones necesarias</h4>${lista(p.adaptaciones)}` : ''}
        ${p.pendientes && p.pendientes.length ? `<h4>Pendiente de verificar</h4>${lista(p.pendientes)}` : ''}
        ${p.fuente && p.fuente.texto ? `<p class="nota">${esc(p.fuente.texto)}</p>` : ''}
        ${p.precioFuente ? `<p class="nota">${esc(p.precioFuente)}</p>` : ''}
      </details>
    </li>`).join('')}</ul></section>`;
}

function pinturasHtml(d) {
  const num = s => { const m = String(s || '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const barra = n => `<span class="rs-barra" role="img" aria-label="${n} de 5"><i style="width:${n * 20}%"></i></span><span class="rs-barra-n">${n}/5</span>`;
  const foto = (a, cls) => a.imagenUrl ? `<img class="${cls}" src="${esc('img/pinturas/' + String(a.imagenUrl).split('/').pop())}" alt="${esc(a.producto)}" loading="lazy">` : `<div class="rs-noimg ${cls}" aria-hidden="true">Imagen pendiente</div>`;
  const alts = d.alternativas;
  /* Filas de la comparación: qué se muestra y cuál valor es el mejor (mayor o menor). */
  const filas = [
    { t: 'Refleja el calor del sol (SRI)', v: a => esc(a.sri), n: a => num(a.sri), mejor: 'max' },
    { t: 'Resistencia a golpes y rayones', v: a => barra(a.durabilidad), n: a => a.durabilidad, mejor: 'max' },
    { t: 'Resistencia al sol, lluvia y salitre', v: a => barra(a.ambiental), n: a => a.ambiental, mejor: 'max' },
    { t: 'Facilidad para aplicarla', v: a => barra(a.viabilidad), n: a => a.viabilidad, mejor: 'max' },
    { t: 'Dónde se aplica', v: a => esc(a.modalidad) },
    { t: 'Tiempo de aplicación', v: a => esc(a.tiempo), n: a => num(a.tiempo), mejor: 'min' },
    { t: 'Duración estimada', v: a => esc(a.vidaUtil), n: a => num(a.vidaUtil), mejor: 'max' },
    { t: 'Costo por maleta (aprox.)', v: a => a.costoMaleta ? esc(a.costoMaleta) : '<span class="vacio">Por calcular</span>', n: a => num(a.costoMaleta), mejor: 'min' }
  ];
  const celdas = f => {
    const ns = alts.map(a => f.n ? f.n(a) : null), vals = ns.filter(x => x != null);
    const top = f.mejor && vals.length > 1 && new Set(vals).size > 1 ? (f.mejor === 'max' ? Math.max(...vals) : Math.min(...vals)) : null;
    return alts.map((a, i) => { const gana = top != null && ns[i] === top;
      return `<td class="${gana ? 'is-mejor' : ''}${a.id === d.recomendadaId ? ' is-rec-col' : ''}">${f.v(a)}</td>`; }).join('');
  };
  return `<section class="pj-sec" aria-labelledby="rs-cmp-t"><h2 id="rs-cmp-t">Comparación lado a lado</h2>
    <p class="rs-nota">En verde, la mejor opción en cada punto. La columna con borde es la que recomienda el estudio.</p>
    <div class="rs-tabla-wrap" tabindex="0" role="region" aria-labelledby="rs-cmp-t"><table class="rs-tabla">
      <thead><tr><th scope="col"><span class="sr-only">Punto a comparar</span></th>${alts.map(a => `<th scope="col" class="${a.id === d.recomendadaId ? 'is-rec-col' : ''}">
        <span class="rs-tabla-letra">${esc(a.id)}</span> ${esc(a.producto)}
        ${a.id === d.recomendadaId ? '<span class="pill rec-pill">Recomendada</span>' : ''}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr><th scope="row">${f.t}</th>${celdas(f)}</tr>`).join('')}</tbody>
    </table></div>
    <details class="mas"><summary>¿Qué significa cada punto?</summary>
      <dl class="rs-det">${(d.criterios || []).map(c => `<div><dt>${esc(c.nombre)}</dt><dd>${esc(c.descripcion)}</dd></div>`).join('')}</dl></details>
  </section>
  <section class="pj-sec" aria-labelledby="rs-pin-t"><h2 id="rs-pin-t">Cada alternativa en detalle</h2>
    <ul class="rs-grid rs-alts">${alts.map(a => `<li class="rs-card rs-alt ${a.id === d.recomendadaId ? 'is-rec' : ''}">
      ${foto(a, '')}
      <p class="ob-kicker">Alternativa ${esc(a.id)} · ${esc(a.categoria)}</p>
      <h3>${esc(a.producto)}</h3>
      ${a.id === d.recomendadaId ? '<span class="pill rec-pill">Recomendada por el estudio</span>' : ''}
      <div class="rs-claves">
        <div><span>Por maleta</span><strong>${a.costoMaleta ? esc(a.costoMaleta) : 'Por calcular'}</strong></div>
        <div><span>Duración</span><strong>${esc(a.vidaUtil)}</strong></div>
        <div><span>Aplicación</span><strong>${esc(a.tiempo)}</strong></div>
      </div>
      ${a.ventajas && a.ventajas.length ? `<div class="rs-pros"><h4>A favor</h4>${lista(a.ventajas)}</div>` : ''}
      ${a.limitaciones && a.limitaciones.length ? `<div class="rs-contras"><h4>En contra</h4>${lista(a.limitaciones)}</div>` : ''}
      ${a.costoMaletaCalculo || (a.observaciones && a.observaciones.length) ? `<details class="rs-mas" data-keep="pin-${esc(a.id)}"><summary>Ver detalles</summary>
        ${a.costoMaletaCalculo ? `<p class="rs-nota">Cálculo del costo por maleta: ${esc(a.costoMaletaCalculo)}</p>` : ''}
        ${a.observaciones && a.observaciones.length ? `<h4>Observaciones</h4>${lista(a.observaciones)}` : ''}
      </details>` : ''}
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
