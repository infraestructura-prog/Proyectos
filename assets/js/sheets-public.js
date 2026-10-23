/* Lectura de hojas de Google compartidas como «Cualquier persona con el enlace · Lector»,
   con el mismo método del panel de Nodos (exportación CSV de gviz). Solo lectura, sin credenciales.
   Ojo: si la pestaña pedida no existe, Google devuelve la primera pestaña; quien llama debe validar encabezados. */

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function readPublicSheet(sheetId, { tab = '', range = '' } = {}) {
  const p = new URLSearchParams({ tqx: 'out:csv', headers: '0' });
  if (tab) p.set('sheet', tab);
  if (range) p.set('range', range);
  let res;
  try { res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${p}`, { cache: 'no-store' }); }
  catch {
    // Una hoja privada responde con una redirección al inicio de sesión que el navegador bloquea (sin CORS),
    // así que con conexión activa el fallo casi siempre significa que la hoja no está compartida.
    if (navigator.onLine === false) throw Object.assign(new Error('No hay conexión a internet.'), { code: 'NETWORK' });
    throw Object.assign(new Error('No se pudo leer la hoja. Compártela como «Cualquier persona con el enlace · Lector» (si ya lo está, revisa tu conexión).'), { code: 'NOT_PUBLIC' });
  }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('La hoja no es pública. Compártela como «Cualquier persona con el enlace · Lector».'), { code: 'NOT_PUBLIC' });
  if (!res.ok) throw Object.assign(new Error(`Google Sheets respondió HTTP ${res.status}.`), { code: 'SHEETS_HTTP' });
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text))
    throw Object.assign(new Error('La hoja no es pública. Compártela como «Cualquier persona con el enlace · Lector».'), { code: 'NOT_PUBLIC' });
  return parseCSV(text);
}
