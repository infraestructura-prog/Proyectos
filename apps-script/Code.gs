/**
 * Ensamblaje CCS · Máquinas de simulación — edición desde la página.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  ÚNICO CAMBIO NECESARIO: escribe tu clave de edición en la línea de  │
 * │  abajo (entre las comillas). Es la que pedirá la página al guardar.  │
 * └──────────────────────────────────────────────────────────────────────┘
 */
var CLAVE_EDICION = 'ESCRIBE-AQUI-TU-CLAVE';

/* Hoja de cálculo y pestaña donde están las máquinas (las mismas que lee la página). */
var HOJA_ID = '1PuXWlmC_ZQOBHYAk-OT1Z73gAqF8FtGctp-CYoqPsDk';
var PESTANA = 'Hoja 5';

/*
 * INSTALACIÓN (una sola vez, unos 5 minutos). El script va en TU cuenta, no dentro de la hoja,
 * porque Google no deja a los editores implementar scripts de una hoja que pertenece a otra cuenta:
 *  1. Entra en https://script.google.com con la cuenta que puede editar la hoja → «Nuevo proyecto».
 *  2. Borra lo que haya, pega este archivo completo y cambia CLAVE_EDICION. Guarda (icono de disquete).
 *  3. Implementar → Nueva implementación → engranaje → «Aplicación web».
 *       Ejecutar como: Yo      Quién tiene acceso: Cualquier usuario
 *     Pulsa Implementar, autoriza los permisos y copia la URL que termina en /exec.
 *  4. Envía esa URL para colocarla en la página (assets/js/config.js → EDIT_URL).
 *  Si más adelante cambias este código o la clave: Implementar → Gestionar implementaciones →
 *  lápiz → Versión: «Nueva versión» → Implementar (la URL no cambia).
 *
 * QUÉ HACE: solo modifica la pestaña indicada en PESTANA, y solo las columnas Codificación, Categoría,
 * Serial, Escalera, Condición e Imagen (si no existe la columna Imagen, la agrega al final de la fila 1).
 * Sin la clave correcta no escribe nada. No devuelve datos de la hoja salvo las filas que modifica.
 */

var CAMPOS = {
  codificacion: ['codificacion', 'codigo'],
  categoria: ['categoria'],
  serial: ['serial'],
  escalera: ['escalera', 'lado de la escalera', 'lado escalera', 'lado'],
  condicion: ['condicion', 'condicion comercial', 'estado'],
  imagen: ['imagen', 'imagen url', 'imagen_url', 'foto']
};
var ORDEN = ['codificacion', 'categoria', 'serial', 'escalera', 'condicion', 'imagen'];

function doGet() {
  return json_({ ok: true, servicio: 'ensamblaje-ccs-maquinas' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return json_(err_('BAD_REQUEST', 'La solicitud no es válida.')); }
  if (!CLAVE_EDICION || CLAVE_EDICION === 'ESCRIBE-AQUI-TU-CLAVE')
    return json_(err_('SCRIPT_NOT_CONFIGURED', 'Falta escribir la clave de edición en la primera línea del Apps Script.'));
  if (String(req.clave || '') !== CLAVE_EDICION) {
    Utilities.sleep(800); // frena intentos repetidos
    return json_(err_('UNAUTHORIZED', 'La clave de edición no es correcta.'));
  }
  try {
    if (req.accion === 'verificar') return json_({ ok: true });
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return json_(err_('BUSY', 'La hoja está ocupada con otro guardado. Inténtalo de nuevo.'));
    try {
      if (req.accion === 'editar') return json_(editar_(req.cambios || []));
      if (req.accion === 'agregar') return json_(agregar_(req.datos || {}));
      return json_(err_('BAD_REQUEST', 'Acción desconocida.'));
    } finally { lock.releaseLock(); }
  } catch (x) {
    return json_(err_('SCRIPT_ERROR', String(x && x.message || x)));
  }
}

/* ── Utilidades ── */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code, error, extra) { var o = { ok: false, code: code, error: error }; for (var k in (extra || {})) o[k] = extra[k]; return o; }
function key_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function spaces_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function noSerial_(s) { var t = spaces_(s); return /^[-–—]*$/.test(t) ? '' : t; }
function codeKey_(s) { return spaces_(s).toUpperCase().replace(/\s+/g, ''); }
function serialKey_(s) { return noSerial_(s).toUpperCase(); }
function safe_(v) { var s = String(v == null ? '' : v); return /^[=+@]/.test(s) || /^-[^-\s]/.test(s) ? "'" + s : s; } // evita fórmulas

