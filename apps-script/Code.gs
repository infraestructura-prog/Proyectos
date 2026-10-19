/**
 * Ensamblaje CCS · Máquinas de simulación — puente entre la aplicación (Vercel) y esta hoja.
 *
 * INSTALACIÓN (una sola vez):
 *  1. En la hoja «Codificación de Máquinas de Simulación»: Extensiones → Apps Script.
 *  2. Borra el contenido de Code.gs y pega este archivo completo. Guarda.
 *  3. Configuración del proyecto (engranaje) → Propiedades de la secuencia de comandos →
 *     Agregar propiedad:  APP_SECRET = <una clave larga y aleatoria>  (la misma que APPS_SCRIPT_SECRET en Vercel).
 *  4. Implementar → Nueva implementación → Tipo: Aplicación web.
 *       Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 *     Autoriza los permisos y copia la URL que termina en /exec (va en APPS_SCRIPT_URL en Vercel).
 *  Si cambias este código: Implementar → Gestionar implementaciones → Editar → Versión nueva.
 *
 * QUÉ HACE: solo lee «Hoja 1» y lee/escribe la pestaña «App_Maquinas». Nunca modifica «Hoja 1».
 * Toda petición debe traer APP_SECRET; sin ella no responde datos. Las escrituras usan un bloqueo
 * para que dos usuarios no guarden a la vez la misma codificación o pisen la misma fila.
 */

var TAB_APP = 'App_Maquinas';
var TAB_SOURCE = 'Hoja 1';
var COLUMNS = ['id', 'codificacion', 'categoria', 'serial', 'escalera', 'condicion', 'imagen_url',
  'origen', 'valor_original', 'creado', 'modificado', 'version', 'creado_por', 'modificado_por', 'request_id'];
var EDITABLE = ['codificacion', 'categoria', 'serial', 'escalera', 'condicion', 'imagen_url', 'modificado', 'modificado_por'];

function doGet() {
  // Comprobación de que la implementación responde; no devuelve datos.
  return json_({ ok: true, service: 'ensamblaje-ccs-maquinas' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return fail_('BAD_REQUEST', 'La solicitud no es JSON válido.'); }
  var secret = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
  if (!secret) return fail_('SCRIPT_NOT_CONFIGURED', 'Falta la propiedad APP_SECRET en el Apps Script.');
  if (!req || req.secret !== secret) return fail_('UNAUTHORIZED', 'La clave del Apps Script no coincide (APPS_SCRIPT_SECRET).');
  try {
    switch (req.action) {
      case 'read': return json_(read_());
      case 'reference': return json_(reference_());
      case 'init': return json_(withLock_(init_));
      case 'create': return json_(withLock_(function () { return create_(req.record); }));
      case 'update': return json_(withLock_(function () { return update_(req.id, req.version, req.changes); }));
      default: return fail_('BAD_REQUEST', 'Acción desconocida.');
    }
  } catch (err) {
    return fail_('SCRIPT_ERROR', String(err && err.message || err));
  }
}

/* ── Utilidades ── */
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code, error, extra) { var o = { ok: false, code: code, error: error }; for (var k in (extra || {})) o[k] = extra[k]; return json_(o); }
function err_(code, error, extra) { var o = { ok: false, code: code, error: error }; for (var k in (extra || {})) o[k] = extra[k]; return o; }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return err_('BUSY', 'La hoja está ocupada con otro guardado. Inténtalo de nuevo.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function spaces_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function codeKey_(s) { return spaces_(s).toUpperCase().replace(/\s+/g, ''); }
function serialKey_(s) { return spaces_(s).toUpperCase(); }

// Evita que un texto que empiece por = + - @ se interprete como fórmula.
function safe_(v) { var s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function rowToRecord_(row) {
  var r = {};
  for (var i = 0; i < COLUMNS.length; i++) r[COLUMNS[i]] = row[i] == null ? '' : String(row[i]);
  r.version = Number(r.version) || 1;
  return r;
}
function recordToRow_(r) { return COLUMNS.map(function (c) { return safe_(r[c]); }); }
function publicRecord_(r) { var o = {}; for (var k in r) if (k !== 'request_id' && k !== '_row') o[k] = r[k]; return o; }

/* Lee App_Maquinas. Devuelve { sheet, records } o un error. */
function table_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_APP);
  if (!sheet) return err_('TABLE_MISSING', 'La pestaña ' + TAB_APP + ' no existe todavía.');
  var last = sheet.getLastRow();
  if (last < 1) return err_('TABLE_MISSING', 'La pestaña ' + TAB_APP + ' está vacía: falta la fila de encabezados.');
  var values = sheet.getRange(1, 1, last, COLUMNS.length).getDisplayValues();
  for (var i = 0; i < COLUMNS.length; i++) {
    if (String(values[0][i]).trim() !== COLUMNS[i])
      return err_('TABLE_MISMATCH', 'Los encabezados de ' + TAB_APP + ' no coinciden con los esperados (' + COLUMNS.join(', ') + '). No se escribirá para no dañar datos.');
  }
  var records = [];
  for (var r = 1; r < values.length; r++) {
    var rec = rowToRecord_(values[r]);
    if (!rec.id) continue;
    rec._row = r + 1;
    records.push(rec);
  }
  return { ok: true, sheet: sheet, records: records };
}

