/**
 * Ensamblaje CCS · Máquinas de simulación — información compartida y privada del módulo
 * (ventas, clientes, evidencias, talleres, instalaciones, servicios, equipos en operación, kits y repuestos).
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  ÚNICO CAMBIO NECESARIO: escribe una clave entre las comillas.       │
 * │  La página la pedirá para ver y guardar esta información.            │
 * │  Puede ser la misma clave de edición de máquinas u otra distinta.    │
 * └──────────────────────────────────────────────────────────────────────┘
 */
var CLAVE = 'ESCRIBE-AQUI-TU-CLAVE';

/*
 * INSTALACIÓN (una sola vez, unos 5 minutos), con la cuenta infraestructura@:
 *  1. Crea una hoja de cálculo nueva de Google, por ejemplo «Máquinas de simulación · datos privados».
 *     NO la compartas con nadie: la página entra a través de este script, no de la hoja.
 *  2. En esa hoja: Extensiones → Apps Script. Borra lo que haya, pega este archivo completo,
 *     escribe la clave arriba y guarda (icono de disquete).
 *  3. Implementar → Nueva implementación → engranaje → «Aplicación web».
 *       Descripción: Datos privados de máquinas
 *       Ejecutar como: Yo
 *       Quién tiene acceso: la misma opción que usaste para el script de edición de máquinas
 *     Pulsa Implementar, autoriza los permisos y copia la URL que termina en /exec.
 *  4. Envía esa URL (no la clave) para conectarla a la página.
 *  Si más adelante cambias la clave: Implementar → Gestionar implementaciones → lápiz →
 *  Versión «Nueva versión» → Implementar (la URL no cambia).
 *
 * QUÉ HACE: sin la clave correcta no lee ni escribe nada. Guarda cada colección en su propia pestaña
 * (una fila por registro) y nunca toca otras hojas. Un registro solo se reemplaza si nadie lo cambió desde
 * la última sincronización de quien lo envía; si no, se conserva el de la hoja y se avisa.
 * Los borrados quedan marcados (columna «borrado»), no se eliminan filas.
 */

var COLECCIONES = ['ventas', 'evidencias', 'evid-sin-clasificar', 'ventas-importacion', 'talleres', 'instalaciones',
  'servicios', 'operacion', 'complementos', 'soportes', 'kits', 'kits-sembrados', 'rep-datos'];
var ENCABEZADO = ['id', 'datos', 'version', 'actualizado', 'autor', 'borrado'];
var MAX_CELDA = 45000;

function doGet() { return json_({ ok: true, servicio: 'ensamblaje-ccs-datos-privados' }); }

/* Igual que el script de edición: la página envía un formulario («payload») a una ventana de Google
   (así viaja la sesión) y la respuesta vuelve con postMessage. También acepta JSON directo. */
function doPost(e) {
  var req = null, viaForm = !!(e && e.parameter && e.parameter.payload);
  try { req = JSON.parse(viaForm ? e.parameter.payload : e.postData.contents); } catch (x) { req = null; }
  var res = req ? procesar_(req) : err_('BAD_REQUEST', 'La solicitud no es válida.');
  return viaForm ? html_(req, res) : json_(res);
}

