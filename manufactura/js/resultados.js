/* Resultados de investigación: integra las investigaciones ya desarrolladas en el sitio.
   Los archivos son COPIAS locales (datos/investigaciones/*.json e img/motos/*.jpg) de assets del sitio publicado;
   el prototipo solo los lee. Un mismo archivo puede alimentar varias investigaciones sin duplicar sus datos:
   el estudio del acople nodo–moto contiene los modelos de moto (Compatibilidad) y las bases comerciales (Alternativas).
   Todo lo que se muestra son resultados del estudio, no validaciones ni ensayos propios. */
import { esc } from './componentes.js';
import { TIPOS_PAR, VARIANTES, VALIDACION } from './catalogo-acople.js';

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

const img = src => (!src ? '' : /^(data:image\/|https:\/\/)/.test(src) ? src :'img/motos/' + String(src).split('/').pop());   // ruta del sitio → copia local (o foto agregada en el dashboard)
const nivel = n => (n === 'pendiente' ? '<span class="pill pend-pill">Pendiente</span>' : '<span class="pill">Según la investigación</span>');
const lista = (xs, cls = 'rs-ul') => (xs && xs.length ? `<ul class="${cls}">${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

/* Resumen corto para la ficha de Inicio. */
export function resumenResultados(r, datos) {
  if (!r) return 'Sin resultados registrados todavía.';
  if (!datos) return 'Resultados disponibles.';
  if (r.vista === 'motos') return `${datos.motos.length} modelos de moto en el catálogo de la investigación (${datos.motos.filter(m => m.pendiente).length} por identificar)${(datos.parrillas || []).length ? ` y ${datos.parrillas.length} parrillas registradas` : ''}.`;
  if (r.vista === 'productos') { const sin = datos.productos.filter(p => !p.precio).length; return `${datos.productos.length} opciones de maleta y acople registradas, con enlace de compra${sin ? `; ${sin === datos.productos.length ? 'precios' : sin + ' precios'} por confirmar` : ''}.`; }
  const ra = datos.recomendacionActual || {};
  return `${datos.alternativas.length} alternativas comparadas; el estudio original recomienda la ${esc(datos.recomendadaId)}${ra.primeraSpray ? `; en spray, la ${esc(ra.primeraSpray)} es la primera opción` : ''}.`;
}

/* Catálogo de motos y catálogo de parrillas (investigación «Compatibilidad entre motos y parrillas»).
   Cada parrilla tiene una ficha única y se vincula con las motos por identificadores (parrilla.motos[].id);
   el grupo («Misma parrilla» de cada moto) es lo que informó Ramón y se muestra aparte de la pieza concreta.
   Filtros: motos por marca y grupo; parrillas por grupo, tipo y validación (se recuerdan mientras la página está abierta). */
let marcaSel = '', parrillaSel = '';
export const elegirMarca = m => { marcaSel = m || ''; };
export const elegirParrilla = p => { parrillaSel = p || ''; };
const fPar = { grupo: '', tipo: '', validacion: '' };
export const elegirFiltroParrilla = (k, v) => { if (k in fPar) fPar[k] = v || ''; };
/* Para ir de una moto a una parrilla (o al revés) aunque la tarjeta esté oculta por un filtro. */
export function limpiarFiltrosCatalogo(cual) { if (cual === 'moto') { marcaSel = ''; parrillaSel = ''; } else { fPar.grupo = fPar.tipo = fPar.validacion = ''; } }

const PEND = 'Pendiente de verificar';
const motoNombre = m => `${m.marca} ${m.modelo}`.trim();
const extLink = (url, txt) => `<a class="btn btn-sm rs-compra" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(txt)}<span class="sr-only"> (abre en otra pestaña)</span></a>`;
const irBtn = (act, id, txt) => `<button type="button" class="rs-chip-btn" data-act="${act}" data-id="${esc(id)}">${esc(txt)}</button>`;

/* Relaciones moto ↔ parrilla, calculadas una vez a partir de los identificadores. */
function relaciones(d) {
  const motos = new Map(d.motos.map(m => [m.id, m]));
  // Los integrantes de cada grupo salen de las motos («Misma parrilla»), así una moto agregada o editada entra sola en su grupo.
  const grupos = new Map((d.gruposParrilla || []).map(g => [g.id, { ...g }]));
  d.motos.forEach(m => { if (m.parrilla && !grupos.has(m.parrilla)) grupos.set(m.parrilla, { id: m.parrilla, nombre: m.parrilla, fuente: '' }); });
  grupos.forEach(g => { g.motos = d.motos.filter(m => m.parrilla === g.id).map(m => m.id); });
  const parrillas = d.parrillas || [];
  const deMoto = m => {
    const directas = parrillas.filter(p => (p.motos || []).some(r => r.id === m.id)).map(p => ({ p, r: p.motos.find(r => r.id === m.id) }));
    const g = m.parrilla ? grupos.get(m.parrilla) || null : null;
    const delGrupo = g ? parrillas.filter(p => p.grupo === g.id && !directas.some(x => x.p.id === p.id)) : [];
    return { directas, g, delGrupo };
  };
  return { motos, grupos, parrillas, deMoto };
}

function motosHtml(d) {
  const R = relaciones(d);
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
  const parrillasDeMoto = m => {
    const { directas, g, delGrupo } = R.deMoto(m);
    const total = directas.length + delGrupo.length;
    const otras = g ? g.motos.filter(id => id !== m.id).map(id => R.motos.get(id)).filter(Boolean) : [];
    return `<details class="rs-mas" data-keep="moto-par-${esc(m.id)}"><summary>Parrillas${total ? ` (${total})` : ''}</summary>
      ${m.parrillaEstado ? `<p class="rs-nota"><b>${esc(m.parrillaEstado)}.</b>${m.parrillaEstadoNota ? ` ${esc(m.parrillaEstadoNota)}` : ''}</p>` : ''}
      ${directas.length ? `<p class="rs-rel-t">${directas.length > 1 ? `Piezas de referencia (${directas.length})` : 'Pieza de referencia'}</p><ul class="rs-rel">${directas.map(({ p, r }) => `<li>${irBtn('ir-parrilla', p.id, `${p.id} · ${p.nombre}`)}<small>${esc(r.relacion || '')} · Fuente: ${esc(r.fuente || p.fuenteCompat || PEND)}</small></li>`).join('')}</ul>` : ''}
      ${delGrupo.length ? `<p class="rs-rel-t">Piezas del grupo ${esc(g.nombre)} · aplicación a este modelo por confirmar</p><ul class="rs-rel">${delGrupo.map(p => `<li>${irBtn('ir-parrilla', p.id, `${p.id} · ${p.nombre}`)}</li>`).join('')}</ul>` : ''}
      ${g && otras.length ? `<p class="rs-rel-t">Comparte parrilla${g.fuente ? ` según ${esc(g.fuente)}` : ''}</p><p class="rs-nota">${otras.map(o => irBtn('ir-moto', o.id, motoNombre(o))).join(' ')}</p>` : ''}
      <p class="rs-rel-t">Probada con nuestra base</p><p class="rs-nota">${total && [...directas.map(x => x.p), ...delGrupo].some(p => p.validacion && p.validacion !== 'sin-probar') ? 'Ver la ficha de cada parrilla.' : 'Todavía no.'}</p>
      ${!total && !m.parrillaEstado && !g ? `<p class="vacio">${PEND}</p>` : ''}
    </details>`;
  };
  return `<section class="pj-sec" aria-labelledby="rs-motos-t">
    <details class="rs-desp" data-keep="motos">
      <summary><h2 id="rs-motos-t">Catálogo de motos</h2><span class="rs-count">${filtrado ? `${lista.length} de ${d.motos.length}` : d.motos.length} modelos</span></summary>
      ${d.notas && d.notas.motos ? `<p class="aviso cond">${esc(d.notas.motos)}</p>` : ''}
      <div class="rs-filtros">
        <button type="button" class="btn btn-sm rs-agregar" data-act="cat-moto-nueva">+ Agregar moto</button>
        ${marcas.length > 1 ? desp('moto-marca', 'rs-f-marca', 'Marca', marcaSel, `Todas (${d.motos.length})`, marcas, 'marca') : ''}
        ${parrillas.length ? desp('moto-parrilla', 'rs-f-parrilla', 'Misma parrilla', parrillaSel, 'Todas', parrillas, 'parrilla') : ''}
      </div>
      ${lista.length ? '' : '<p class="vacio">Ningún modelo coincide con los dos filtros.</p>'}
      <ul class="rs-grid">${lista.map(m => `<li class="rs-card ${m.pendiente ? 'is-pend' : ''}" id="rs-moto-${esc(m.id)}">
        ${m.foto && m.foto.src ? `<img src="${esc(img(m.foto.src))}" alt="${esc(motoNombre(m))}" loading="lazy">` : '<div class="rs-noimg" aria-hidden="true">Sin fotografía</div>'}
        <h3>${esc(motoNombre(m))}</h3>
        ${m.parrilla ? `<span class="pill">Parrilla ${esc(m.parrilla)}</span>` : ''}
        ${m.pendiente ? '<span class="pill pend-pill">Modelo por identificar</span>' : ''}
        ${parrillasDeMoto(m)}
        <button type="button" class="btn btn-sm rs-editar" data-act="cat-moto-editar" data-id="${esc(m.id)}">Editar<span class="sr-only"> ${esc(motoNombre(m))}</span></button>
      </li>`).join('')}</ul>
      ${d.motosRetiradas && d.motosRetiradas.length ? `<p class="nota">Fuera de la selección principal: ${d.motosRetiradas.map(x => `${esc(`${x.marca} ${x.modelo}`)} (${esc(x.motivo)})`).join('; ')}</p>` : ''}
    </details></section>
    ${parrillasHtml(d, R)}`;
}

function parrillasHtml(d, R) {
  // Siempre se muestra, aunque no haya parrillas, para poder agregar la primera.
  const vals = (k, mapa) => [...new Set(R.parrillas.map(p => p[k]).filter(Boolean))].map(v => ({ v, t: mapa ? mapa[v] || v : v }));
  const todos = mapa => Object.entries(mapa).map(([v, t]) => ({ v, t }));   // tipo y validación: siempre las 4–5 opciones, aunque alguna tenga 0
  const opciones = { grupo: vals('grupo'), tipo: todos(TIPOS_PAR), validacion: todos(VALIDACION) };
  Object.keys(fPar).forEach(k => { if (fPar[k] && !opciones[k].some(o => o.v === fPar[k])) fPar[k] = ''; });
  const lista = R.parrillas.filter(p => Object.keys(fPar).every(k => !fPar[k] || p[k] === fPar[k]));
  const n = (k, v) => R.parrillas.filter(p => p[k] === v).length;
  const sel = (k, etiqueta) => `<label class="rs-filtro" for="rs-fp-${k}"><span class="rs-filtro-t">${etiqueta}</span>
      <select id="rs-fp-${k}" class="rs-sel" data-act="par-filtro" data-k="${k}"><option value="">Todos</option>${opciones[k].map(o => `<option value="${esc(o.v)}"${fPar[k] === o.v ? ' selected' : ''}>${esc(o.t)} (${n(k, o.v)})</option>`).join('')}</select></label>`;
  const filtrado = Object.values(fPar).some(Boolean);
  const motoBtn = id => { const m = R.motos.get(id); return m ? irBtn('ir-moto', m.id, motoNombre(m)) : `<span class="vacio">${esc(id)}</span>`; };
  return `<section class="pj-sec" aria-labelledby="rs-parr-t">
    <details class="rs-desp" data-keep="parrillas">
      <summary><h2 id="rs-parr-t">Catálogo de parrillas</h2><span class="rs-count">${filtrado ? `${lista.length} de ${R.parrillas.length}` : R.parrillas.length} parrillas</span></summary>
      <p class="aviso cond">«Comparte parrilla según Ramón» y «Probada con nuestra base» no son lo mismo: lo primero es información del grupo de motos; lo segundo solo se marca después de una prueba física con nuestra base. Los datos sin información aparecen como «${PEND}».</p>
      <div class="rs-filtros"><button type="button" class="btn btn-sm rs-agregar" data-act="cat-par-nueva">+ Agregar parrilla</button>${sel('grupo', 'Grupo')}${sel('tipo', 'Tipo de pieza')}${sel('validacion', 'Validación con nuestra base')}</div>
      ${lista.length ? '' : '<p class="vacio">Ninguna parrilla coincide con los filtros.</p>'}
      <ul class="rs-grid rs-pars">${lista.map(p => { const g = R.grupos.get(p.grupo);
        const otrasDelGrupo = g ? g.motos.filter(id => !(p.motos || []).some(r => r.id === id)) : [];
        return `<li class="rs-card rs-par" id="rs-par-${esc(p.id)}">
        ${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.nombre)}" loading="lazy">` : `<div class="rs-noimg" aria-hidden="true">${p.esBusqueda ? 'Pieza pendiente de seleccionar' : (p.fotoPendiente || 'Foto pendiente de verificar')}</div>`}
        <p class="ob-kicker">${esc(p.id)} · Grupo ${esc(p.grupo || PEND)}</p>
        <h3>${esc(p.nombre)}</h3>
        <div class="rs-pills"><span class="pill ${p.tipo === 'pendiente' ? 'pend-pill' : ''}">${esc(TIPOS_PAR[p.tipo] || PEND)}</span>
          <span class="pill">Variante ${esc((VARIANTES[p.variante] || PEND).toLowerCase())}</span>
          <span class="pill ${p.validacion === 'compatible' ? '' : 'pend-pill'}">${esc(VALIDACION[p.validacion] || PEND)}</span></div>
        ${!p.publicacion ? '' : p.esBusqueda ? `<p class="rs-nota"><b>${esc(p.publicacion)}.</b></p>` : `<p class="rs-nota">Publicación: «${esc(p.publicacion)}»</p>`}
        <div class="rs-rel-bloque">
          <p class="rs-rel-t">Anunciada para</p><p class="rs-nota">${(p.motos || []).length ? p.motos.map(r => motoBtn(r.id)).join(' ') : `<span class="vacio">${p.esBusqueda ? 'Sin pieza seleccionada' : 'Modelos pendientes de confirmar'}</span>`}</p>
          ${g && otrasDelGrupo.length ? `<p class="rs-rel-t">Grupo ${esc(g.nombre)} · comparte parrilla${g.fuente ? ` según ${esc(g.fuente)}` : ''}</p><p class="rs-nota">${otrasDelGrupo.map(motoBtn).join(' ')}</p>` : ''}
          <p class="rs-rel-t">Probada con nuestra base</p><p class="rs-nota">${p.validacion && p.validacion !== 'sin-probar' ? esc(VALIDACION[p.validacion]) : 'Todavía no.'}</p>
        </div>
        <div class="rs-card-pie">${p.url ? extLink(p.url, p.esBusqueda ? 'Ver búsqueda' : 'Ver publicación') : ''}
        <button type="button" class="btn btn-sm rs-editar" data-act="cat-par-editar" data-id="${esc(p.id)}">Editar<span class="sr-only"> ${esc(p.id)}</span></button></div>
      </li>`; }).join('')}</ul>
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

/* Pinturas, vinilos y recubrimientos: filtro por tipo de solución, cuadro lado a lado y fichas.
   El filtro actúa a la vez sobre las columnas del cuadro y sobre las fichas; los criterios (filas) siempre quedan.
   Cada valor lleva una etiqueta de evidencia (Estudio original, Provisional, Escenario de cálculo, Según ficha…). */
let tipoPintura = 'todas';
export const elegirTipoPintura = t => { tipoPintura = t || 'todas'; };
function pinturasHtml(d) {
  const barra = n => `<span class="rs-barra" role="img" aria-label="${n} de 5"><i style="width:${n * 20}%"></i></span><span class="rs-barra-n">${n}/5</span>`;
  const foto = (a, cls) => a.imagenUrl ? `<img class="${cls}" src="${esc('img/pinturas/' + String(a.imagenUrl).split('/').pop())}" alt="${esc(a.producto)}" loading="lazy">` : `<div class="rs-noimg ${cls}" aria-hidden="true">Imagen pendiente</div>`;
  const firmeEv = t => t === 'Estudio original' || t === 'Según ficha';
  const ev = t => { if (!t || !firmeEv(t)) return '';   // solo se muestran las etiquetas de dato firme (verdes)
    return `<span class="rs-ev is-firme" title="${esc((d.etiquetasEvidencia || {})[t] || '')}">${esc(t)}</span>`; };
  const tipos = d.tipos || [];
  const ra = d.recomendacionActual || {};
  const recIds = [d.recomendadaId, ra.primeraSpray, ra.alternativaSpray].filter(Boolean);   // «Recomendadas»: la del estudio original y las dos en spray
  const botones = [{ id: 'todas', nombre: 'Todas' }, ...(recIds.length ? [{ id: 'recomendadas', nombre: 'Recomendadas' }] : []), ...tipos];
  const pasa = (a, id) => id === 'todas' || (id === 'recomendadas' ? recIds.includes(a.id) : a.tipo === id);
  if (!botones.some(t => t.id === tipoPintura)) tipoPintura = 'todas';
  const todas = d.alternativas;
  const alts = todas.filter(a => pasa(a, tipoPintura));
  const marca = a => (a.id === d.recomendadaId ? '<span class="pill rec-pill">Recomendada por el estudio original</span>' : '');
  /* Filas de la comparación. «mejor»: qué valor se pinta de verde entre las columnas visibles.
     El SRI no se marca: los de E y F son estimaciones y no permiten elegir una ganadora térmica. */
  const filas = [
    { t: 'Refleja el calor del sol (SRI)', v: a => `${esc(a.sri)}${a.etiquetas.sri === 'Escenario de cálculo' ? ' <small>· escenario de cálculo</small>' : ''}${ev(a.etiquetas.sri)}` },
    { t: 'Golpes y rayaduras', v: a => barra(a.durabilidad) + ev(a.etiquetas.durabilidad), n: a => a.durabilidad, mejor: 'max' },
    { t: 'Sol, lluvia y salitre', v: a => barra(a.ambiental) + ev(a.etiquetas.ambiental), n: a => a.ambiental, mejor: 'max' },
    { t: 'Facilidad y lugar de aplicación', v: a => `${barra(a.viabilidad)}<span class="rs-celda-txt">${esc(a.modalidad)}</span>${ev(a.etiquetas.viabilidad)}`, n: a => a.viabilidad, mejor: 'max' },
    { t: 'Tiempo de trabajo', v: a => esc(a.tiempo) + ev(a.etiquetas.tiempo), n: a => a.tiempoHoras, mejor: 'min' },
    { t: 'Vida útil', v: a => esc(a.vidaUtil) + ev(a.etiquetas.vidaUtil), n: a => a.vidaAnios, mejor: 'max' },
    { t: 'Costo de materiales por maleta', v: a => `<strong>${esc(a.costoMaleta)}</strong><span class="rs-celda-txt">${esc(a.costoMaletaNota || '')}</span>${ev(a.etiquetas.costo)}
        <button type="button" class="rs-link" data-act="pin-desglose" data-id="${esc(a.id)}">Ver desglose<span class="sr-only"> de ${esc(a.id)}</span></button>`, n: a => a.costoMaletaNum, mejor: 'min' },
    { t: 'Compatibilidad con la carcasa', v: a => `<span class="rs-compat">${esc(a.compatCorta || a.compatibilidad)}</span>${ev(a.etiquetas.compat)}`, cls: 'rs-fila-compat' }
  ];
  const celdas = f => {
    const ns = alts.map(a => (f.n ? f.n(a) : null)), vals = ns.filter(x => x != null);
    const top = f.mejor && vals.length > 1 && new Set(vals).size > 1 ? (f.mejor === 'max' ? Math.max(...vals) : Math.min(...vals)) : null;
    return alts.map((a, i) => `<td class="${top != null && ns[i] === top ? 'is-mejor' : ''}${a.id === d.recomendadaId ? ' is-rec-col' : ''}">${f.v(a)}</td>`).join('');
  };
  const nTipo = id => todas.filter(a => pasa(a, id)).length;
  const filtro = `<div class="rs-tipos" role="group" aria-label="Tipo de solución">
      ${botones.map(t => `<button type="button" class="rs-tipo" data-act="pin-tipo" data-tipo="${esc(t.id)}" aria-pressed="${tipoPintura === t.id}">${esc(t.nombre)} <span class="rs-tipo-n">${nTipo(t.id)}</span></button>`).join('')}
    </div>
    <p class="rs-nota" role="status">Mostrando ${alts.length} de ${todas.length} opciones${tipoPintura === 'todas' ? '' : ` · ${esc((botones.find(t => t.id === tipoPintura) || {}).nombre || '')}`}. El filtro cambia el cuadro y las fichas.</p>`;
  const lineaLinks = xs => (xs && xs.length ? `<ul class="rs-ul rs-fuentes">${xs.map(f => `<li>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.t)}<span class="sr-only"> (abre en otra pestaña)</span></a>` : esc(f.t)}</li>`).join('')}</ul>` : '');
  const desglose = a => `<div class="rs-costo">
      <h4>Costo de materiales por maleta: ${esc(a.costoMaleta)} ${ev(a.etiquetas.costo)}</h4>
      <p class="rs-nota">${esc(a.costoMaletaCalculo || '')}</p>
      ${a.costoNotaConciliar ? `<p class="aviso cond">${esc(a.costoNotaConciliar)} El costo por maleta de arriba es el del estudio original y se mantiene como histórico mientras se verifica.</p>` : ''}
      ${a.costoPartidas ? `<ul class="rs-ul rs-partidas">${a.costoPartidas.map(p => `<li>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.t)}<span class="sr-only"> (abre en otra pestaña)</span></a>` : esc(p.t)}: <b>${esc(p.precio)}</b></li>`).join('')}</ul>` : ''}
      ${a.costoEscenarios ? lista(a.costoEscenarios) : ''}
      ${a.costoDesglose ? `<p class="rs-nota">Desglose del estudio original (lote para ${esc(a.rendimiento || '')}):</p><pre class="rs-pre">${esc(a.costoDesglose)}</pre>` : ''}
    </div>`;
  return `<section class="pj-sec" aria-labelledby="rs-cmp-t"><h2 id="rs-cmp-t">Comparación lado a lado</h2>
    ${filtro}
    <p class="rs-nota">En verde, el mejor valor entre las opciones visibles. El SRI no se marca. Los valores de E y F son estimaciones y pueden cambiar con las pruebas.</p>
    <div class="rs-tabla-wrap" tabindex="0" role="region" aria-labelledby="rs-cmp-t"><table class="rs-tabla rs-tabla-pin" style="--cols:${alts.length}">
      <thead><tr><th scope="col"><span class="sr-only">Punto a comparar</span></th>${alts.map(a => `<th scope="col" class="${a.id === d.recomendadaId ? 'is-rec-col' : ''}">
        <span class="rs-tabla-letra">${esc(a.id)}</span> ${esc(a.producto)} ${marca(a)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr class="${f.cls || ''}"><th scope="row">${f.t}</th>${celdas(f)}</tr>`).join('')}</tbody>
    </table></div>
    <details class="mas"><summary>¿Qué significa cada punto y cada etiqueta?</summary>
      <dl class="rs-det">${(d.criterios || []).map(c => `<div><dt>${esc(c.nombre)}</dt><dd>${esc(c.descripcion)}</dd></div>`).join('')}</dl>
      <dl class="rs-det">${Object.entries(d.etiquetasEvidencia || {}).filter(([k]) => firmeEv(k)).map(([k, v]) => `<div><dt>${ev(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>
  </section>
  <section class="pj-sec" aria-labelledby="rs-pin-t"><h2 id="rs-pin-t">Cada alternativa en detalle</h2>
    <p class="rs-nota">Mostrando ${alts.length} de ${todas.length} fichas.</p>
    <ul class="rs-grid rs-alts">${alts.map(a => `<li class="rs-card rs-alt ${a.id === d.recomendadaId ? 'is-rec' : ''}" id="rs-alt-${esc(a.id)}">
      ${foto(a, '')}
      <p class="ob-kicker">Alternativa ${esc(a.id)} · ${esc(a.categoria)}</p>
      <h3>${esc(a.producto)}</h3>
      ${marca(a)}
      <div class="rs-claves">
        <div><span>Por maleta</span><strong>${esc(a.costoMaleta)}</strong>${ev(a.etiquetas.costo)}</div>
        <div><span>Vida útil</span><strong>${esc(a.vidaUtil)}</strong>${ev(a.etiquetas.vidaUtil)}</div>
        <div><span>Trabajo</span><strong>${esc(a.tiempo)}</strong>${ev(a.etiquetas.tiempo)}</div>
      </div>
      <p class="rs-nota"><b>SRI:</b> ${esc(a.sri)} ${ev(a.etiquetas.sri)}</p>
      ${a.ventajas && a.ventajas.length ? `<div class="rs-pros"><h4>A favor</h4>${lista(a.ventajas)}</div>` : ''}
      ${a.limitaciones && a.limitaciones.length ? `<div class="rs-contras"><h4>En contra</h4>${lista(a.limitaciones)}</div>` : ''}
      <details class="rs-mas" data-keep="pin-${esc(a.id)}"><summary>Ver detalles</summary>
        <h4>Compatibilidad con la carcasa ${ev(a.etiquetas.compat)}</h4><p class="rs-nota">${esc(a.compatibilidad)}</p>
        ${desglose(a)}
        ${a.tiempoNota ? `<p class="rs-nota"><b>Tiempo:</b> ${esc(a.tiempoNota)}</p>` : ''}
        ${a.observaciones && a.observaciones.length ? `<h4>Observaciones</h4>${lista(a.observaciones)}` : ''}
        ${a.fuentes && a.fuentes.length ? `<h4>Fuentes</h4>${lineaLinks(a.fuentes)}` : ''}
      </details>
    </li>`).join('')}</ul></section>
  <section class="pj-sec" aria-labelledby="rs-rec-t"><h2 id="rs-rec-t">Recomendación actual</h2>
    ${(ra.texto || []).map(p => `<p>${esc(p)}</p>`).join('')}
    ${ra.validacion && ra.validacion.length ? `<h3>Orden de validación</h3><ol class="rs-ul">${ra.validacion.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <p class="nota">Ninguna alternativa está validada sin pruebas sobre la maleta.</p>
  </section>
  <section class="pj-sec" aria-labelledby="rs-conc-t"><h2 id="rs-conc-t">Conclusiones del estudio original</h2>
    ${String(d.conclusiones || '').split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}
    ${d.motivosRecomendacion && d.motivosRecomendacion.length ? `<h3>Motivos de la recomendación (alternativa B)</h3>${lista(d.motivosRecomendacion)}` : ''}
    ${d.fuentesGenerales && d.fuentesGenerales.length ? `<h3>Fuentes generales</h3>${lineaLinks(d.fuentesGenerales)}` : ''}
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
