/* Presupuestos de Infraestructura (intervenciones y servicios).
   · Los subtotales y totales SIEMPRE se calculan desde las partidas: no hay cifras escritas aparte.
   · Las modalidades de pago son alternativas: cada una tiene su propio total y nunca se suman entre sí.
   · Un importe desconocido queda «pendiente» (null), nunca como cero; el total se marca como incompleto.
   · La aprobación presupuestaria no significa ejecución ni pago. Si después cambia algo económico, la aprobación
     anterior deja de aplicar y el presupuesto vuelve a «Por revisar» con el cambio identificado.
   · Se guarda en el navegador y se comparte con el equipo (guardado compartido, colección «presupuestos»). */
const P = 'ccs-infraestructura-v2:';
const K = { datos: P + 'presupuestos', sembrado: P + 'presupuestos-sembrado' };
export const ESTADOS = ['Borrador', 'Por revisar', 'Aprobado', 'Requiere ajustes', 'No aprobado'];
const leer = () => { try { const v = JSON.parse(localStorage.getItem(K.datos) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const escribir = v => { try { localStorage.setItem(K.datos, JSON.stringify(v)); return true; } catch { return false; } };
const str = (v, n) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const lineas = (v, n = 60) => String(v ?? '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, n);
const fechaOk = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const hoyIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const num = v => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(String(v).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const cent = n => Math.round(n * 100);
const nid = p => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

/* ── Primer registro: reparación de las canales (se crea una sola vez) ── */
export const ID_CANALES = 'PRE-CANALES-2026';
function semilla() {
  return {
    id: ID_CANALES, titulo: 'Reparación de las canales del taller',
    descripcion: 'Reparación de aproximadamente 25 metros de canales de aguas de lluvia, incluyendo la canal del frente y el tramo caído en la parte posterior del taller.',
    proyectoId: 'pi-canales', estado: 'Por revisar', moneda: 'USD', fechaAntecedente: '2026-11-13', vigencia: 'Pendiente de confirmar',
    alcance: ['Desmontar la canal existente.', 'Retirar los ganchos y fabricar soportes reforzados para evitar que se doblen.', 'Dividir y reinstalar la canal por tramos.',
      'Unir y sellar los empates con remaches y uretano.', 'Dar pendiente en dos aguas para el desagüe.', 'Instalar las boquillas/bajantes y codos de 45° correspondientes.', 'Lijar y pintar.'],
    alcanceNota: 'El alcance informado incluye la canal del frente y el tramo posterior caído.',
    partidas: [
      { id: 'P1', concepto: 'Materiales de El Pico, IVA incluido', cantidad: null, precioUnitario: null, importe: 229.75 },
      { id: 'P2', concepto: 'Boquillas adicionales', cantidad: 3, precioUnitario: 3.25, importe: null },
      { id: 'P3', concepto: 'Flete de materiales de El Pico', cantidad: null, precioUnitario: null, importe: 69.34 }
    ],
    modalidades: [
      { id: 'USD', nombre: 'Mano de obra en USD', manoObra: 700, principal: true,
        nota: 'Escenario con mano de obra de USD 700. Importe sujeto a confirmar especificaciones y vigencia.' },
      { id: 'BS', nombre: 'Otra modalidad de pago', manoObra: 1100, principal: false, equivalente: true,
        nota: 'El herrero indicó una alternativa de mano de obra pagadera en bolívares, equivalente a USD 1.100. La tasa, fecha de conversión y condiciones deben confirmarse.' }
    ],
    materiales: ['3 bajantes de 3 pulgadas para canal metálica.', '3 kilos de electrodos Lincoln 60/13.', '3 codos de 45° de 4 pulgadas.', '1 tubo PVC de 3 pulgadas.', '4 cartuchos de uretano.',
      '50 remaches grandes.', 'Fondo/pintura blanca, cantidad por confirmar.', '5 pliegos de lija grano 80.', '2 ángulos de 1½ pulgadas.'],
    materialesNota: 'Es la solicitud técnica original: no confirma que todos los materiales cotizados coincidan exactamente. Las tres boquillas adicionales corresponden a la solución propuesta para la conexión; no son una segunda necesidad física sin verificar su relación con los bajantes solicitados.',
    condicionesPago: 'Pendientes de confirmar. Hay dos modalidades alternativas para la mano de obra (USD o bolívares equivalentes); no se ha elegido ninguna.',
    // Pendientes confirmados por Cristian el 18/11/2026: la lista queda vacía.
    pendientes: [],
    documentos: [
      { id: 'D1', tipo: 'Cotización de materiales', referencia: 'Cotización El Pico 0003035462', enlace: '' },
      { id: 'D2', tipo: 'Cotización de boquillas', referencia: '', enlace: '' },
      { id: 'D3', tipo: 'Presupuesto del herrero', referencia: '', enlace: '' },
      { id: 'D4', tipo: 'Fotografías del área afectada', referencia: '', enlace: '' }
    ],
    observaciones: '', aprobacion: null, aprobacionesAnteriores: [], cambioPendiente: null,
    creado: new Date().toISOString(), actualizado: new Date().toISOString(), versiones: [], historial: [{ fecha: new Date().toISOString(), nota: 'Presupuesto registrado con el antecedente del 13/11/2026.' }]
  };
}
/* Inicialización idempotente: se crea una sola vez; recargar no sobrescribe ediciones ni duplica. */
export function asegurarSemilla() {
  let ya = false; try { ya = !!localStorage.getItem(K.sembrado); } catch { /* */ }
  const d = leer();
  if (!ya && !d[ID_CANALES]) { d[ID_CANALES] = semilla(); escribir(d); }
  try { localStorage.setItem(K.sembrado, '1'); } catch { /* */ }
  // 18/11/2026 · Cristian confirmó todos los pendientes de las canales: se quitan una sola vez de los registros ya creados,
  // guardando la versión anterior y una nota en el historial.
  let mig = false; try { mig = !!localStorage.getItem(P + 'presupuestos-mig-pendientes-1'); } catch { /* */ }
  const pr = d[ID_CANALES];
  if (!mig && pr && pr.pendientes && pr.pendientes.length) {
    const ahora = new Date().toISOString(), { versiones, historial, ...antes } = pr;
    d[ID_CANALES] = { ...pr, pendientes: [], actualizado: ahora,
      versiones: [...(versiones || []), { fecha: ahora, autor: 'Cristian', motivo: 'Pendientes de confirmación confirmados', total: calcular(pr).principal ? calcular(pr).principal.total : null, datos: antes }].slice(-30),
      historial: [...(historial || []), { fecha: ahora, autor: 'Cristian', nota: 'Pendientes de confirmación confirmados: se quitaron de la lista.' }] };
    escribir(d);
  }
  try { localStorage.setItem(P + 'presupuestos-mig-pendientes-1', '1'); } catch { /* */ }
}

/* ── Cálculos (en centavos) ── */
export function valorPartida(p) {
  if (p.cantidad !== null && p.cantidad !== undefined && p.precioUnitario !== null && p.precioUnitario !== undefined) return Math.round(p.cantidad * cent(p.precioUnitario)) / 100;
  return p.importe === null || p.importe === undefined ? null : p.importe;
}
export function calcular(pr) {
  const vals = pr.partidas.map(valorPartida), faltan = vals.filter(v => v === null).length;
  const sub = vals.reduce((s, v) => s + (v === null ? 0 : cent(v)), 0) / 100;
  const mods = pr.modalidades.map(m => ({ ...m, total: m.manoObra === null ? null : (cent(sub) + cent(m.manoObra)) / 100, completo: !faltan && m.manoObra !== null }));
  return { subtotal: sub, faltan, completo: faltan === 0, modalidades: mods, principal: mods.find(m => m.principal) || mods[0] || null };
}
/* Firma económica: si cambia después de una aprobación, la aprobación deja de aplicar. */
const firma = pr => JSON.stringify({ p: pr.partidas.map(x => [x.concepto, x.cantidad, x.precioUnitario, x.importe]), m: pr.modalidades.map(x => [x.id, x.manoObra]), mon: pr.moneda });

export const presupuestos = () => Object.values(leer()).filter(x => x && x.id).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
export const porId = id => leer()[id] || null;
export const deProyecto = pid => presupuestos().filter(x => x.proyectoId === pid);

/* Guarda una edición. Conserva la versión anterior y, si hay un cambio económico sobre un presupuesto aprobado,
   deja la aprobación como anterior y lo devuelve a «Por revisar» con el cambio identificado. */
export function guardar(id, d, autor, motivo) {
  const todos = leer(), a = todos[id]; if (!a) return { error: 'El presupuesto ya no existe.' };
  const partidas = [];
  for (const [i, p] of (d.partidas || []).entries()) {
    const concepto = str(p.concepto, 200); if (!concepto && !String(p.importe ?? '').trim() && !String(p.cantidad ?? '').trim()) continue;
    if (!concepto) return { error: `La partida ${i + 1} no tiene concepto.` };
    const cantidad = num(p.cantidad), precioUnitario = num(p.precioUnitario), importe = num(p.importe);
    if ([cantidad, precioUnitario, importe].some(Number.isNaN)) return { error: `Revisa los números de «${concepto}».` };
    if ([cantidad, precioUnitario, importe].some(v => v !== null && v < 0)) return { error: `«${concepto}» tiene un número negativo.` };
    if ((cantidad === null) !== (precioUnitario === null)) return { error: `En «${concepto}» indica cantidad y precio unitario juntos, o solo el importe.` };
    partidas.push({ id: p.id || nid('P'), concepto, cantidad, precioUnitario, importe: cantidad !== null ? null : importe });
  }
  if (!partidas.length) return { error: 'Agrega al menos una partida.' };
  const modalidades = a.modalidades.map(m => { const x = (d.modalidades || {})[m.id] || {}; const mo = num(x.manoObra);
    return { ...m, nombre: str(x.nombre ?? m.nombre, 80) || m.nombre, manoObra: Number.isNaN(mo) ? NaN : mo, nota: str(x.nota ?? m.nota, 800) }; });
  if (modalidades.some(m => Number.isNaN(m.manoObra) || (m.manoObra !== null && m.manoObra < 0))) return { error: 'Revisa el importe de la mano de obra.' };
  const estado = ESTADOS.includes(d.estado) ? d.estado : a.estado;
  if (estado === 'Aprobado' && a.estado !== 'Aprobado') return { error: 'Para aprobarlo usa «Registrar aprobación».' };
  const n = { ...a, titulo: str(d.titulo, 160) || a.titulo, descripcion: str(d.descripcion, 600), estado, fechaAntecedente: fechaOk(d.fechaAntecedente), vigencia: str(d.vigencia, 200),
    alcance: lineas(d.alcance), alcanceNota: str(d.alcanceNota, 400), partidas, modalidades, materiales: lineas(d.materiales), materialesNota: str(d.materialesNota, 800),
    condicionesPago: str(d.condicionesPago, 1200), pendientes: lineas(d.pendientes), observaciones: str(d.observaciones, 1500),
    documentos: (d.documentos || []).map(x => ({ id: x.id || nid('D'), tipo: str(x.tipo, 120), referencia: str(x.referencia, 200), enlace: /^https:\/\/\S+$/i.test(String(x.enlace || '').trim()) ? String(x.enlace).trim().slice(0, 600) : '' })).filter(x => x.tipo || x.referencia) };
  if (!n.titulo) return { error: 'El presupuesto necesita un nombre.' };
  const sinVersiones = ({ versiones, historial, ...resto }) => resto;
  if (JSON.stringify(sinVersiones(n)) === JSON.stringify(sinVersiones(a))) return { sinCambios: true };
  const ahora = new Date().toISOString(), quien = str(autor, 80), economico = firma(n) !== firma(a);
  n.versiones = [...(a.versiones || []), { fecha: ahora, autor: quien, motivo: str(motivo, 300), total: calcular(a).principal ? calcular(a).principal.total : null, datos: sinVersiones(a) }].slice(-30);
  n.historial = [...(a.historial || []), { fecha: ahora, autor: quien, nota: `Editado${economico ? ' (cambio económico)' : ''}${motivo ? `: ${str(motivo, 300)}` : ''}.` }].slice(-200);
  if (economico && a.aprobacion) {
    n.aprobacionesAnteriores = [...(a.aprobacionesAnteriores || []), { ...a.aprobacion, dejoDeAplicar: ahora, motivo: 'Cambio económico posterior a la aprobación.' }];
    n.aprobacion = null; n.estado = 'Por revisar';
    n.cambioPendiente = { fecha: ahora, autor: quien, totalAprobado: a.aprobacion.total, modalidadAprobada: a.aprobacion.modalidadNombre };
  } else if (a.aprobacion && n.estado !== 'Aprobado') {
    n.aprobacionesAnteriores = [...(a.aprobacionesAnteriores || []), { ...a.aprobacion, dejoDeAplicar: ahora, motivo: `Estado cambiado a «${n.estado}».` }];
    n.aprobacion = null;
  }
  n.actualizado = ahora; todos[id] = n;
  return escribir(todos) ? { ok: true, economico, reabierto: !!(economico && a.aprobacion) } : { error: 'No se pudo guardar en este navegador.' };
}
/* Registrar aprobación: quién la confirmó, fecha y modalidad. No ejecuta, no paga, no envía mensajes ni toca el proyecto. */
export function aprobar(id, d, autor) {
  const todos = leer(), a = todos[id]; if (!a) return { error: 'El presupuesto ya no existe.' };
  const c = calcular(a), m = c.modalidades.find(x => x.id === d.modalidadId); if (!m) return { error: 'Elige la modalidad aprobada.' };
  if (!m.completo) return { error: 'Esa modalidad tiene importes pendientes: complétalos antes de aprobar.' };
  const por = str(d.por, 120); if (!por) return { error: 'Indica quién confirmó la aprobación.' };
  const fecha = fechaOk(d.fecha); if (!fecha || fecha > hoyIso()) return { error: 'Indica la fecha de la aprobación (no futura).' };
  const ahora = new Date().toISOString();
  todos[id] = { ...a, estado: 'Aprobado', cambioPendiente: null, actualizado: ahora,
    aprobacion: { por, fecha, modalidadId: m.id, modalidadNombre: m.nombre, total: m.total, nota: str(d.nota, 600), registradoPor: str(autor, 80), registrado: ahora },
    historial: [...(a.historial || []), { fecha: ahora, autor: str(autor, 80), nota: `Aprobación registrada: ${por}, ${fecha.split('-').reverse().join('/')}, «${m.nombre}».` }] };
  return escribir(todos) ? { ok: true } : { error: 'No se pudo guardar en este navegador.' };
}