/* Compara dos valores como los ve la página (sin importar espacios ni mayúsculas; «-» = sin serial). */
function igual_(campo, a, b) {
  if (campo === 'serial') return serialKey_(a) === serialKey_(b);
  if (campo === 'codificacion') return codeKey_(a) === codeKey_(b);
  if (campo === 'escalera') return lado_(a) === lado_(b) || key_(a) === key_(b);
  return key_(a) === key_(b);
}
function categoria_(v) { var s = key_(v); return s === 'con chapa' ? 'Con Chapa' : s === 'sin chapa' ? 'Sin Chapa' : ''; }
function lado_(v) { var s = key_(v); return /^derech[ao]$/.test(s) ? 'Derecha' : /^izquierd[ao]$/.test(s) ? 'Izquierda' : ''; }
function condicion_(v) { var s = key_(v); return /^(en )?stock$/.test(s) ? 'En stock' : /^vendid[ao]$/.test(s) ? 'Vendida' : ''; }

function hoja_() {
  var sh = SpreadsheetApp.openById(HOJA_ID).getSheetByName(PESTANA);
  if (!sh) throw new Error('No existe la pestaña «' + PESTANA + '». Revisa la variable PESTANA del Apps Script.');
  return sh;
}

function columnas_(sh, crearImagen) {
  var last = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, last).getDisplayValues()[0].map(key_);
  var c = {};
  for (var f in CAMPOS) for (var i = 0; i < head.length; i++) if (CAMPOS[f].indexOf(head[i]) >= 0) { c[f] = i + 1; break; }
  if (!c.codificacion || !c.condicion) throw new Error('La pestaña «' + PESTANA + '» no tiene las columnas Codificación y Condición en la fila 1.');
  if (!c.imagen && crearImagen) { c.imagen = last + 1; sh.getRange(1, c.imagen).setValue('Imagen'); }
  return c;
}

function filas_(sh, c) {
  var n = sh.getLastRow() - 1, out = [];
  if (n < 1) return out;
  var width = sh.getLastColumn();
  var values = sh.getRange(2, 1, n, width).getDisplayValues();
  for (var r = 0; r < values.length; r++) {
    var o = { fila: r + 2 };
    ORDEN.forEach(function (f) { o[f] = c[f] ? values[r][c[f] - 1] : ''; });
    if (spaces_(o.codificacion)) out.push(o);
  }
  return out;
}

