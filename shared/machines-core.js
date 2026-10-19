/* Reglas de datos de Máquinas de simulación.
   Este módulo se usa en el navegador y en las funciones de servidor (misma validación en ambos lados). */

export const TAB_APP = 'App_Maquinas';

export const CONDICIONES = ['En stock', 'Vendida'];
export const CATEGORIAS = ['Con chapa', 'Sin chapa'];
export const LADOS = ['Derecha', 'Izquierda'];

// Orden de columnas de la tabla normalizada (pestaña App_Maquinas). No cambiar el orden sin migrar.
export const COLUMNS = [
  'id', 'codificacion', 'categoria', 'serial', 'escalera', 'condicion', 'imagen_url',
  'origen', 'valor_original', 'creado', 'modificado', 'version', 'creado_por', 'modificado_por', 'request_id'
];

export const trimSpaces = s => String(s ?? '').replace(/\s+/g, ' ').trim();

export function normalizeCategoria(v) {
  const s = trimSpaces(v).toLowerCase();
  if (/^con\s*chapa$/.test(s)) return 'Con chapa';
  if (/^sin\s*chapa$/.test(s)) return 'Sin chapa';
  return '';
}

// «Derecho» y «Derecha» se muestran como «Derecha»; «Izquierdo» e «Izquierda» como «Izquierda».
export function normalizeLado(v) {
  const s = trimSpaces(v).toLowerCase();
  if (/^derech[ao]$/.test(s)) return 'Derecha';
  if (/^izquierd[ao]$/.test(s)) return 'Izquierda';
  return '';
}

export const codeKey = s => trimSpaces(s).toUpperCase().replace(/\s+/g, '');
export const serialKey = s => trimSpaces(s).toUpperCase();

// Regla PROPUESTA (pendiente de confirmación): Letra - CC/SC - DER/IZQ.
export function parseCode(code) {
  const m = codeKey(code).match(/^([A-Z]+)-(CC|SC)-(DER|IZQ)$/);
  if (!m) return null;
  return { letra: m[1], categoria: m[2] === 'CC' ? 'Con chapa' : 'Sin chapa', escalera: m[3] === 'DER' ? 'Derecha' : 'Izquierda' };
}

export function consistencyWarnings(m) {
  const w = [];
  if (!trimSpaces(m.codificacion)) return w;
  const p = parseCode(m.codificacion);
  if (!p) {
    w.push('La codificación no sigue el patrón observado «Letra - CC/SC - DER/IZQ» (regla pendiente de confirmación).');
    return w;
  }
  if (m.categoria && p.categoria !== m.categoria) w.push(`La codificación indica «${p.categoria}», pero la categoría registrada es «${m.categoria}».`);
  if (m.escalera && p.escalera !== m.escalera) w.push(`La codificación indica escalera «${p.escalera}», pero el lado registrado es «${m.escalera}».`);
  return w;
}

const SERIAL_RE = /^[A-Za-z0-9][A-Za-z0-9\-_/. ]*$/;

/* Valida y normaliza los campos editables. Devuelve { value, errors } donde errors es { campo: mensaje }. */
export function validateMachine(input) {
  const errors = {};
  const value = {
    codificacion: trimSpaces(input.codificacion),
    categoria: CATEGORIAS.includes(input.categoria) ? input.categoria : normalizeCategoria(input.categoria),
    serial: trimSpaces(input.serial),
    escalera: LADOS.includes(input.escalera) ? input.escalera : normalizeLado(input.escalera),
    condicion: CONDICIONES.includes(input.condicion) ? input.condicion : '',
    imagen_url: trimSpaces(input.imagen_url)
  };

  if (!value.codificacion) errors.codificacion = 'Escribe la codificación de la máquina.';
  else if (value.codificacion.length > 40) errors.codificacion = 'La codificación no puede superar 40 caracteres.';

  if (!value.categoria) errors.categoria = 'Selecciona si la máquina es con chapa o sin chapa.';
  if (!value.escalera) errors.escalera = 'Selecciona el lado de la escalera.';
  if (!value.condicion) errors.condicion = 'Indica si la máquina está en stock o vendida.';

  if (value.serial) {
    if (value.serial.length > 40) errors.serial = 'El serial no puede superar 40 caracteres.';
    else if (!SERIAL_RE.test(value.serial)) errors.serial = 'El serial solo admite letras, números, espacios y - _ / .';
  }

  if (value.imagen_url) {
    let ok = false;
    try { const u = new URL(value.imagen_url); ok = u.protocol === 'https:'; } catch { ok = false; }
    if (!ok) errors.imagen_url = 'La imagen debe ser un enlace que empiece por https://';
    else if (value.imagen_url.length > 1000) errors.imagen_url = 'El enlace de la imagen es demasiado largo.';
  }

  return { value, errors };
}

/* Duplicados entre TODAS las máquinas (vendidas y en stock). */
export function findDuplicates(records, value, excludeId) {
  const errors = {};
  const others = records.filter(r => r.id !== excludeId);
  const ck = codeKey(value.codificacion);
  if (ck) {
    const d = others.find(r => codeKey(r.codificacion) === ck);
    if (d) errors.codificacion = `La codificación ya está registrada (${d.condicion || 'sin condición'}: ${d.codificacion}).`;
  }
  const sk = serialKey(value.serial);
  if (sk) {
    const d = others.find(r => serialKey(r.serial) === sk);
    if (d) errors.serial = `El serial ya está registrado en la máquina ${d.codificacion}.`;
  }
  return errors;
}

export function rowToRecord(row) {
  const r = {};
  COLUMNS.forEach((c, i) => { r[c] = row[i] == null ? '' : String(row[i]); });
  r.version = Number(r.version) || 1;
  return r;
}

export const recordToRow = r => COLUMNS.map(c => (r[c] == null ? '' : String(r[c])));