function procesar_(req) {
  if (!CLAVE || CLAVE === 'ESCRIBE-AQUI-TU-CLAVE') return err_('SCRIPT_NOT_CONFIGURED', 'Falta escribir la clave en la primera línea del Apps Script.');
  if (String(req.clave || '') !== CLAVE) { Utilities.sleep(800); return err_('UNAUTHORIZED', 'La clave no es correcta.'); }
  if (req.accion !== 'sincronizar') return err_('BAD_REQUEST', 'Acción no reconocida.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return err_('BUSY', 'Otra persona está sincronizando en este momento. Vuelve a intentarlo.');
  try {
    var r = aplicar_(Array.isArray(req.cambios) ? req.cambios : [], String(req.autor || '').slice(0, 80));
    return { ok: true, aplicados: r.aplicados, conflictos: r.conflictos, datos: leerTodo_() };
  } finally { lock.releaseLock(); }
}

function pestana_(col) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(col);
  if (!sh) { sh = ss.insertSheet(col); sh.getRange('A:B').setNumberFormat('@'); sh.getRange(1, 1, 1, ENCABEZADO.length).setValues([ENCABEZADO]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function filas_(sh) {
  var n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, ENCABEZADO.length).getValues().map(function (v, i) {
    return { fila: i + 2, id: String(v[0]), datos: String(v[1]), version: Number(v[2]) || 0, borrado: v[5] === true || v[5] === 'TRUE' };
  });
}

/* Cada cambio trae la versión en la que se basó («base»; 0 si es nuevo). Solo se aplica si la hoja sigue en
   esa versión: si otra persona lo cambió antes, se conserva el de la hoja y se informa como conflicto. */
function aplicar_(cambios, autor) {
  var aplicados = 0, conflictos = [], cache = {};
  cambios.slice(0, 3000).forEach(function (c) {
    var col = String(c.coleccion || ''), id = String(c.id || ''), base = Number(c.base) || 0;
    if (COLECCIONES.indexOf(col) < 0 || !/^[\w.:@%-]{1,160}$/.test(id)) return;
    var datos = c.datos === null || c.datos === undefined ? '' : String(c.datos);
    if (datos.length > MAX_CELDA) { conflictos.push({ coleccion: col, id: id, motivo: 'El registro es demasiado grande para guardarse.' }); return; }
    if (datos && datos.charAt(0) !== '{' && datos.charAt(0) !== '[') return;   // solo JSON (evita fórmulas)
    var sh = pestana_(col), l = cache[col] || (cache[col] = filas_(sh));
    var f = l.filter(function (x) { return x.id === id; })[0], actual = f ? f.version : 0;
    if (actual !== base) { conflictos.push({ coleccion: col, id: id, motivo: 'Otra persona lo cambió antes; se conserva la versión compartida.' }); return; }
    var fila = [id, datos, actual + 1, new Date(), autor, !datos];
    if (f) { sh.getRange(f.fila, 1, 1, fila.length).setValues([fila]); f.version = actual + 1; f.datos = datos; f.borrado = !datos; }
    else { sh.appendRow(fila); l.push({ fila: sh.getLastRow(), id: id, datos: datos, version: 1, borrado: !datos }); }
    aplicados++;
  });
  return { aplicados: aplicados, conflictos: conflictos };
}

function leerTodo_() {
  var ss = SpreadsheetApp.getActive(), o = {};
  COLECCIONES.forEach(function (col) {
    var sh = ss.getSheetByName(col); if (!sh) return;
    o[col] = filas_(sh).map(function (x) { return { id: x.id, datos: x.borrado ? null : x.datos, version: x.version }; });
  });
  return o;
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code, error) { return { ok: false, code: code, error: error }; }
function html_(req, res) {
  var origin = req && /^https?:\/\/[\w.-]+(:\d+)?$/.test(req.origin || '') ? req.origin : '*';
  var msg = JSON.stringify({ ccsMaquinas: true, id: req && req.id || '', res: res }).replace(/</g, '\\u003c');
  var texto = res.ok ? '✓ Información sincronizada. Esta ventana se cerrará sola.' : '✗ No se sincronizó: ' + String(res.error || 'error');
  var html = '<div style="font:16px system-ui,sans-serif;padding:24px;line-height:1.5;color:' + (res.ok ? '#065f46' : '#991b1b') + '">' +
    texto.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) +
    '<p style="color:#475569;font-size:14px">Puedes volver a la página del Departamento de Ensamblaje.</p></div>' +
    '<script>(function(){var m=' + msg + ',o=' + JSON.stringify(origin) + ',t=[];' +
    'try{if(window.top.opener)t.push(window.top.opener)}catch(e){}' +
    'try{if(window.top!==window)t.push(window.top)}catch(e){}' +
    't.forEach(function(w){try{w.postMessage(m,o)}catch(e){}});})();</script>';
  return HtmlService.createHtmlOutput(html).setTitle(res.ok ? 'Sincronizado' : 'No se sincronizó')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