function validar_(d) {
  var e = {}, v = {};
  v.codificacion = spaces_(d.codificacion);
  if (!v.codificacion) e.codificacion = 'Escribe la codificación de la máquina.';
  else if (v.codificacion.length > 40) e.codificacion = 'La codificación no puede superar 40 caracteres.';
  v.categoria = categoria_(d.categoria); if (!v.categoria) e.categoria = 'Selecciona con chapa o sin chapa.';
  v.escalera = lado_(d.escalera); if (!v.escalera) e.escalera = 'Selecciona el lado de la escalera.';
  v.condicion = condicion_(d.condicion); if (!v.condicion) e.condicion = 'Indica si la máquina está en stock o vendida.';
  v.serial = noSerial_(d.serial);
  if (v.serial.length > 40) e.serial = 'El serial no puede superar 40 caracteres.';
  v.imagen = spaces_(d.imagen);
  if (v.imagen && (!/^https:\/\//i.test(v.imagen) || v.imagen.length > 1000)) e.imagen = 'La imagen debe ser un enlace que empiece por https://';
  return { valor: v, errores: e };
}

function duplicados_(todas, v, excluirFila) {
  var f = {};
  todas.forEach(function (o) {
    if (o.fila === excluirFila) return;
    if (!f.codificacion && codeKey_(o.codificacion) === codeKey_(v.codificacion)) f.codificacion = 'La codificación ' + spaces_(o.codificacion) + ' ya existe (fila ' + o.fila + ').';
    if (!f.serial && v.serial && serialKey_(o.serial) === serialKey_(v.serial)) f.serial = 'El serial ya está registrado en ' + spaces_(o.codificacion) + '.';
  });
  return f;
}

function escribir_(sh, c, fila, actual, v) {
  ORDEN.forEach(function (f) {
    if (!c[f] || v[f] === undefined) return;
    var nuevo = f === 'serial' && !v.serial ? '-' : v[f];
    if (actual && igual_(f, actual[f], nuevo) && String(actual[f]).trim() !== '') return; // solo se escriben las celdas que cambian
    sh.getRange(fila, c[f]).setValue(safe_(nuevo));
  });
}

function leer_(sh, c, fila) {
  var width = sh.getLastColumn(), row = sh.getRange(fila, 1, 1, width).getDisplayValues()[0], o = { fila: fila };
  ORDEN.forEach(function (f) { o[f] = c[f] ? row[c[f] - 1] : ''; });
  return o;
}

/* Edita una o varias filas a la vez (p. ej. vender una pareja). Si una falla, no se escribe ninguna. */
function editar_(cambios) {
  if (!cambios.length) return err_('BAD_REQUEST', 'No hay cambios.');
  var sh = hoja_();
  var c = columnas_(sh, cambios.some(function (x) { return x.datos && spaces_(x.datos.imagen); }));
  var todas = filas_(sh, c), plan = [];
  for (var i = 0; i < cambios.length; i++) {
    var x = cambios[i], o = x.original || {};
    var actual = todas.filter(function (r) { return r.fila === Number(x.fila) && codeKey_(r.codificacion) === codeKey_(o.codificacion); })[0]
      || todas.filter(function (r) { return codeKey_(r.codificacion) === codeKey_(o.codificacion); })[0];
    if (!actual) return err_('NOT_FOUND', 'La máquina ' + spaces_(o.codificacion) + ' ya no está en la hoja.');
    for (var k in o) if (ORDEN.indexOf(k) >= 0 && !igual_(k, actual[k], o[k]))
      return err_('CONFLICT', 'La máquina ' + spaces_(o.codificacion) + ' cambió en la hoja después de que la abrieras.', { actual: actual });
    var datos = {};
    ORDEN.forEach(function (f) { datos[f] = x.datos && x.datos[f] !== undefined ? x.datos[f] : actual[f]; });
    var r = validar_(datos);
    if (Object.keys(r.errores).length) return err_('VALIDATION', 'Hay campos con errores en ' + spaces_(o.codificacion) + '.', { fields: r.errores });
    var dup = duplicados_(todas, r.valor, actual.fila);
    if (Object.keys(dup).length) return err_('DUPLICATE', Object.keys(dup).map(function (k) { return dup[k]; }).join(' '), { fields: dup });
    plan.push({ actual: actual, valor: r.valor });
  }
  plan.forEach(function (p) { escribir_(sh, c, p.actual.fila, p.actual, p.valor); });
  SpreadsheetApp.flush();
  return { ok: true, registros: plan.map(function (p) { return leer_(sh, c, p.actual.fila); }) };
}

function agregar_(datos) {
  var sh = hoja_();
  var r = validar_(datos);
  if (Object.keys(r.errores).length) return err_('VALIDATION', 'Hay campos con errores.', { fields: r.errores });
  var c = columnas_(sh, !!r.valor.imagen);
  var dup = duplicados_(filas_(sh, c), r.valor, 0);
  if (Object.keys(dup).length) return err_('DUPLICATE', Object.keys(dup).map(function (k) { return dup[k]; }).join(' '), { fields: dup });
  var fila = sh.getLastRow() + 1;
  escribir_(sh, c, fila, null, r.valor);
  SpreadsheetApp.flush();
  return { ok: true, registro: leer_(sh, c, fila) };
}
