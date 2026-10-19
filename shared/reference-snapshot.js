/* Copia de referencia de «Codificación de Máquinas de Simulación» › Hoja 1 (leída el 2026-10-19).
   Se usa solo cuando el servidor no puede leer la hoja en vivo. Los valores se conservan tal cual
   (incluidos espacios y variantes como «Izquierdo»/«Derecho»). No contiene condición comercial. */

export const SNAPSHOT_DATE = '2026-10-19';

const L = (fila, categoria, serial, codificacion, escalera) =>
  ({ bloque: 'Izquierdo', fila, celdas: `C${fila}:F${fila}`, categoria, serial, codificacion, escalera, imagen: 'Incrustada en el archivo (columna A)' });
const R = (fila, categoria, codificacion, escalera) =>
  ({ bloque: 'Derecho', fila, celdas: `H${fila}:J${fila}`, categoria, serial: '', codificacion, escalera, imagen: '' });

export const REFERENCE_ROWS = [
  L(3, 'Con Chapa', 'YYJ202510036', 'A - CC - DER', 'Derecha'),
  L(4, 'Con Chapa', 'YYJ202606001', 'B - CC - DER', 'Derecha'),
  L(5, 'Con Chapa', 'YYJ202606006', 'C - CC - IZQ', 'Izquierdo'),
  L(6, 'Con Chapa', 'YYJ202606003', 'D - CC - DER', 'Derecha'),
  L(7, 'Con Chapa', 'YYJ202606002', 'E - CC - DER', 'Derecho'),
  L(8, 'Con Chapa', 'YYJ202606005', 'F - CC - IZQ', 'Izquierda'),
  L(9, 'Con Chapa', 'YYJ202606004', 'G - CC - IZQ', 'Izquierda'),
  R(3, 'Sin Chapa', 'A - SC - IZQ', 'Izquierda'),
  R(4, 'Sin Chapa', 'B - SC - IZQ', 'Izquierda'),
  R(5, 'Sin Chapa', 'C - SC - DER', 'Derecha'),
  R(6, 'Sin Chapa', 'D - SC - IZQ', 'Izquierdo '),
  R(7, 'Sin Chapa', 'E - SC - IZQ', 'Izquierda'),
  R(8, 'Sin Chapa', 'F - SC - DER', 'Derecha'),
  R(9, 'Sin Chapa', 'G - SC - DER', 'Derecho')
];

/* Convierte la matriz de valores de Hoja 1!A2:J9 (fila 2 = encabezados) al mismo formato. */
export function referenceFromValues(values) {
  const out = [];
  values.slice(1).forEach((row, i) => {
    const fila = i + 3, v = k => (row[k] == null ? '' : String(row[k]));
    if (v(2) || v(3) || v(4) || v(5)) out.push({ bloque: 'Izquierdo', fila, celdas: `C${fila}:F${fila}`, categoria: v(2), serial: v(3), codificacion: v(4), escalera: v(5), imagen: 'Incrustada en el archivo (columna A)' });
  });
  values.slice(1).forEach((row, i) => {
    const fila = i + 3, v = k => (row[k] == null ? '' : String(row[k]));
    if (v(7) || v(8) || v(9)) out.push({ bloque: 'Derecho', fila, celdas: `H${fila}:J${fila}`, categoria: v(7), serial: '', codificacion: v(8), escalera: v(9), imagen: '' });
  });
  return out;
}
