/* Neotropya › Presupuestos · reglas de dinero y del límite del presupuesto (sin interfaz).
   Todos los importes son enteros en centavos; las tasas de cambio, enteros en millonésimas.
   «Comprometido» = aprobados (importe vivo) + comprados (importe congelado al comprar).
   Los pendientes no consumen presupuesto. Marcar como comprado no vuelve a sumar el importe. */

export const PLATAFORMAS = ['Mercado Libre', 'Amazon', 'Distribuidor local', 'Otro'];
export const IMPORTANCIAS = ['Alta', 'Media', 'Baja'];
export const ESTADOS = ['Pendiente', 'Aprobado', 'Comprado'];
export const CARGOS = [['envio', 'Envío'], ['impuestos', 'Impuestos'], ['otros', 'Otros cargos']];
/* conocido: importe informado · cero: confirmado sin costo · estimado: importe reservado (estimación) · pendiente: sin cotizar */
export const CARGO_ESTADOS = [['pendiente', 'Pendiente de cotizar'], ['cero', 'Confirmado en cero'], ['conocido', 'Importe conocido'], ['estimado', 'Reserva estimada']];
const MAX_CENTS = 1e13;

/* «304,63», «304.63», «1.234,56», «1,234.56», «1234» → centavos; vacío → null; inválido → NaN. */
export function parseMoney(raw) {
  const s = String(raw ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const m = s.match(/^(\d{1,3}(?:([.,])\d{3})+|\d+)(?:([.,])(\d{1,2}))?$/);
  if (!m) return NaN;
  const [, int, thou, dec, frac = ''] = m;
  if (thou && dec && thou === dec) return NaN;
  const cents = Number(int.replace(/[.,]/g, '')) * 100 + Number((frac + '00').slice(0, 2));
  return cents > MAX_CENTS ? NaN : cents;
}

/* Tasa decimal positiva con hasta 6 decimales → millonésimas (entero). */
export function parseRate(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const m = s.match(/^(\d{1,9})(?:\.(\d{1,6}))?$/);
  if (!m) return NaN;
  const v = Number(m[1]) * 1e6 + Number(((m[2] || '') + '000000').slice(0, 6));
  return v > 0 ? v : NaN;
}

export const rateText = micro => (micro / 1e6).toLocaleString('es', { maximumFractionDigits: 6 });
export const moneyText = cents => (cents / 100).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (cents, cur) => cents == null ? '—' : `${cur || '$'} ${moneyText(cents)}${cur ? '' : ' (moneda por confirmar)'}`;

/* Conversión explícita con redondeo a centavo (mitad hacia arriba), exacta con BigInt. */
export const convert = (cents, micro) => Number((BigInt(cents) * BigInt(micro) + 500000n) / 1000000n);

/* Total del producto en su propia moneda. complete=false si falta precio o hay cargos sin cotizar. */
export function productTotal(p) {
  const pend = CARGOS.filter(([k]) => p.cargos[k].estado === 'pendiente').map(([, l]) => l);
  const est = CARGOS.some(([k]) => p.cargos[k].estado === 'estimado');
  if (p.precioCents == null) return { cents: null, subtotal: null, complete: false, pend, est };
  const subtotal = p.precioCents * p.cantidad;
  const cargos = CARGOS.reduce((s, [k]) => s + (['conocido', 'estimado'].includes(p.cargos[k].estado) ? p.cargos[k].cents : 0), 0);
  return { cents: subtotal + cargos, subtotal, complete: !pend.length, pend, est };
}

/* Importe que el producto ocuparía en el presupuesto, o { error } con el motivo por el que no se puede aprobar. */
export function budgetAmount(p, B) {
  const t = productTotal(p);
  if (p.precioCents == null) return { error: 'No tiene precio.' };
  if (!p.moneda) return { error: 'La moneda del precio está por confirmar.' };
  if (t.pend.length) return { error: `Hay cargos pendientes de cotizar (${t.pend.join(', ').toLowerCase()}). Indica su importe, confírmalos en cero o reserva un importe estimado.` };
  if (!B.moneda) return { error: 'Falta definir la moneda del presupuesto.' };
  if (p.moneda === B.moneda) return { cents: t.cents, est: t.est };
  if (p.tasa && p.tasa.destino === B.moneda) return { cents: convert(t.cents, p.tasa.micro), est: t.est, converted: true };
  return { error: `El producto está en ${p.moneda} y el presupuesto en ${B.moneda}. Registra una equivalencia explícita (1 ${p.moneda} = ? ${B.moneda}) en el producto.` };
}

export function totals(state, skipId = null) {
  let reservado = 0, realizado = 0, aprobados = 0, comprados = 0;
  for (const p of state.productos) {
    if (p.id === skipId) continue;
    if (p.estado === 'Aprobado') { const a = budgetAmount(p, state.presupuesto); reservado += a.cents || 0; aprobados++; }
    else if (p.estado === 'Comprado') { realizado += p.compra.cents; comprados++; }
  }
  const max = state.presupuesto.maxCents;
  const comprometido = reservado + realizado;
  return { reservado, realizado, comprometido, aprobados, comprados, max, saldo: max == null ? null : max - comprometido };
}

/* Comprobación previa a aprobar: nuevo total, saldo y cuánto falta. */
export function checkApprove(state, p) {
  const B = state.presupuesto;
  if (p.estado !== 'Pendiente') return { ok: false, motivo: 'El producto no está pendiente.' };
  if (B.maxCents == null) return { ok: false, motivo: 'Todavía no se ha definido un presupuesto máximo.' };
  const a = budgetAmount(p, B);
  if (a.error) return { ok: false, motivo: a.error };
  const t = totals(state);
  const nuevo = t.comprometido + a.cents;
  if (nuevo > B.maxCents) return { ok: false, motivo: 'Supera el presupuesto máximo.', importe: a.cents, nuevo, saldo: t.saldo, falta: nuevo - B.maxCents };
  return { ok: true, importe: a.cents, nuevo, saldo: t.saldo, est: a.est };
}

/* Reglas que todo estado guardado debe cumplir. Devuelve el primer incumplimiento o null. */
export function invariants(state) {
  const B = state.presupuesto;
  for (const p of state.productos) {
    if (p.estado === 'Aprobado') {
      const a = budgetAmount(p, B);
      if (a.error) return `«${p.nombre}» está aprobado y dejaría de poder calcularse: ${a.error} Retira primero la aprobación.`;
    }
    if (p.estado === 'Comprado' && p.compra.moneda !== B.moneda)
      return `«${p.nombre}» se compró en ${p.compra.moneda}; la moneda del presupuesto no puede cambiar mientras existan compras realizadas.`;
  }
  const t = totals(state);
  if (t.comprometido > 0 && B.maxCents == null) return 'No se puede quitar el presupuesto máximo mientras haya importes comprometidos.';
  if (B.maxCents != null && t.comprometido > B.maxCents)
    return `El total comprometido (${B.moneda} ${moneyText(t.comprometido)}) superaría el presupuesto máximo (${B.moneda} ${moneyText(B.maxCents)}) en ${B.moneda} ${moneyText(t.comprometido - B.maxCents)}.`;
  return null;
}