function duplicates_(records, rec, excludeId) {
  var fields = {};
  var ck = codeKey_(rec.codificacion), sk = serialKey_(rec.serial);
  records.forEach(function (o) {
    if (o.id === excludeId) return;
    if (ck && codeKey_(o.codificacion) === ck && !fields.codificacion) fields.codificacion = 'La codificación ya está registrada (' + (o.condicion || 'sin condición') + ': ' + o.codificacion + ').';
    if (sk && serialKey_(o.serial) === sk && !fields.serial) fields.serial = 'El serial ya está registrado en la máquina ' + o.codificacion + '.';
  });
  return fields;
}

function writeRow_(sheet, rowNumber, rec) {
  var range = sheet.getRange(rowNumber, 1, 1, COLUMNS.length);
  range.setNumberFormat('@'); // texto plano: fechas, versiones y seriales no se convierten
  range.setValues([recordToRow_(rec)]);
}

/* ── Acciones ── */
function read_() {
  var t = table_();
  if (!t.ok) return t;
  return { ok: true, records: t.records.map(publicRecord_) };
}

function reference_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_SOURCE);
  if (!sheet) return err_('SOURCE_MISSING', 'No existe la pestaña «' + TAB_SOURCE + '».');
  var last = Math.max(sheet.getLastRow(), 2);
  return { ok: true, values: sheet.getRange(2, 1, last - 1, 10).getDisplayValues() };
}

function init_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(TAB_APP);
  if (sheet && sheet.getLastRow() > 0) return err_('TABLE_EXISTS', 'La pestaña ' + TAB_APP + ' ya existe y tiene contenido; no se modificó.');
  if (!sheet) sheet = ss.insertSheet(TAB_APP);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return { ok: true, tab: TAB_APP };
}

function create_(rec) {
  if (!rec || !rec.id || !rec.request_id) return err_('BAD_REQUEST', 'Registro incompleto.');
  var t = table_();
  if (!t.ok) return t;
  for (var i = 0; i < t.records.length; i++) {
    if (t.records[i].request_id === rec.request_id) return { ok: true, record: publicRecord_(t.records[i]), repeated: true };
  }
  var dup = duplicates_(t.records, rec);
  if (Object.keys(dup).length) return err_('DUPLICATE', Object.keys(dup).map(function (k) { return dup[k]; }).join(' '), { fields: dup });
  var clean = {};
  COLUMNS.forEach(function (c) { clean[c] = rec[c] == null ? '' : rec[c]; });
  clean.version = 1;
  writeRow_(t.sheet, t.sheet.getLastRow() + 1, clean);
  return { ok: true, record: publicRecord_(clean) };
}

function update_(id, version, changes) {
  if (!id || !changes) return err_('BAD_REQUEST', 'Faltan datos para editar.');
  var t = table_();
  if (!t.ok) return t;
  var cur = null;
  for (var i = 0; i < t.records.length; i++) if (t.records[i].id === id) { cur = t.records[i]; break; }
  if (!cur) return err_('NOT_FOUND', 'La máquina ya no existe en la tabla.');
  if (Number(version) !== cur.version)
    return err_('VERSION_CONFLICT', 'Otro usuario modificó esta máquina después de que la abrieras.', { current: publicRecord_(cur) });
  var next = {};
  COLUMNS.forEach(function (c) { next[c] = cur[c]; });
  EDITABLE.forEach(function (c) { if (changes[c] !== undefined) next[c] = changes[c]; });
  var dup = duplicates_(t.records, next, id);
  if (Object.keys(dup).length) return err_('DUPLICATE', Object.keys(dup).map(function (k) { return dup[k]; }).join(' '), { fields: dup });
  next.version = cur.version + 1;
  writeRow_(t.sheet, cur._row, next);
  return { ok: true, record: publicRecord_(next) };
}
